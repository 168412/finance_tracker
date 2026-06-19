import mongoose from 'mongoose';

const goalSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    targetAmount: { type: Number, required: true },
    currentAmount: { type: Number, default: 0 },
    currency: { type: String, default: 'EUR' },
    targetDate: { type: Date },
    linkedAssetId: { type: String, default: null },
    createdAt: { type: Date, default: Date.now }
});

export const Goal = mongoose.model('Goal', goalSchema);
