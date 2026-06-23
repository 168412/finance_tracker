import express from 'express';
import { Asset } from '../models/Asset.js';
import { Expense } from '../models/Expense.js';
import { Lending } from '../models/Lending.js';
import { PriceCache } from '../models/PriceCache.js';
import { Transfer } from '../models/Transfer.js';
import { Goal } from '../models/Goal.js';
import { auth } from '../middleware/auth.js';

import { Workspace } from '../models/Workspace.js';
import { User } from '../models/User.js';
import { ExchangeRate } from '../models/ExchangeRate.js';
import { RecurringExpense } from '../models/RecurringExpense.js';
import { RecurringTransfer } from '../models/RecurringTransfer.js';
import { Budget } from '../models/Budget.js';
import { evaluateRecurringExpenses } from '../services/cronService.js';
import multer from 'multer';
import ExcelJS from 'exceljs';

const router = express.Router();

router.use(auth); // Protect all API routes

// Lazy evaluation of recurring expenses
router.use(async (req, res, next) => {
    if (req.method === 'GET' && req.userId) {
        // Run lazy evaluation in the background to not delay the API response significantly
        evaluateRecurringExpenses(req.userId).catch(console.error);
    }
    next();
});

// Middleware to check workspace access if workspaceId is provided
const checkWorkspaceAccess = async (req, res, next) => {
    if (req.query.workspaceId || req.body.workspaceId) {
        const wid = req.query.workspaceId || req.body.workspaceId;
        try {
            const workspace = await Workspace.findOne({ _id: wid, members: req.userId });
            if (!workspace) return res.status(403).json({ error: 'Unauthorized workspace access' });
        } catch (e) {
            return res.status(400).json({ error: 'Invalid workspace ID' });
        }
    }
    next();
};

router.use(checkWorkspaceAccess);

// Helper to format ID
const formatDoc = (doc) => ({ ...doc.toObject(), id: doc._id.toString(), _id: undefined, userId: undefined, __v: undefined });

// Helper to convert currency
const convertAmount = async (amount, fromCur, toCur) => {
    if (!fromCur || !toCur || fromCur === toCur) return amount;
    const rateDoc = await ExchangeRate.findOne({ id: '1' });
    const rates = rateDoc && rateDoc.rates ? rateDoc.rates : { EUR: 1, USD: 1.08, GBP: 0.85, INR: 90 };
    const rateFrom = fromCur === 'EUR' ? 1 : (rates[fromCur] || 1);
    const rateTo = toCur === 'EUR' ? 1 : (rates[toCur] || 1);
    return amount * (rateTo / rateFrom);
};

// --- Assets ---
router.get('/assets', async (req, res) => {
    const assets = await Asset.find({ userId: req.userId });
    res.json(assets.map(formatDoc));
});

router.post('/assets', async (req, res) => {
    const asset = new Asset({ ...req.body, userId: req.userId });
    await asset.save();
    res.status(201).json(formatDoc(asset));
});

router.patch('/assets/:id', async (req, res) => {
    const asset = await Asset.findOneAndUpdate({ _id: req.params.id, userId: req.userId }, req.body, { new: true });
    if (!asset) return res.status(404).send();
    res.json(formatDoc(asset));
});

router.delete('/assets/:id', async (req, res) => {
    const asset = await Asset.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!asset) return res.status(404).send();
    res.status(204).send();
});

export const fetchTickerPrice = async (ticker, forceRefresh = false) => {
    if (!ticker) return null;
    const now = Date.now();

    if (!forceRefresh) {
        try {
            const cacheEntry = await PriceCache.findOne({ ticker });
            // Check cache (24 hours = 86400000 ms)
            if (cacheEntry && now - new Date(cacheEntry.updatedAt).getTime() < 86400000) {
                return {
                    price: cacheEntry.price,
                    name: cacheEntry.name,
                    currency: cacheEntry.currency
                };
            }
        } catch (e) {
            console.error('Failed to read price cache from DB:', e);
        }
    }

    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/json'
            }
        });
        if (!response.ok) {
            console.error(`Yahoo Finance returned ${response.status} for ${ticker}`);
            return null;
        }
        
        const data = await response.json();
        const meta = data?.chart?.result?.[0]?.meta;
        if (meta && meta.regularMarketPrice) {
            const priceData = {
                price: meta.regularMarketPrice,
                name: meta.longName || meta.shortName || ticker,
                currency: meta.currency
            };
            
            try {
                await PriceCache.findOneAndUpdate(
                    { ticker },
                    { ticker, price: priceData.price, name: priceData.name, currency: priceData.currency, updatedAt: new Date() },
                    { upsert: true, new: true }
                );
            } catch (e) {
                console.error('Failed to save price cache to DB:', e);
            }
            return priceData;
        }
    } catch (error) {
        console.error(`Failed to fetch price for ${ticker}:`, error);
    }
    return null;
};

