import mongoose from 'mongoose';

const recurringExpenseSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'EUR' },
    frequency: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
    category: { type: String, required: true },
    nextBillingDate: { type: Date, required: true },
    type: { type: String, enum: ['Bill', 'Subscription'], default: 'Subscription' },
    sourceAssetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', required: false },
    createdAt: { type: Date, default: Date.now }
});

export const RecurringExpense = mongoose.model('RecurringExpense', recurringExpenseSchema);
