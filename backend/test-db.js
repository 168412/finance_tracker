import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Expense } from './models/Expense.js';

dotenv.config();
mongoose.connect(process.env.MONGODB_URI).then(async () => {
    const expenses = await Expense.find().sort({ createdAt: -1 }).limit(1);
    console.log(expenses);
    process.exit(0);
});
