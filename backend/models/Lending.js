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
    createdAt: { type: Date, default: Date.now }
});

export const Lending = mongoose.model('Lending', lendingSchema);
