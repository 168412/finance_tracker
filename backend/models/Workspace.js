import mongoose from 'mongoose';

const workspaceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    members: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    pendingInvites: [{
        email: { type: String, lowercase: true, trim: true },
        invitedAt: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

export const Workspace = mongoose.model('Workspace', workspaceSchema);
