import express from 'express';
import { Asset } from '../models/Asset.js';
import { Expense } from '../models/Expense.js';
import { Lending } from '../models/Lending.js';
import { auth } from '../middleware/auth.js';
import { ExchangeRate } from '../models/ExchangeRate.js';

const router = express.Router();

router.use(auth); // Protect all API routes

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

// --- Expenses ---
router.get('/expenses', async (req, res) => {
    const expenses = await Expense.find({ userId: req.userId });
    res.json(expenses.map(formatDoc));
});

router.post('/expenses', async (req, res) => {
    const expense = new Expense({ ...req.body, userId: req.userId });
    await expense.save();

    if (expense.sourceAssetId) {
        try {
            const asset = await Asset.findOne({ _id: expense.sourceAssetId, userId: req.userId });
            if (asset) {
                const amountToDeduct = await convertAmount(expense.amount, expense.currency, asset.currency);
                asset.value -= amountToDeduct;
                await asset.save();
            }
        } catch (e) {
            console.error('Failed to update asset on POST', e);
        }
    }

    res.status(201).json(formatDoc(expense));
});

router.patch('/expenses/:id', async (req, res) => {
    const oldExpense = await Expense.findOne({ _id: req.params.id, userId: req.userId });
    if (!oldExpense) return res.status(404).send();

    const expense = await Expense.findOneAndUpdate({ _id: req.params.id, userId: req.userId }, req.body, { new: true });
    if (!expense) return res.status(404).send();

    // Check if any financial field changed
    const amountChanged = oldExpense.amount !== expense.amount;
    const currencyChanged = oldExpense.currency !== expense.currency;
    const assetChanged = String(oldExpense.sourceAssetId || '') !== String(expense.sourceAssetId || '');

    if (amountChanged || currencyChanged || assetChanged) {
        // Revert old expense deduction
        if (oldExpense.sourceAssetId) {
            try {
                const oldAsset = await Asset.findOne({ _id: oldExpense.sourceAssetId, userId: req.userId });
                if (oldAsset) {
                    const amountToAdd = await convertAmount(oldExpense.amount, oldExpense.currency, oldAsset.currency);
                    oldAsset.value += amountToAdd;
                    await oldAsset.save();
                }
            } catch (e) {}
        }

        // Apply new expense deduction
        if (expense.sourceAssetId) {
            try {
                const newAsset = await Asset.findOne({ _id: expense.sourceAssetId, userId: req.userId });
                if (newAsset) {
                    const amountToDeduct = await convertAmount(expense.amount, expense.currency, newAsset.currency);
                    newAsset.value -= amountToDeduct;
                    await newAsset.save();
                }
            } catch (e) {}
        }
    }

    res.json(formatDoc(expense));
});

router.delete('/expenses/:id', async (req, res) => {
    const expense = await Expense.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!expense) return res.status(404).send();

    if (expense.sourceAssetId) {
        try {
            const asset = await Asset.findOne({ _id: expense.sourceAssetId, userId: req.userId });
            if (asset) {
                const amountToAdd = await convertAmount(expense.amount, expense.currency, asset.currency);
                asset.value += amountToAdd;
                await asset.save();
            }
        } catch (e) {}
    }

    res.status(204).send();
});

// --- Lendings ---
router.get('/lendings', async (req, res) => {
    const lendings = await Lending.find({ userId: req.userId });
    res.json(lendings.map(formatDoc));
});

router.post('/lendings', async (req, res) => {
    const lending = new Lending({ ...req.body, userId: req.userId });
    await lending.save();
    res.status(201).json(formatDoc(lending));
});

router.patch('/lendings/:id', async (req, res) => {
    const lending = await Lending.findOneAndUpdate({ _id: req.params.id, userId: req.userId }, req.body, { new: true });
    if (!lending) return res.status(404).send();
    res.json(formatDoc(lending));
});

router.delete('/lendings/:id', async (req, res) => {
    const lending = await Lending.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!lending) return res.status(404).send();
    res.status(204).send();
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

export default router;
