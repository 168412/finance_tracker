import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });
import { RecurringExpense } from './models/RecurringExpense.js';

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    const res = await RecurringExpense.find({});
    console.log("Success:", res);
  } catch (e) {
    console.error("Error:", e);
  }
  process.exit(0);
}
test();
