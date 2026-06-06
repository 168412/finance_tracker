import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import apiRoutes from './routes/api.js';
import aiRoutes from './routes/ai.js';
import aiUploadsRoutes from './routes/aiUploads.js';
import groceriesRoutes from './routes/groceries.js';
import workspacesRoutes from './routes/workspaces.js';

dotenv.config({ path: '../.env' }); // Load .env from root

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Connect to MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('MongoDB connected');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

connectDB();

app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);
app.use('/api', aiRoutes);
app.use('/api', aiUploadsRoutes);
app.use('/api/groceries', groceriesRoutes);
app.use('/api/workspaces', workspacesRoutes);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
