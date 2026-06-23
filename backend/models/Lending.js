import mongoose from 'mongoose';

const lendingSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'EUR' },
    type: { type: String, enum: ['Given', 'Received'], required: true },
    status: { type: String, enum: ['Pending', 'Settled'], default: 'Pending' },
    date: { type: Date, required: true },
    notes: { type: String },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', default: null },
    expenseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Expense', default: null },
    sourceAssetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', default: null },
    isSettled: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

export const Lending = mongoose.model('Lending', lendingSchema);