router.post('/assets/prices', async (req, res) => {
    const { tickers, forceRefresh } = req.body;
    if (!tickers || !Array.isArray(tickers)) {
        return res.status(400).json({ error: 'Tickers array is required' });
    }

    const results = {};
    for (const ticker of tickers) {
        results[ticker] = await fetchTickerPrice(ticker, forceRefresh);
    }

    res.json(results);
});

router.get('/assets/search-ticker', async (req, res) => {
    const { q } = req.query;
    if (!q || q.length < 2) {
        return res.json([]);
    }
    
    try {
        const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=5&newsCount=0`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            console.error(`Yahoo Search returned ${response.status}`);
            return res.status(500).json({ error: 'Failed to search tickers' });
        }
        
        const data = await response.json();
        const quotes = data?.quotes || [];
        
        const results = quotes
            .filter(quote => quote.quoteType === 'ETF' || quote.quoteType === 'MUTUALFUND' || quote.quoteType === 'EQUITY' || quote.quoteType === 'CRYPTOCURRENCY')
            .map(quote => ({
                symbol: quote.symbol,
                name: quote.shortname || quote.longname || quote.symbol,
                exchange: quote.exchDisp,
                type: quote.quoteType
            }));
            
        res.json(results);
    } catch (error) {
        console.error('Ticker search error:', error);
        res.status(500).json({ error: 'Failed to search tickers' });
    }
});

// --- Asset Transfers ---
router.post('/assets/transfer', async (req, res) => {
    const { sourceAssetId, targetAssetId, amount, description, date } = req.body;
    if (!sourceAssetId || !targetAssetId || !amount) {
        return res.status(400).json({ error: 'Source asset, target asset, and amount are required' });
    }

    const amtNum = parseFloat(amount);
    if (isNaN(amtNum) || amtNum <= 0) {
        return res.status(400).json({ error: 'Amount must be a positive number' });
    }

    if (sourceAssetId === targetAssetId) {
        return res.status(400).json({ error: 'Source and target assets must be different' });
    }

    try {
        const sourceAsset = await Asset.findOne({ _id: sourceAssetId, userId: req.userId });
        const targetAsset = await Asset.findOne({ _id: targetAssetId, userId: req.userId });

        if (!sourceAsset || !targetAsset) {
            return res.status(404).json({ error: 'Source or target asset not found' });
        }

        // Convert amount to target currency if currencies are different
        const converted = await convertAmount(amtNum, sourceAsset.currency, targetAsset.currency);

        // Handle source asset (if investment)
        if (sourceAsset.category === 'Investments' && sourceAsset.tickerSymbol) {
            const priceData = await fetchTickerPrice(sourceAsset.tickerSymbol);
            const livePrice = priceData ? priceData.price : (sourceAsset.purchasePrice || 1);
            const removedQty = amtNum / livePrice;
            sourceAsset.quantity = Math.max(0, (sourceAsset.quantity || 0) - removedQty);
        }
        sourceAsset.value -= amtNum;

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
            userId: req.userId,
            sourceAssetId: sourceAsset._id,
            targetAssetId: targetAsset._id,
            sourceAssetName: sourceAsset.name,
            targetAssetName: targetAsset.name,
            amount: amtNum,
            sourceCurrency: sourceAsset.currency,
            targetCurrency: targetAsset.currency,
            convertedAmount: converted,
            date: date ? new Date(date) : new Date(),
            description: description || ''
        });

        await transfer.save();

        res.status(201).json(formatDoc(transfer));
    } catch (e) {
        console.error('Transfer failed:', e);
        res.status(500).json({ error: 'Transfer failed' });
    }
});

router.get('/assets/transfers', async (req, res) => {
    try {
        const transfers = await Transfer.find({ userId: req.userId }).sort({ date: -1 });
        res.json(transfers.map(formatDoc));
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch transfers' });
    }
});

router.delete('/assets/transfers/:id', async (req, res) => {
    try {
        const transfer = await Transfer.findOne({ _id: req.params.id, userId: req.userId });
        if (!transfer) return res.status(404).json({ error: 'Transfer not found' });

        const sourceAsset = await Asset.findOne({ _id: transfer.sourceAssetId, userId: req.userId });
        const targetAsset = await Asset.findOne({ _id: transfer.targetAssetId, userId: req.userId });

        if (sourceAsset) {
            if (sourceAsset.category === 'Investments' && sourceAsset.tickerSymbol) {
                const priceData = await fetchTickerPrice(sourceAsset.tickerSymbol);
                const livePrice = priceData ? priceData.price : (sourceAsset.purchasePrice || 1);
                const addedBackQty = transfer.amount / livePrice;
                const oldQty = sourceAsset.quantity || 0;
                const oldCost = sourceAsset.purchasePrice || livePrice;
                const newQty = oldQty + addedBackQty;
                sourceAsset.purchasePrice = newQty > 0 ? ((oldQty * oldCost) + transfer.amount) / newQty : oldCost;
                sourceAsset.quantity = newQty;
            }
            sourceAsset.value += transfer.amount;
            await sourceAsset.save();
        }
        if (targetAsset) {
            if (targetAsset.category === 'Investments' && targetAsset.tickerSymbol) {
                const priceData = await fetchTickerPrice(targetAsset.tickerSymbol);
                const livePrice = priceData ? priceData.price : (targetAsset.purchasePrice || 1);
                const removedQty = transfer.convertedAmount / livePrice;
                targetAsset.quantity = Math.max(0, (targetAsset.quantity || 0) - removedQty);
            }
            targetAsset.value -= transfer.convertedAmount;
            await targetAsset.save();
        }

        await Transfer.deleteOne({ _id: transfer._id });
        res.status(204).send();
    } catch (e) {
        console.error('Failed to revert transfer:', e);
        res.status(500).json({ error: 'Failed to revert transfer' });
    }
});

// --- Savings Goals ---
router.get('/goals', async (req, res) => {
    try {
        const goals = await Goal.find({ userId: req.userId });
        res.json(goals.map(formatDoc));
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch goals' });
    }
});

router.post('/goals', async (req, res) => {
    const { name, targetAmount, currentAmount, currency, targetDate, linkedAssetId } = req.body;
    if (!name || !targetAmount) {
        return res.status(400).json({ error: 'Name and target amount are required' });
    }
    try {
        const goal = new Goal({
            userId: req.userId,
            name,
            targetAmount: parseFloat(targetAmount),
            currentAmount: currentAmount ? parseFloat(currentAmount) : 0,
            currency: currency || 'EUR',
            targetDate: targetDate ? new Date(targetDate) : undefined,
            linkedAssetId: linkedAssetId || null
        });
        await goal.save();
        res.status(201).json(formatDoc(goal));
    } catch (e) {
        res.status(500).json({ error: 'Failed to create goal' });
    }
});

router.patch('/goals/:id', async (req, res) => {
    try {
        const goal = await Goal.findOneAndUpdate(
            { _id: req.params.id, userId: req.userId },
            req.body,
            { new: true }
        );
        if (!goal) return res.status(404).json({ error: 'Goal not found' });
        res.json(formatDoc(goal));
    } catch (e) {
        res.status(500).json({ error: 'Failed to update goal' });
    }
});

router.delete('/goals/:id', async (req, res) => {
    try {
        const result = await Goal.deleteOne({ _id: req.params.id, userId: req.userId });
        if (result.deletedCount === 0) return res.status(404).json({ error: 'Goal not found' });
        res.status(204).send();
    } catch (e) {
        res.status(500).json({ error: 'Failed to delete goal' });
    }
});

// --- Expenses ---

router.get('/expenses', async (req, res) => {
    const query = req.query.workspaceId ? { workspaceId: req.query.workspaceId } : { userId: req.userId, $or: [{ workspaceId: null }, { workspaceId: { $exists: false } }] };
    const expenses = await Expense.find(query);
    res.json(expenses.map(formatDoc));
});

router.post('/expenses', async (req, res) => {
    const expenseData = { ...req.body, userId: req.userId };
    
    const expense = new Expense(expenseData);
    await expense.save();

    // Calculate Splitwise logic if it's an equal shared expense
    if (req.body.workspaceId && req.body.splitType === 'equal') {
        try {
            const workspace = await Workspace.findById(req.body.workspaceId);
            if (workspace && workspace.members.length > 1) {
                const numMembers = workspace.members.length;
                const sharePerPerson = req.body.amount / numMembers;
                
                const partners = workspace.members.filter(id => String(id) !== String(req.userId));
                
                const payer = await User.findById(req.userId);
                
                for (const partnerId of partners) {
                    const partner = await User.findById(partnerId);
                    if (!partner) continue;

                    // Record that the payer 'Given' money to cover the partner's share
                    const lendingRecord = new Lending({
                        userId: req.userId,
                        name: partner.firstName || partner.username || partner.email || 'Workspace Member',
                        type: 'Given',
                        amount: sharePerPerson,
                        currency: req.body.currency || 'EUR',
                        date: req.body.date || new Date(),
                        notes: `Equal split from ${workspace.name} workspace.`,
                        workspaceId: workspace._id,
                        expenseId: expense._id
                    });
                    await lendingRecord.save();

                    // Record that the partner 'Received' (borrowed) money for their share
                    const partnerLendingRecord = new Lending({
                        userId: partnerId,
                        name: payer.firstName || payer.username || payer.email || 'Workspace Member',
                        type: 'Received',
                        amount: sharePerPerson,
                        currency: req.body.currency || 'EUR',
                        date: req.body.date || new Date(),
                        notes: `Equal split from ${workspace.name} workspace.`,
                        workspaceId: workspace._id,
                        expenseId: expense._id
                    });
                    await partnerLendingRecord.save();
                }
            }
        } catch (error) {
            console.error('Failed to create split lending records:', error);
        }
    }

    if (expense.sourceAssetId) {
        try {
            const assetQuery = { _id: expense.sourceAssetId, userId: req.userId };
            const asset = await Asset.findOne(assetQuery);
            if (asset) {
                const amountToDeduct = await convertAmount(expense.amount, expense.currency, asset.currency);
                await Asset.updateOne(assetQuery, { $inc: { value: -amountToDeduct } });
            }
        } catch (e) {
            console.error('Failed to update asset on POST', e);
        }
    }

    res.status(201).json(formatDoc(expense));
});

router.patch('/expenses/:id', async (req, res) => {
    let oldExpense = await Expense.findOne({ _id: req.params.id });
    if (!oldExpense) return res.status(404).send();

    let hasAccess = String(oldExpense.userId) === String(req.userId);
    if (!hasAccess && oldExpense.workspaceId) {
        const workspace = await Workspace.findById(oldExpense.workspaceId);
        if (workspace && workspace.members.some(id => String(id) === String(req.userId))) {
            hasAccess = true;
        }
    }
    if (!hasAccess) return res.status(403).json({ error: "Unauthorized" });

    const expense = await Expense.findOneAndUpdate({ _id: req.params.id }, req.body, { new: true });
    if (!expense) return res.status(404).send();
    if (!expense) return res.status(404).send();

    // Check if any financial field changed
    const amountChanged = oldExpense.amount !== expense.amount;
    const currencyChanged = oldExpense.currency !== expense.currency;
    const assetChanged = String(oldExpense.sourceAssetId || '') !== String(expense.sourceAssetId || '');

    if (amountChanged || currencyChanged || assetChanged) {
        // Revert old expense deduction
        if (oldExpense.sourceAssetId) {
            try {
                const oldAsset = await Asset.findOne({ _id: oldExpense.sourceAssetId, userId: oldExpense.userId });
                if (oldAsset) {
                    const amountToAdd = await convertAmount(oldExpense.amount, oldExpense.currency, oldAsset.currency);
                    await Asset.updateOne({ _id: oldAsset._id }, { $inc: { value: amountToAdd } });
                }
            } catch (e) {}
        }

        // Apply new expense deduction
        if (expense.sourceAssetId) {
            try {
                const newAsset = await Asset.findOne({ _id: expense.sourceAssetId, userId: expense.userId });
                if (newAsset) {
                    const amountToDeduct = await convertAmount(expense.amount, expense.currency, newAsset.currency);
                    await Asset.updateOne({ _id: newAsset._id }, { $inc: { value: -amountToDeduct } });
                }
            } catch (e) {}
        }
    }

    res.json(formatDoc(expense));
});

router.delete('/expenses/:id', async (req, res) => {
    let expense = await Expense.findOne({ _id: req.params.id });
    if (!expense) return res.status(404).send();

    let hasAccess = String(expense.userId) === String(req.userId);
    if (!hasAccess && expense.workspaceId) {
        const workspace = await Workspace.findById(expense.workspaceId);
        if (workspace && workspace.members.some(id => String(id) === String(req.userId))) {
            hasAccess = true;
        }
    }
    if (!hasAccess) return res.status(403).json({ error: "Unauthorized" });

    await Expense.findByIdAndDelete(expense._id);

    if (expense.sourceAssetId) {
        try {
            const asset = await Asset.findOne({ _id: expense.sourceAssetId, userId: expense.userId });
            if (asset) {
                const amountToAdd = await convertAmount(expense.amount, expense.currency, asset.currency);
                await Asset.updateOne({ _id: asset._id }, { $inc: { value: amountToAdd } });
            }
        } catch (e) {}
    }

    // Delete any associated split lending records
    try {
        await Lending.deleteMany({ expenseId: req.params.id });
    } catch (e) {
        console.error('Failed to delete associated lending records:', e);
    }

    res.status(204).send();
});

// --- Lendings ---
router.get('/lendings', async (req, res) => {
    const lendings = await Lending.find({ userId: req.userId });
    res.json(lendings.map(formatDoc));
});

router.post('/lendings', async (req, res) => {
    try {
        const lending = new Lending({ ...req.body, userId: req.userId });
        
        if (lending.sourceAssetId) {
            try {
                const asset = await Asset.findOne({ _id: lending.sourceAssetId, userId: lending.userId });
                if (asset) {
                    const convertedAmount = await convertAmount(lending.amount, lending.currency, asset.currency);
                    const modifier = lending.type === 'Given' ? -1 : 1;
                    await Asset.updateOne({ _id: asset._id }, { $inc: { value: convertedAmount * modifier } });
                }
            } catch (e) {
                console.error('Failed to update asset on POST lending', e);
            }
        }
        
        await lending.save();
        res.status(201).json(formatDoc(lending));
    } catch (e) {
        res.status(500).json({ error: 'Failed to create lending' });
    }
});

router.patch('/lendings/:id', async (req, res) => {
    try {
        let oldLending = await Lending.findOne({ _id: req.params.id, userId: req.userId });
        if (!oldLending) return res.status(404).send();

        const lending = await Lending.findOneAndUpdate({ _id: req.params.id, userId: req.userId }, req.body, { new: true });
        if (!lending) return res.status(404).send();

        const amountChanged = oldLending.amount !== lending.amount;
        const currencyChanged = oldLending.currency !== lending.currency;
        const assetChanged = String(oldLending.sourceAssetId || '') !== String(lending.sourceAssetId || '');
        const typeChanged = oldLending.type !== lending.type;

        if (amountChanged || currencyChanged || assetChanged || typeChanged) {
            if (oldLending.sourceAssetId) {
                try {
                    const oldAsset = await Asset.findOne({ _id: oldLending.sourceAssetId, userId: req.userId });
                    if (oldAsset) {
                        const amountToRevert = await convertAmount(oldLending.amount, oldLending.currency, oldAsset.currency);
                        const revertModifier = oldLending.type === 'Given' ? 1 : -1;
                        await Asset.updateOne({ _id: oldAsset._id }, { $inc: { value: amountToRevert * revertModifier } });
                    }
                } catch (e) {}
            }
            if (lending.sourceAssetId) {
                try {
                    const newAsset = await Asset.findOne({ _id: lending.sourceAssetId, userId: req.userId });
                    if (newAsset) {
                        const amountToApply = await convertAmount(lending.amount, lending.currency, newAsset.currency);
                        const applyModifier = lending.type === 'Given' ? -1 : 1;
                        await Asset.updateOne({ _id: newAsset._id }, { $inc: { value: amountToApply * applyModifier } });
                    }
                } catch (e) {}
            }
        }
        res.json(formatDoc(lending));
    } catch (e) {
        res.status(500).json({ error: 'Failed to update lending' });
    }
});

router.delete('/lendings/:id', async (req, res) => {
    try {
        const lending = await Lending.findOne({ _id: req.params.id, userId: req.userId });
        if (!lending) return res.status(404).send();

        if (lending.sourceAssetId) {
            try {
                const asset = await Asset.findOne({ _id: lending.sourceAssetId, userId: req.userId });
                if (asset) {
                    const amountToRevert = await convertAmount(lending.amount, lending.currency, asset.currency);
                    const revertModifier = lending.type === 'Given' ? 1 : -1;
                    await Asset.updateOne({ _id: asset._id }, { $inc: { value: amountToRevert * revertModifier } });
                }
            } catch (e) {}
        }

        await Lending.deleteOne({ _id: lending._id });
        res.status(204).send();
    } catch (e) {
        res.status(500).json({ error: 'Failed to delete lending' });
    }
});

router.post('/lendings/settle/:name', async (req, res) => {
    try {
        const { targetAssetId, netBalance, currency } = req.body;

        // Apply net balance to target asset if specified
        if (targetAssetId && netBalance !== 0) {
            try {
                const asset = await Asset.findOne({ _id: targetAssetId, userId: req.userId });
                if (asset) {
                    const amountToApply = await convertAmount(netBalance, currency || 'EUR', asset.currency);
                    await Asset.updateOne({ _id: asset._id }, { $inc: { value: amountToApply } });
                }
            } catch (e) {
                console.error('Failed to apply net balance to asset during settle', e);
            }
        }

        // Mark current user's records of the partner as settled instead of deleting
        await Lending.updateMany({ userId: req.userId, name: req.params.name }, { $set: { isSettled: true } });

        // Try to find the partner user by the name string
        const partnerName = req.params.name;
        const partner = await User.findOne({
            $or: [
                { firstName: partnerName },
                { username: partnerName },
                { email: partnerName }
            ]
        });

        if (partner) {
            const me = await User.findById(req.userId);
            if (me) {
                // Mark partner's records of the current user as settled
                const myNames = [me.firstName, me.username, me.email, 'Workspace Member'].filter(Boolean);
                await Lending.updateMany(
                    { userId: partner._id, name: { $in: myNames } },
                    { $set: { isSettled: true } }
                );
            }
        }

        res.status(200).json({ message: 'Settled successfully' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to settle lendings' });
    }
});

router.get('/exchangeRate/:id', async (req, res) => {
    try {
        const forceRefresh = req.query.refresh === 'true';
        let rateDoc = await ExchangeRate.findOne({ id: req.params.id });

        const CACHE_DURATION = 3600000; // 1 hour
        const now = new Date().getTime();
        const lastFetchedTime = rateDoc ? new Date(rateDoc.lastFetched || rateDoc.timestamp).getTime() : 0;

        // Fetch from Frankfurter if forcing refresh, no data exists, or cache expired
        if (!rateDoc || forceRefresh || (now - lastFetchedTime > CACHE_DURATION)) {
            try {
                const response = await fetch('https://api.frankfurter.dev/v1/latest?base=EUR&symbols=INR,USD,GBP,JPY,CAD,AUD,CHF,CNY,IDR');
                if (response.ok) {
                    const parsedData = await response.json();
                    const baseRates = parsedData.rates;
                    const rate = baseRates.INR;
                    const rates = {
                        ...baseRates,
                        EUR: 1
                    };
                    const timestamp = new Date().toISOString();

                    rateDoc = await ExchangeRate.findOneAndUpdate(
                        { id: req.params.id },
                        { rate, rates, timestamp, lastFetched: timestamp },
                        { new: true, upsert: true }
                    );
                }
            } catch (fetchError) {
                console.error('Failed to fetch from Frankfurter API:', fetchError);
                // Fail silently and fallback to sending the stale rateDoc below
            }
        }

        if (!rateDoc) {
            return res.json({ id: req.params.id, rate: 103.5, rates: { EUR: 103.5, USD: 83.2, GBP: 105.1 }, timestamp: new Date().toISOString() });
        }

        res.json({ id: rateDoc.id, rate: rateDoc.rate, rates: rateDoc.rates, timestamp: rateDoc.timestamp, lastFetched: rateDoc.lastFetched });
    } catch (error) {
        res.status(500).json({ error: 'Failed to handle exchange rate' });
    }
});

// Endpoint to fetch exchange rates from Frankfurter API (server-side to avoid CORS issues)
router.get('/exchangeRate/fetch/latest', async (req, res) => {
    try {
        const response = await fetch('https://api.frankfurter.dev/v1/latest?base=EUR&symbols=INR,USD,GBP,JPY,CAD,AUD,CHF,CNY');
        if (!response.ok) {
            throw new Error(`Frankfurter API error: ${response.statusText}`);
        }
        const data = await response.json();
        const baseRates = data.rates;
        const rate = baseRates.INR;
        const rates = {
            ...baseRates,
            EUR: 1
        };
        res.json({ rate, rates, timestamp: new Date().toISOString() });
    } catch (error) {
        console.error('Error fetching from Frankfurter API:', error);
        res.status(500).json({ error: 'Failed to fetch exchange rate from Frankfurter API', details: error.message });
    }
});

// --- Recurring Expenses ---
router.get('/recurring', async (req, res) => {
    try {
        const recurring = await RecurringExpense.find({ userId: req.userId });
        res.json(recurring.map(formatDoc));
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch recurring expenses' });
    }
});

router.post('/recurring', async (req, res) => {
    try {
        const recurring = new RecurringExpense({ ...req.body, userId: req.userId });
        await recurring.save();
        res.status(201).json(formatDoc(recurring));
    } catch (error) {
        res.status(500).json({ error: 'Failed to create recurring expense' });
    }
});

router.put('/recurring/:id', async (req, res) => {
    try {
        const recurring = await RecurringExpense.findOneAndUpdate({ _id: req.params.id, userId: req.userId }, req.body, { new: true });
        if (recurring) res.json(formatDoc(recurring));
        else res.status(404).json({ error: 'Recurring expense not found' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update recurring expense' });
    }
});

router.delete('/recurring/:id', async (req, res) => {
    try {
        await RecurringExpense.findOneAndDelete({ _id: req.params.id, userId: req.userId });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete recurring expense' });
    }
});

// --- Recurring Transfers (Auto-Invest) ---
router.get('/recurring-transfers', async (req, res) => {
    try {
        const transfers = await RecurringTransfer.find({ userId: req.userId });
        res.json(transfers.map(formatDoc));
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch recurring transfers' });
    }
});

router.post('/recurring-transfers', async (req, res) => {
    try {
        const { id, _id, ...bodyData } = req.body;
        const transfer = new RecurringTransfer({ ...bodyData, userId: req.userId });
        await transfer.save();
        res.status(201).json(formatDoc(transfer));
    } catch (error) {
        console.error('Failed to create recurring transfer:', error);
        res.status(500).json({ error: 'Failed to create recurring transfer' });
    }
});

router.put('/recurring-transfers/:id', async (req, res) => {
    try {
        const transfer = await RecurringTransfer.findOneAndUpdate({ _id: req.params.id, userId: req.userId }, req.body, { new: true });
        if (transfer) res.json(formatDoc(transfer));
        else res.status(404).json({ error: 'Recurring transfer not found' });
    } catch (error) {
        console.error('Failed to update recurring transfer:', error);
        res.status(500).json({ error: 'Failed to update recurring transfer' });
    }
});

router.delete('/recurring-transfers/:id', async (req, res) => {
    try {
        await RecurringTransfer.findOneAndDelete({ _id: req.params.id, userId: req.userId });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete recurring transfer' });
    }
});

// --- Budgets ---
router.get('/budgets', async (req, res) => {
    try {
        const query = req.query.workspaceId ? { workspaceId: req.query.workspaceId } : { userId: req.userId, $or: [{ workspaceId: null }, { workspaceId: { $exists: false } }] };
        const budgets = await Budget.find(query);
        res.json(budgets.map(formatDoc));
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch budgets' });
    }
});

router.post('/budgets', async (req, res) => {
    try {
        const budget = new Budget({ ...req.body, userId: req.userId });
        await budget.save();
        res.status(201).json(formatDoc(budget));
    } catch (error) {
        res.status(500).json({ error: 'Failed to create budget' });
    }
});

router.put('/budgets/:id', async (req, res) => {
    try {
        const budget = await Budget.findOneAndUpdate({ _id: req.params.id, userId: req.userId }, req.body, { new: true });
        if (budget) res.json(formatDoc(budget));
        else res.status(404).json({ error: 'Budget not found' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update budget' });
    }
});

router.delete('/budgets/:id', async (req, res) => {
    try {
        await Budget.findOneAndDelete({ _id: req.params.id, userId: req.userId });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete budget' });
    }
});

// --- Data Export ---
router.get('/export', async (req, res) => {
    try {
        const expenses = await Expense.find({ userId: req.userId });
        const assets = await Asset.find({ userId: req.userId });
        const lendings = await Lending.find({ userId: req.userId });

        const workbook = new ExcelJS.Workbook();
        
        const styleSheet = (ws, columns, data) => {
            ws.columns = columns;
            
            // Add Data
            data.forEach(row => ws.addRow(row));
            
            // Style Header Row
            const headerRow = ws.getRow(1);
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } }; // Blue
            headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
            
            // Style Type column
            ws.eachRow((row, rowNumber) => {
                if (rowNumber > 1) {
                    row.getCell(1).font = { bold: true, color: { argb: 'FF4F46E5' } }; // Indigo
                }
            });
            
            ws.columns.forEach(column => { column.width = 20; });
        };

        const wsExpenses = workbook.addWorksheet('Expenses');
        styleSheet(wsExpenses, [
            { header: 'Type', key: 'type' },
            { header: 'Category', key: 'category' },
            { header: 'Amount', key: 'amount' },
            { header: 'Currency', key: 'currency' },
            { header: 'Date', key: 'date' },
            { header: 'Notes', key: 'notes' }
        ], expenses.map(e => ({
            type: 'Expense',
            category: e.category,
            amount: e.amount,
            currency: e.currency,
            date: e.date ? e.date.toISOString().split('T')[0] : '',
            notes: e.notes || ''
        })));

        const wsAssets = workbook.addWorksheet('Assets');
        styleSheet(wsAssets, [
            { header: 'Type', key: 'type' },
            { header: 'Name', key: 'name' },
            { header: 'Category', key: 'category' },
            { header: 'Amount', key: 'amount' },
            { header: 'Currency', key: 'currency' }
        ], assets.map(a => ({
            type: 'Asset',
            name: a.name,
            category: a.category,
            amount: a.value,
            currency: a.currency
        })));

        const wsLendings = workbook.addWorksheet('Lending');
        styleSheet(wsLendings, [
            { header: 'Type', key: 'type' },
            { header: 'Name', key: 'name' },
            { header: 'LendingType', key: 'lendingType' },
            { header: 'Amount', key: 'amount' },
            { header: 'Currency', key: 'currency' },
            { header: 'Date', key: 'date' },
            { header: 'Notes', key: 'notes' }
        ], lendings.map(l => ({
            type: 'Lending',
            name: l.name,
            lendingType: l.type,
            amount: l.amount,
            currency: l.currency,
            date: l.date ? new Date(l.date).toISOString().split('T')[0] : '',
            notes: l.description || ''
        })));

        const buf = await workbook.xlsx.writeBuffer();

        res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.attachment('finance_export.xlsx');
        res.send(buf);
    } catch (error) {
        console.error('Error generating export:', error);
        res.status(500).json({ error: 'Failed to generate export' });
    }
});

export default router;
