import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    notes: { type: String },
    amount: { type: Number, required: true },
    category: { type: String, required: true },
    date: { type: Date, required: true },
    currency: { type: String, default: 'EUR' },
    sourceAssetId: { type: String },
    items: [{
        id: String,
        name: String,
        price: Number
    }],
    createdAt: { type: Date, default: Date.now }
});

export const Expense = mongoose.model('Expense', expenseSchema);
