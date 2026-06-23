import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    notes: { type: String },
    amount: { type: Number, required: true },
    category: { type: String, required: true },
    date: { type: Date, required: true },
    currency: { type: String, default: 'EUR' },
    description: { type: String, trim: true },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', default: null },
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    splitType: { type: String, enum: ['none', 'equal'], default: 'none' },
    splits: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        amount: { type: Number, required: true }
    }],
    sourceAssetId: { type: String },
    items: [{
        id: String,
        name: String,
        price: Number
    }],
    tickerSymbol: { type: String, default: null },
    quantity: { type: Number, default: null },
    purchasePrice: { type: Number, default: null },
    createdAt: { type: Date, default: Date.now }
});

export const Expense = mongoose.model('Expense', expenseSchema);
