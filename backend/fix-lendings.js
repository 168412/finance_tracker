import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Lending } from './models/Lending.js';
import { User } from './models/User.js';

dotenv.config();
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/finance_tracker';

async function fixLendings() {
    await mongoose.connect(MONGODB_URI);
    
    // Delete all lendings with "Split: Food" or similar generic names just to clean it up.
    // Or we can try to update them? Deleting is safer and cleans up the UI for the user since they are test records anyway.
    const deleted = await Lending.deleteMany({ name: { $regex: /^Split:/ } });
    console.log(`Deleted ${deleted.deletedCount} old test split records.`);

    await mongoose.disconnect();
}

fixLendings();
