import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { User } from '../models/User.js';
import bcrypt from 'bcryptjs';
import { Asset } from '../models/Asset.js';
import { Expense } from '../models/Expense.js';
import { Budget } from '../models/Budget.js';
import { Lending } from '../models/Lending.js';
import { RecurringExpense } from '../models/RecurringExpense.js';
import { encryptEmail, decryptEmail } from '../utils/encryption.js';
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
        const { 
            username, email, password, firstName = '', lastName = '',
            defaultCurrency, secondaryCurrency, currencyMode, language 
        } = req.body;

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
        const encryptedEmail = encryptEmail(email.toLowerCase());
        const existingUser = await User.findOne({
            $or: [
                { username: username.toLowerCase() }, 
                { email: encryptedEmail },
                { email: email.toLowerCase() }
            ]
        });

        if (existingUser) {
            if (existingUser.email === encryptedEmail || existingUser.email === email.toLowerCase()) {
                return res.status(400).json({ error: 'You are already registered, you can reset your password.' });
            }
            if (existingUser.username === username.toLowerCase()) {
                return res.status(400).json({ error: 'Username already exists' });
            }
        }

        // Create new user
        // Stateless Registration Token
        const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();
        const hashedOtp = await bcrypt.hash(verificationToken, 10);
        
        const registrationToken = jwt.sign({
            userData: {
                username: username.toLowerCase(),
                email: email.toLowerCase(),
                password,
                firstName,
                lastName,
                defaultCurrency: defaultCurrency || 'EUR',
                secondaryCurrency: secondaryCurrency || 'INR',
                currencyMode: currencyMode || 'single',
                language: language || 'en'
            },
            otpHash: hashedOtp
        }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '1h' });

        // Configure nodemailer transporter
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        const mailOptions = {
            from: `"Finance Tracker" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Verify your email address',
            text: `Welcome to Finance Tracker!\n\nYour 6-digit Email Verification Code is: ${verificationToken}\n\nThis token will expire in 1 hour.`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2 style="color: #3b82f6;">Welcome to Finance Tracker!</h2>
                    <p>Please verify your email address to get started.</p>
                    <p>Your 6-digit Verification Code is:</p>
                    <h1 style="background-color: #f1f5f9; padding: 10px; border-radius: 8px; display: inline-block;">${verificationToken}</h1>
                    <p>This code will expire in 1 hour.</p>
                </div>
            `
        };

        // Send email (swallow error in dev if credentials not set)
        try {
            await transporter.sendMail(mailOptions);
            console.log(`Verification email sent to: ${email}`);
        } catch (e) {
            console.log(`[DEVELOPMENT ONLY] Verification Requested for ${email}`);
            console.log(`Verification Token/OTP: ${verificationToken}`);
        }

        res.status(201).json({
            message: 'Registration initiated. Please verify your email.',
            requiresVerification: true,
            registrationToken,
            email
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
        const encryptedEmail = encryptEmail(username.toLowerCase());
        console.log(`[LOGIN ATTEMPT] username: ${username.toLowerCase()}, encrypted: ${encryptedEmail}`);
        const user = await User.findOne({
            $or: [
                { username: username.toLowerCase() },
                { email: encryptedEmail },
                { email: username.toLowerCase() } // For legacy unencrypted emails!
            ]
        });

        if (!user) {
            console.log(`[LOGIN FAILED] User not found for: ${username}`);
            return res.status(401).json({ error: 'Username or password is wrong' });
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            console.log(`[LOGIN FAILED] Password mismatch for user: ${user.username}`);
            return res.status(401).json({ error: 'Username or password is wrong' });
        }

        // Check verification (allow legacy users who don't have a token)
        if (user.isEmailVerified === false && user.emailVerificationToken) {
            return res.status(403).json({ error: 'Please verify your email to log in.', requiresVerification: true });
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
                email: decryptEmail(user.email),
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
        const userObj = user.toObject();
        userObj.email = decryptEmail(userObj.email);
        res.json(userObj);
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
                email: decryptEmail(user.email),
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

        const encryptedEmail = encryptEmail(email.toLowerCase());
        const user = await User.findOne({ email: encryptedEmail });
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
            to: decryptEmail(user.email),
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
        console.log(`Password reset email sent to: ${decryptEmail(user.email)}`);

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

        const encryptedEmail = encryptEmail(email.toLowerCase());
        const user = await User.findOne({
            email: encryptedEmail,
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



// ========== VERIFY EMAIL ROUTE ==========
router.post('/verify-email', async (req, res) => {
    try {
        const { registrationToken, token } = req.body;
        
        if (!registrationToken || !token) {
            return res.status(400).json({ error: 'Registration token and OTP are required' });
        }

        let decoded;
        try {
            decoded = jwt.verify(registrationToken, process.env.JWT_SECRET || 'fallback_secret');
        } catch (e) {
            return res.status(400).json({ error: 'Registration session expired or invalid. Please sign up again.' });
        }

        const isMatch = await bcrypt.compare(token, decoded.otpHash);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid verification code.' });
        }

        const { userData } = decoded;
        const encryptedEmail = encryptEmail(userData.email);

        // Check again to avoid race conditions
        const existingUser = await User.findOne({
            $or: [{ username: userData.username }, { email: encryptedEmail }]
        });

        if (existingUser) {
            return res.status(400).json({ error: 'User already registered during verification process.' });
        }

        // Create the verified user
        const user = new User({
            ...userData,
            email: encryptedEmail,
            isEmailVerified: true,
            lastLogin: new Date()
        });

        // userData already contains plain password, pre-save hook will hash it!
        await user.save();

        const jwtToken = generateToken(user._id);

        res.json({
            message: 'Email verified successfully',
            token: jwtToken,
            user: {
                id: user._id,
                username: user.username,
                email: decryptEmail(user.email),
                firstName: user.firstName,
                lastName: user.lastName,
                defaultCurrency: user.defaultCurrency,
                currencyMode: user.currencyMode,
                secondaryCurrency: user.secondaryCurrency,
                language: user.language
            }
        });
    } catch (error) {
        console.error('Verify email error:', error);
        res.status(500).json({ error: 'Error verifying email' });
    }
});

// ========== RESEND VERIFICATION ROUTE ==========
router.post('/resend-verification', async (req, res) => {
    try {
        const { registrationToken } = req.body;
        if (!registrationToken) return res.status(400).json({ error: 'Registration token is required' });

        let decoded;
        try {
            decoded = jwt.verify(registrationToken, process.env.JWT_SECRET || 'fallback_secret', { ignoreExpiration: true });
        } catch (e) {
            return res.status(400).json({ error: 'Invalid registration session' });
        }

        // Generate a new 6-digit OTP
        const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();
        const hashedOtp = await bcrypt.hash(verificationToken, 10);
        
        const newRegistrationToken = jwt.sign({
            userData: decoded.userData,
            otpHash: hashedOtp
        }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '1h' });

        // Configure nodemailer transporter
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        const email = decoded.userData.email;

        const mailOptions = {
            from: `"Finance Tracker" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Verify your email address',
            text: `Here is your new verification code: ${verificationToken}

This token will expire in 1 hour.`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2 style="color: #3b82f6;">Finance Tracker Verification</h2>
                    <p>Here is your new 6-digit Verification Code:</p>
                    <h1 style="background-color: #f1f5f9; padding: 10px; border-radius: 8px; display: inline-block;">${verificationToken}</h1>
                    <p>This code will expire in 1 hour.</p>
                </div>
            `
        };

        try {
            await transporter.sendMail(mailOptions);
        } catch (e) {
            console.log(`[DEVELOPMENT ONLY] Resend Verification Requested for ${email}`);
            console.log(`Verification Token/OTP: ${verificationToken}`);
        }

        res.json({ message: 'Verification code sent.', registrationToken: newRegistrationToken });
    } catch (error) {
        console.error('Resend verification error:', error);
        res.status(500).json({ error: 'Error sending verification code' });
    }
});



// ========== DELETE ACCOUNT ROUTE ==========
router.delete('/account', auth, async (req, res) => {
    try {
        const userId = req.userId;
        
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Cascading Deletes
        await Promise.all([
            Asset.deleteMany({ user: userId }),
            Expense.deleteMany({ user: userId }),
            Budget.deleteMany({ user: userId }),
            Lending.deleteMany({ user: userId }),
            RecurringExpense.deleteMany({ user: userId })
        ]);

        await User.findByIdAndDelete(userId);

        res.json({ message: 'Account and all associated data deleted successfully' });
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({ error: 'Error deleting account' });
    }
});

export default router;
