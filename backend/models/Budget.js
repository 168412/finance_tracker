import mongoose from 'mongoose';

const budgetSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: String, required: true },
    limitAmount: { type: Number, required: true },
    currency: { type: String, default: 'EUR' },
    period: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
    createdAt: { type: Date, default: Date.now }
});

export const Budget = mongoose.model('Budget', budgetSchema);
