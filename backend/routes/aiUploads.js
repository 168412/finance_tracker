import express from 'express';
import multer from 'multer';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { auth } from '../middleware/auth.js';
import fs from 'fs';

const router = express.Router();
// Multer saves incoming files to a temporary 'uploads/' directory
const upload = multer({ dest: 'uploads/' });

// Universal AI Helper for Text & Vision
async function generateAIContent(prompt, imagePath = null, mimeType = null) {
    const provider = process.env.AI_PROVIDER?.toLowerCase() || 'gemini';
    const imageBase64 = imagePath ? Buffer.from(fs.readFileSync(imagePath)).toString("base64") : null;

    if (provider === 'ollama') {
        const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
        const modelName = imageBase64
            ? (process.env.OLLAMA_VISION_MODEL || 'llava')
            : (process.env.OLLAMA_TEXT_MODEL || 'gemma2');

        const payload = { model: modelName, prompt: prompt, stream: false };
        if (imageBase64) payload.images = [imageBase64];

        const response = await fetch(`${baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error(`Ollama error: ${response.statusText}`);
        const data = await response.json();
        return data.response;
    } else {
        // Default to Gemini
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
        const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-2.5-flash" });

        const parts = [prompt];
        if (imageBase64 && mimeType) {
            parts.push({ inlineData: { data: imageBase64, mimeType } });
        }

        const result = await model.generateContent(parts);
        return result.response.text();
    }
}

router.use(auth); // Protect all AI upload endpoints

// 1. Auto-Categorize text note
router.post('/categorize', async (req, res) => {
    try {
        if (process.env.ENABLE_AI !== 'true') return res.status(403).json({ error: 'AI features are disabled' });

        const { note, categories } = req.body;
        const prompt = `Categorize this expense note into exactly one of these categories: ${categories.join(', ')}. Note: "${note}". Respond ONLY with the exact category name.`;

        const responseText = await generateAIContent(prompt);
        const category = responseText.trim();

        res.json({ category });
    } catch (error) {
        console.error('Categorize error:', error);
        res.status(500).json({ error: 'Failed to categorize expense' });
    }
});

// 2. Scan Receipt Image/PDF
router.post('/scan-receipt', upload.single('receipt'), async (req, res) => {
    try {
        if (process.env.ENABLE_AI !== 'true') return res.status(403).json({ error: 'AI features are disabled' });
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const categories = JSON.parse(req.body.categories || '[]');

        const prompt = `Analyze this receipt. Extract the total amount, currency (e.g. EUR, USD, INR), date (YYYY-MM-DD), merchant name/notes, and categorize it into one of these: ${categories.join(', ')}. If it is a grocery or retail bill with individual items, extract the list of items purchased as well with their name and price. Respond ONLY with a valid JSON object like this: {"amount": 25.50, "currency": "EUR", "date": "2024-03-15", "category": "Grocery", "notes": "Walmart", "items": [{"name": "Milk", "price": "2.50"}, {"name": "Bread", "price": "1.50"}]}`;

        let responseText = await generateAIContent(prompt, req.file.path, req.file.mimetype);
        responseText = responseText.trim();

        // Clean potential Markdown markdown formatting
        if (responseText.startsWith('```json')) responseText = responseText.replace(/```json\n?/, '').replace(/```\n?$/, '');

        const parsed = JSON.parse(responseText);
        fs.unlinkSync(req.file.path); // Delete the temporary file
        res.json(parsed);
    } catch (error) {
        console.error('Scan receipt error:', error);
        if (req.file) fs.unlinkSync(req.file.path); // Clean up on fail
        res.status(500).json({ error: 'Failed to scan receipt' });
    }
});

// 3. Scan Statement PDF/Image
router.post('/scan-statement', upload.single('statement'), async (req, res) => {
    try {
        if (process.env.ENABLE_AI !== 'true') return res.status(403).json({ error: 'AI features are disabled' });
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const categories = JSON.parse(req.body.categories || '[]');

        const prompt = `Analyze this bank/credit card statement. Extract all expense transactions (ignore income/deposits). Categorize each expense into one of these: ${categories.join(', ')}. Respond ONLY with a valid JSON array of objects inside an "expenses" key, like this: {"expenses": [{"amount": 15.99, "currency": "EUR", "date": "2024-03-01", "category": "Food", "notes": "McDonalds"}]}`;

        let responseText = await generateAIContent(prompt, req.file.path, req.file.mimetype);
        responseText = responseText.trim();
        if (responseText.startsWith('```json')) responseText = responseText.replace(/```json\n?/, '').replace(/```\n?$/, '');

        const parsed = JSON.parse(responseText);
        fs.unlinkSync(req.file.path); // Delete the temporary file
        res.json(parsed);
    } catch (error) {
        console.error('Scan statement error:', error);
        if (req.file) fs.unlinkSync(req.file.path); // Clean up on fail
        res.status(500).json({ error: 'Failed to scan statement' });
    }
});

export default router;