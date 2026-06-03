import { RecurringExpense } from '../models/RecurringExpense.js';
import { Expense } from '../models/Expense.js';
import { Asset } from '../models/Asset.js';

// Map to track the last time we checked for a user (userId -> timestamp)
const lastCheckMap = new Map();

export const evaluateRecurringExpenses = async (userId) => {
    try {
        const now = Date.now();
        const lastCheck = lastCheckMap.get(userId.toString());

        // If we checked within the last 24 hours, skip
        if (lastCheck && now - lastCheck < 24 * 60 * 60 * 1000) {
            return;
        }

        const today = new Date();
        
        // Find all recurring expenses for this user where the next billing date has passed or is today
        const dueExpenses = await RecurringExpense.find({ userId, nextBillingDate: { $lte: today } });

        if (dueExpenses.length > 0) {
            console.log(`[LazyCron] Found ${dueExpenses.length} recurring expenses due for user ${userId}.`);
        }

        for (const recurring of dueExpenses) {
            try {
                // Create the expense
                const expense = new Expense({
                    userId: recurring.userId,
                    amount: recurring.amount,
                    currency: recurring.currency,
                    category: recurring.category,
                    date: recurring.nextBillingDate, // Date it was actually due
                    notes: `[Auto-Added] ${recurring.type}: ${recurring.name}`,
                    sourceAssetId: recurring.sourceAssetId || undefined
                });

                // Deduct from asset if preferred asset is set
                if (recurring.sourceAssetId) {
                    const asset = await Asset.findOne({ _id: recurring.sourceAssetId, userId: recurring.userId });
                    if (asset) {
                        asset.balance -= recurring.amount;
                        await asset.save();
                    }
                }

                await expense.save();

                // Advance the next billing date
                let nextDate = new Date(recurring.nextBillingDate);
                while (nextDate <= today) {
                    if (recurring.frequency === 'yearly') {
                        nextDate.setFullYear(nextDate.getFullYear() + 1);
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

        // Update the last check time for this user
        lastCheckMap.set(userId.toString(), now);

    } catch (error) {
        console.error(`[LazyCron] Error running lazy recurring processing for user ${userId}:`, error);
    }
};
