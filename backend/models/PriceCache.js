import mongoose from 'mongoose';

const priceCacheSchema = new mongoose.Schema({
    ticker: { type: String, required: true, unique: true },
    price: { type: Number, required: true },
    name: { type: String },
    currency: { type: String },
    updatedAt: { type: Date, default: Date.now }
});

export const PriceCache = mongoose.model('PriceCache', priceCacheSchema);
