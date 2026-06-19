import mongoose from 'mongoose';

const transferSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sourceAssetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', required: true },
    targetAssetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', required: true },
    sourceAssetName: { type: String, required: true },
    targetAssetName: { type: String, required: true },
    amount: { type: Number, required: true },
    sourceCurrency: { type: String, required: true },
    targetCurrency: { type: String, required: true },
    convertedAmount: { type: Number, required: true },
    date: { type: Date, required: true },
    description: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now }
});

export const Transfer = mongoose.model('Transfer', transferSchema);
