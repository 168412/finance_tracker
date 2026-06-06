import mongoose from 'mongoose';

const assetSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', default: null },
    name: { type: String, required: true },
    category: { type: String, required: true },
    value: { type: Number, required: true },
    currency: { type: String, default: 'EUR' },
    createdAt: { type: Date, default: Date.now }
});

export const Asset = mongoose.model('Asset', assetSchema);
