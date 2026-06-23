import mongoose from 'mongoose';

const recurringTransferSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sourceAssetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', required: true },
    targetAssetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'EUR' },
    frequency: { type: String, enum: ['monthly', 'weekly', 'yearly'], default: 'monthly' },
    nextTransferDate: { type: Date, required: true },
    description: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});

export const RecurringTransfer = mongoose.model('RecurringTransfer', recurringTransferSchema);
