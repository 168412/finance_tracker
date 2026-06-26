import mongoose from 'mongoose';
import { RecurringExpense } from '../models/RecurringExpense.js';
import { RecurringTransfer } from '../models/RecurringTransfer.js';
import { Expense } from '../models/Expense.js';
import { Transfer } from '../models/Transfer.js';
import { Asset } from '../models/Asset.js';
import { ExchangeRate } from '../models/ExchangeRate.js';
import { fetchTickerPrice } from '../routes/api.js';

const lockSchema = new mongoose.Schema({
    _id: String,
    createdAt: { type: Date, expires: 86400, default: Date.now } // Auto-delete after 24h
});
const Lock = mongoose.models.Lock || mongoose.model('Lock', lockSchema);

// Map to track the last time we checked for a user (userId -> timestamp)
const lastCheckMap = new Map();
// Set to track active evaluations to prevent concurrent runs
const runningChecks = new Set();

// Helper to convert currency
const convertAmount = async (amount, fromCur, toCur) => {
    if (!fromCur || !toCur || fromCur === toCur) return amount;
    const rateDoc = await ExchangeRate.findOne({ id: '1' });
    const rates = rateDoc && rateDoc.rates ? rateDoc.rates : { EUR: 1, USD: 1.08, GBP: 0.85, INR: 90 };
    const rateFrom = fromCur === 'EUR' ? 1 : (rates[fromCur] || 1);
    const rateTo = toCur === 'EUR' ? 1 : (rates[toCur] || 1);
    return amount * (rateTo / rateFrom);
};

