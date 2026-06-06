import express from 'express';
import mongoose from 'mongoose';
import { Workspace } from '../models/Workspace.js';
import { User } from '../models/User.js';
import { Lending } from '../models/Lending.js';
import { auth } from '../middleware/auth.js';
import nodemailer from 'nodemailer';
import { decryptEmail, encryptEmail } from '../utils/encryption.js';

const router = express.Router();
router.use(auth);

// Helper to configure nodemailer
const getTransporter = () => {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
};

// 1. Get all workspaces for the logged in user
router.get('/', async (req, res) => {
    try {
        const workspaces = await Workspace.find({ members: req.userId }).populate('members', 'firstName lastName username email');
        res.json(workspaces);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch workspaces' });
    }
});

// 2. Create a new workspace
router.post('/', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Workspace name is required' });

        const workspace = new Workspace({
            name,
            owner: req.userId,
            members: [req.userId], // owner is automatically a member
            pendingInvites: []
        });

        await workspace.save();
        res.status(201).json(workspace);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create workspace' });
    }
});

// 3. Send an invite to an email
router.post('/:id/invite', async (req, res) => {
    try {
        const { email } = req.body;
        const workspaceId = req.params.id;

        if (!email) return res.status(400).json({ error: 'Email is required' });

        const workspace = await Workspace.findOne({ _id: workspaceId, members: req.userId });
        if (!workspace) return res.status(404).json({ error: 'Workspace not found or unauthorized' });

        // Add to pending invites if not already there
        const emailLower = email.toLowerCase().trim();
        const existingInvite = workspace.pendingInvites.find(inv => inv.email === emailLower);
        if (!existingInvite) {
            workspace.pendingInvites.push({ email: emailLower });
            await workspace.save();
        }

        // Send email
        const transporter = getTransporter();
        const mailOptions = {
            from: `"Finance Tracker" <${process.env.EMAIL_USER}>`,
            to: emailLower,
            subject: `You have been invited to join the "${workspace.name}" Workspace!`,
            text: `Hello!\n\nYou have been invited to join the shared workspace "${workspace.name}" on Finance Tracker.\n\nLogin to your app to accept the invite!`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2 style="color: #3b82f6;">Finance Tracker Invite</h2>
                    <p>Hello!</p>
                    <p>You have been invited to join the shared workspace <strong>${workspace.name}</strong>.</p>
                    <p>Simply open your Finance Tracker app, login, and accept the invite from the popup!</p>
                </div>
            `
        };

        transporter.sendMail(mailOptions).catch(err => console.error('Background email failed:', err.message));
        
        res.json({ message: 'Invite sent successfully', workspace });
    } catch (error) {
        console.error('Invite error:', error);
        res.status(500).json({ error: 'Failed to send invite' });
    }
});

// 4. Get pending invites for the logged-in user
router.get('/invites/pending', async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const decryptedEmail = decryptEmail(user.email).toLowerCase();

        // Find workspaces where pendingInvites contains this email
        const pendingWorkspaces = await Workspace.find({
            'pendingInvites.email': decryptedEmail
        }).populate('owner', 'firstName lastName username');

        res.json(pendingWorkspaces);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch pending invites' });
    }
});

// 5. Accept an invite
router.post('/:id/accept', async (req, res) => {
    try {
        const workspaceId = req.params.id;
        const user = await User.findById(req.userId);
        const decryptedEmail = decryptEmail(user.email).toLowerCase();

        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

        // Check if user is in pending invites
        const inviteIndex = workspace.pendingInvites.findIndex(inv => inv.email === decryptedEmail);
        if (inviteIndex === -1 && !workspace.members.includes(req.userId)) {
            return res.status(403).json({ error: 'You do not have a pending invite for this workspace' });
        }

        // Add user to members
        if (!workspace.members.includes(req.userId)) {
            workspace.members.push(req.userId);
        }

        // Remove from pending invites
        if (inviteIndex !== -1) {
            workspace.pendingInvites.splice(inviteIndex, 1);
        }

        await workspace.save();
        res.json({ message: 'Workspace joined successfully', workspace });
    } catch (error) {
        res.status(500).json({ error: 'Failed to join workspace' });
    }
});

// 6. Reject an invite
router.post('/:id/reject', async (req, res) => {
    try {
        const workspaceId = req.params.id;
        const user = await User.findById(req.userId);
        const decryptedEmail = decryptEmail(user.email).toLowerCase();

        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

        const inviteIndex = workspace.pendingInvites.findIndex(inv => inv.email === decryptedEmail);
        if (inviteIndex !== -1) {
            workspace.pendingInvites.splice(inviteIndex, 1);
            await workspace.save();
        }

        res.json({ message: 'Invite rejected' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to reject invite' });
    }
});

// 7. Leave a workspace
router.post('/:id/leave', async (req, res) => {
    try {
        const workspaceId = req.params.id;
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

        const memberIndex = workspace.members.findIndex(id => String(id) === String(req.userId));
        if (memberIndex === -1) {
            return res.status(400).json({ error: 'You are not a member of this workspace' });
        }

        await Workspace.findByIdAndUpdate(workspaceId, { $pull: { members: req.userId } });
        
        try {
            await Lending.deleteMany({ workspaceId: workspaceId, userId: req.userId });
        } catch (e) {
            console.error('Failed to clean up lending records when leaving workspace:', e);
        }

        res.json({ message: 'Left workspace successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to leave workspace' });
    }
});

// 8. Delete a workspace
router.delete('/:id', async (req, res) => {
    try {
        const workspaceId = req.params.id;
        const workspace = await Workspace.findById(workspaceId);
        
        if (!workspace) return res.status(404).json({ error: 'Workspace not found' });
        
        if (workspace.members.length > 1) {
            return res.status(400).json({ error: 'Cannot delete workspace with active members. Ask them to leave first.' });
        }

        if (String(workspace.owner) !== String(req.userId) && workspace.members.length > 0) {
            if (!workspace.members.some(id => String(id) === String(req.userId))) {
                return res.status(403).json({ error: 'Unauthorized' });
            }
        }

        await Workspace.findByIdAndDelete(workspaceId);
        
        // Delete all associated records
        try {
            await mongoose.model('Expense').deleteMany({ workspaceId });
            await mongoose.model('Budget').deleteMany({ workspaceId });
            await mongoose.model('GroceryItem').deleteMany({ workspaceId });
            
            // Delete lendings that were automatically created for this workspace
            if (workspace.name) {
                await mongoose.model('Lending').deleteMany({ notes: { $regex: workspace.name, $options: 'i' } });
            }
        } catch (cleanupError) {
            console.error('Failed to cleanup workspace associated data:', cleanupError);
        }

        res.json({ message: 'Workspace and all associated records deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete workspace' });
    }
});

export default router;
