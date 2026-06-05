import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default_secret_key_must_be_32_b!'; // Must be 32 bytes
const IV = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest().slice(0, 16); // Static IV for deterministic encryption

export const encryptEmail = (text) => {
    if (!text) return text;
    try {
        const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)), IV);
        let encrypted = cipher.update(text.toLowerCase().trim());
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return encrypted.toString('hex');
    } catch (e) {
        console.error('Encryption error:', e);
        return text;
    }
};

export const decryptEmail = (text) => {
    if (!text) return text;
    // If it's not a hex string or doesn't look encrypted, return as is (to handle existing unencrypted DBs gracefully)
    if (!/^[0-9a-fA-F]+$/.test(text) || text.length < 32) return text;
    
    try {
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)), IV);
        let decrypted = decipher.update(Buffer.from(text, 'hex'));
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (e) {
        // If decryption fails, it might be an unencrypted legacy email
        return text;
    }
};