export const evaluateRecurringExpenses = async (userId) => {
    const userIdStr = userId.toString();
    try {
        const now = Date.now();
        
        // Prevent concurrent evaluations for the same user
        if (runningChecks.has(userIdStr)) {
            return;
        }

        const lastCheck = lastCheckMap.get(userIdStr);

        // If we checked within the last 24 hours, skip
        if (lastCheck && now - lastCheck < 24 * 60 * 60 * 1000) {
            return;
        }

        // Lock execution
        runningChecks.add(userIdStr);

        const today = new Date();
        
        // Find all recurring expenses for this user where the next billing date has passed or is today
        const dueExpenses = await RecurringExpense.find({ userId, nextBillingDate: { $lte: today } });

        if (dueExpenses.length > 0) {
            console.log(`[LazyCron] Found ${dueExpenses.length} recurring expenses due for user ${userId}.`);
        }

        for (const recurring of dueExpenses) {
            try {
                const dueDate = new Date(recurring.nextBillingDate);
                const notesStr = `[Auto-Added] ${recurring.type}: ${recurring.name}`;

                // Distributed atomic lock to prevent TOCTOU race conditions across multiple instances
                const lockId = `cron-expense-${recurring._id}-${dueDate.toISOString()}`;
                try {
                    await Lock.create({ _id: lockId });
                } catch (err) {
                    if (err.code === 11000) {
                        console.log(`[LazyCron] Concurrency lock acquired by another process for ${lockId}, skipping.`);
                        continue;
                    }
                    throw err;
                }

                // Idempotency check: verify if we already created an expense for this due date
                const existingExpense = await Expense.findOne({
                    userId: recurring.userId,
                    notes: notesStr,
                    date: dueDate
                });

                if (!existingExpense) {
                    // Create the expense
                    const expense = new Expense({
                        userId: recurring.userId,
                        amount: recurring.amount,
                        currency: recurring.currency,
                        category: recurring.category,
                        date: dueDate, // Date it was actually due
                        notes: notesStr,
                        sourceAssetId: recurring.sourceAssetId || undefined
                    });

                    // Deduct from asset if preferred asset is set
                    if (recurring.sourceAssetId) {
                        const asset = await Asset.findOne({ _id: recurring.sourceAssetId, userId: recurring.userId });
                        if (asset) {
                            const amountToDeduct = await convertAmount(recurring.amount, recurring.currency, asset.currency);
                            asset.value -= amountToDeduct;
                            await asset.save();
                        }
                    }

                    await expense.save();
                }

                // Advance the next billing date
                let nextDate = new Date(dueDate);
                while (nextDate <= today) {
                    if (recurring.frequency === 'yearly') {
                        nextDate.setFullYear(nextDate.getFullYear() + 1);
                    } else if (recurring.frequency === 'weekly') {
                        nextDate.setDate(nextDate.getDate() + 7);
                    } else {
                        nextDate.setMonth(nextDate.getMonth() + 1);
                    }
                }
                
                recurring.nextBillingDate = nextDate;
                await recurring.save();

                console.log(`[LazyCron] Processed ${recurring.name} for user ${recurring.userId}`);
            } catch (err) {
                console.error(`[LazyCron] Failed to process recurring expense ${recurring._id}:`, err);
            }
        }

        // --- Recurring Transfers (Auto-Invest) ---
        const dueTransfers = await RecurringTransfer.find({ userId, nextTransferDate: { $lte: today } });

        if (dueTransfers.length > 0) {
            console.log(`[LazyCron] Found ${dueTransfers.length} recurring transfers due for user ${userId}.`);
        }

        for (const recurring of dueTransfers) {
            try {
                const dueDate = new Date(recurring.nextTransferDate);
                const descStr = `[Auto-Invest] ${recurring.description || ''}`.trim();

                // Distributed atomic lock
                const lockId = `cron-transfer-${recurring._id}-${dueDate.toISOString()}`;
                try {
                    await Lock.create({ _id: lockId });
                } catch (err) {
                    if (err.code === 11000) {
                        console.log(`[LazyCron] Concurrency lock acquired by another process for ${lockId}, skipping.`);
                        continue;
                    }
                    throw err;
                }

                // Idempotency check
                const existingTransfer = await Transfer.findOne({
                    userId: recurring.userId,
                    description: descStr,
                    date: dueDate,
                    sourceAssetId: recurring.sourceAssetId,
                    targetAssetId: recurring.targetAssetId
                });

                if (!existingTransfer) {
                    const sourceAsset = await Asset.findOne({ _id: recurring.sourceAssetId, userId: recurring.userId });
                    const targetAsset = await Asset.findOne({ _id: recurring.targetAssetId, userId: recurring.userId });

                    if (!sourceAsset || !targetAsset) {
                        console.error(`[LazyCron] Failed to process auto-invest ${recurring._id}: Source or Target asset missing.`);
                        continue;
                    }

                    // Convert amount to target currency if currencies are different
                    const converted = await convertAmount(recurring.amount, sourceAsset.currency, targetAsset.currency);

                    // Handle source asset (if investment)
                    if (sourceAsset.category === 'Investments' && sourceAsset.tickerSymbol) {
                        const priceData = await fetchTickerPrice(sourceAsset.tickerSymbol);
                        const livePrice = priceData ? priceData.price : (sourceAsset.purchasePrice || 1);
                        const removedQty = recurring.amount / livePrice;
                        sourceAsset.quantity = Math.max(0, (sourceAsset.quantity || 0) - removedQty);
                    }
                    sourceAsset.value -= recurring.amount;

                    // Handle target asset (if investment)
                    if (targetAsset.category === 'Investments' && targetAsset.tickerSymbol) {
                        const priceData = await fetchTickerPrice(targetAsset.tickerSymbol);
                        const livePrice = priceData ? priceData.price : (targetAsset.purchasePrice || 1);
                        const addedQty = converted / livePrice;
                        const oldQty = targetAsset.quantity || 0;
                        const oldCost = targetAsset.purchasePrice || livePrice;
                        const newQty = oldQty + addedQty;
                        targetAsset.purchasePrice = newQty > 0 ? ((oldQty * oldCost) + converted) / newQty : oldCost;
                        targetAsset.quantity = newQty;
                    }
                    targetAsset.value += converted;

                    await sourceAsset.save();
                    await targetAsset.save();

                    // Create transfer log
                    const transfer = new Transfer({
                        userId: recurring.userId,
                        sourceAssetId: sourceAsset._id,
                        targetAssetId: targetAsset._id,
                        sourceAssetName: sourceAsset.name,
                        targetAssetName: targetAsset.name,
                        amount: recurring.amount,
                        sourceCurrency: sourceAsset.currency,
                        targetCurrency: targetAsset.currency,
                        convertedAmount: converted,
                        date: dueDate,
                        description: descStr
                    });

                    await transfer.save();
                }

                // Advance the next transfer date
                let nextDate = new Date(dueDate);
                while (nextDate <= today) {
                    if (recurring.frequency === 'yearly') {
                        nextDate.setFullYear(nextDate.getFullYear() + 1);
                    } else if (recurring.frequency === 'weekly') {
                        nextDate.setDate(nextDate.getDate() + 7);
                    } else {
                        nextDate.setMonth(nextDate.getMonth() + 1);
                    }
                }
                
                recurring.nextTransferDate = nextDate;
                await recurring.save();

                console.log(`[LazyCron] Processed auto-invest ${recurring._id} for user ${recurring.userId}`);
            } catch (err) {
                console.error(`[LazyCron] Failed to process auto-invest ${recurring._id}:`, err);
            }
        }

        // Update the last check time for this user
        lastCheckMap.set(userIdStr, now);

    } catch (error) {
        console.error(`[LazyCron] Error running lazy recurring processing for user ${userId}:`, error);
    } finally {
        // Always release the lock
        runningChecks.delete(userIdStr);
    }
};
