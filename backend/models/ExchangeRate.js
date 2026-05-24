import mongoose from 'mongoose';

const exchangeRateSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    rate: { type: Number, required: true },
    rates: { type: Object, default: {} },
    timestamp: { type: Date, default: Date.now },
    lastFetched: { type: Date, default: Date.now }
});

export const ExchangeRate = mongoose.model('ExchangeRate', exchangeRateSchema);