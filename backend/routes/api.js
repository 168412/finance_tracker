import express from 'express';
import { Asset } from '../models/Asset.js';
import { Expense } from '../models/Expense.js';
import { Lending } from '../models/Lending.js';
import { auth } from '../middleware/auth.js';
import { Workspace } from '../models/Workspace.js';
import { ExchangeRate } from '../models/ExchangeRate.js';
import { RecurringExpense } from '../models/RecurringExpense.js';
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

// --- Expenses ---
router.get('/expenses', async (req, res) => {
    const query = req.query.workspaceId ? { workspaceId: req.query.workspaceId } : { userId: req.userId, $or: [{ workspaceId: null }, { workspaceId: { $exists: false } }] };
    const expenses = await Expense.find(query);
    res.json(expenses.map(formatDoc));
});

router.post('/expenses', async (req, res) => {
    const expenseData = { ...req.body, userId: req.userId };
    
    // Calculate Splitwise logic if it's an equal shared expense
    if (req.body.workspaceId && req.body.splitType === 'equal') {
        try {
            const workspace = await Workspace.findById(req.body.workspaceId);
            if (workspace && workspace.members.length > 1) {
                const numMembers = workspace.members.length;
                const sharePerPerson = req.body.amount / numMembers;
                
                const partners = workspace.members.filter(id => String(id) !== String(req.userId));
                
                for (const partnerId of partners) {
                    // Record that the payer 'Given' money to cover the partner's share
                    const lendingRecord = new Lending({
                        userId: req.userId,
                        name: `Split: ${req.body.category || 'Expense'}`,
                        type: 'Given',
                        amount: sharePerPerson,
                        currency: req.body.currency || 'EUR',
                        date: req.body.date || new Date(),
                        notes: `Equal split from ${workspace.name} workspace.`
                    });
                    await lendingRecord.save();

                    // Record that the partner 'Received' (borrowed) money for their share
                    const partnerLendingRecord = new Lending({
                        userId: partnerId,
                        name: `Split: ${req.body.category || 'Expense'}`,
                        type: 'Received',
                        amount: sharePerPerson,
                        currency: req.body.currency || 'EUR',
                        date: req.body.date || new Date(),
                        notes: `Equal split from ${workspace.name} workspace.`
                    });
                    await partnerLendingRecord.save();
                }
            }
        } catch (error) {
            console.error('Failed to create split lending records:', error);
        }
    }

    const expense = new Expense(expenseData);
    await expense.save();

    if (expense.sourceAssetId) {
        try {
            const assetQuery = { _id: expense.sourceAssetId, userId: req.userId };
            const asset = await Asset.findOne(assetQuery);
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
