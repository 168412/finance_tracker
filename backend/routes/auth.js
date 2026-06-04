import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { User } from '../models/User.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// Helper function to generate JWT token
const generateToken = (userId) => {
    return jwt.sign({ userId }, process.env.JWT_SECRET || 'fallback_secret', {
        expiresIn: '7d'
    });
};

// Validate email format
const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

// Validate password strength
const isStrongPassword = (password) => {
    return password.length >= 6;
};

// ========== SIGNUP ROUTE ==========
router.post('/signup', async (req, res) => {
    try {
        const { username, email, password, firstName = '', lastName = '' } = req.body;

        // Validation
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Username, email, and password are required' });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        if (!isStrongPassword(password)) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long' });
        }

        if (username.length < 3) {
            return res.status(400).json({ error: 'Username must be at least 3 characters long' });
        }

        // Check if user already exists
        const existingUser = await User.findOne({
            $or: [{ username: username.toLowerCase() }, { email: email.toLowerCase() }]
        });

        if (existingUser) {
            if (existingUser.username === username.toLowerCase()) {
                return res.status(400).json({ error: 'Username already exists' });
            }
            if (existingUser.email === email.toLowerCase()) {
                return res.status(400).json({ error: 'Email already exists' });
            }
        }

        // Create new user
        const user = new User({
            username: username.toLowerCase(),
            email: email.toLowerCase(),
            password,
            firstName,
            lastName,
            defaultCurrency: defaultCurrency || 'EUR',
            secondaryCurrency: secondaryCurrency || 'INR',
            currencyMode: currencyMode || 'single',
            language: language || 'en'
        });

        await user.save();

        // Generate token
        const token = generateToken(user._id);

        res.status(201).json({
            message: 'User created successfully',
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                defaultCurrency: user.defaultCurrency,
                currencyMode: user.currencyMode,
                secondaryCurrency: user.secondaryCurrency,
                language: user.language
            }
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Error creating user. Please try again.' });
    }
});

// ========== LOGIN ROUTE ==========
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validation
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        // Find user by username or email
        const user = await User.findOne({
            $or: [
                { username: username.toLowerCase() },
                { email: username.toLowerCase() }
            ]
        });

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        // Generate token
        const token = generateToken(user._id);

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                defaultCurrency: user.defaultCurrency,
                currencyMode: user.currencyMode,
                secondaryCurrency: user.secondaryCurrency,
                language: user.language
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Error logging in. Please try again.' });
    }
});

// ========== GET CURRENT USER ROUTE ==========
router.get('/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Error fetching user' });
    }
});

// ========== UPDATE USER PROFILE ROUTE ==========
router.patch('/profile', auth, async (req, res) => {
    try {
        console.log('PATCH /profile req.body:', req.body);
        const { firstName, lastName, defaultCurrency, currencyMode, secondaryCurrency, language } = req.body;

        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const validCurrencies = ['EUR', 'INR', 'USD', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'IDR'];

        if (firstName !== undefined) user.firstName = firstName;
        if (lastName !== undefined) user.lastName = lastName;
        if (defaultCurrency !== undefined) {
            if (!validCurrencies.includes(defaultCurrency)) {
                return res.status(400).json({ error: 'Invalid currency' });
            }
            user.defaultCurrency = defaultCurrency;
        }
        if (currencyMode !== undefined) {
            if (!['single', 'dual'].includes(currencyMode)) {
                return res.status(400).json({ error: 'Invalid currency mode' });
            }
            user.currencyMode = currencyMode;
        }
        if (secondaryCurrency !== undefined) {
            if (!validCurrencies.includes(secondaryCurrency)) {
                return res.status(400).json({ error: 'Invalid secondary currency' });
            }
            user.secondaryCurrency = secondaryCurrency;
        }

        if (language !== undefined) {
            if (!['en', 'es', 'hi', 'fr', 'de', 'id'].includes(language)) {
                return res.status(400).json({ error: 'Invalid language' });
            }
            user.language = language;
        }

        await user.save();

        res.json({
            message: 'Profile updated successfully',
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                defaultCurrency: user.defaultCurrency,
                currencyMode: user.currencyMode,
                secondaryCurrency: user.secondaryCurrency,
                language: user.language
            }
        });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Error updating profile' });
    }
});

// ========== CHANGE PASSWORD ROUTE ==========
router.post('/change-password', auth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current and new passwords are required' });
        }

        if (!isStrongPassword(newPassword)) {
            return res.status(400).json({ error: 'New password must be at least 6 characters long' });
        }

        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check current password
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Update password
        user.password = newPassword;
        await user.save();

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Error changing password' });
    }
});


// ========== FORGOT PASSWORD ROUTE ==========
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            // Return success even if user not found to prevent email enumeration
            return res.json({ message: 'If an account with that email exists, a reset token has been sent.' });
        }

        // Generate a 6-digit OTP token
        const resetToken = Math.floor(100000 + Math.random() * 900000).toString();
        
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
        await user.save();

        // Configure nodemailer transporter
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        // Setup email data
        const mailOptions = {
            from: `"Finance Tracker" <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: 'Password Reset Token',
            text: `You requested a password reset.\n\nYour 6-digit Reset Token is: ${resetToken}\n\nThis token will expire in 1 hour.`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2 style="color: #3b82f6;">Password Reset</h2>
                    <p>You requested a password reset for your Finance Tracker account.</p>
                    <p>Your 6-digit Reset Token is:</p>
                    <h1 style="background-color: #f1f5f9; padding: 10px; border-radius: 8px; display: inline-block;">${resetToken}</h1>
                    <p>This token will expire in 1 hour.</p>
                    <p>If you did not request this, please ignore this email.</p>
                </div>
            `
        };

        // Send email
        await transporter.sendMail(mailOptions);
        console.log(`Password reset email sent to: ${user.email}`);

        res.json({ message: 'If an account with that email exists, a reset token has been sent.' });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Error processing request' });
    }
});

// ========== RESET PASSWORD ROUTE ==========
router.post('/reset-password', async (req, res) => {
    try {
        const { email, token, newPassword } = req.body;
        
        if (!email || !token || !newPassword) {
            return res.status(400).json({ error: 'Email, token, and new password are required' });
        }

        const user = await User.findOne({
            email: email.toLowerCase(),
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ error: 'Password reset token is invalid or has expired.' });
        }

        // Update password (will be hashed by pre-save hook)
        user.password = newPassword;
        user.resetPasswordToken = null;
        user.resetPasswordExpires = null;
        await user.save();

        res.json({ message: 'Password has been reset successfully. You can now log in.' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Error resetting password' });
    }
});


export default router;
