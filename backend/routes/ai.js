import express from 'express';
import { auth } from '../middleware/auth.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = express.Router();

const getLanguageName = (code) => {
    const map = {
        'en': 'English',
        'es': 'Spanish',
        'hi': 'Hindi',
        'fr': 'French',
        'de': 'German',
        'id': 'Indonesian'
    };
    return map[code?.split('-')[0]] || 'English';
};


router.use(auth);

// Universal AI Helper for Text Generation
async function generateAIText(prompt) {
    const provider = process.env.AI_PROVIDER?.toLowerCase() || 'gemini';

    if (provider === 'ollama') {
        const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
        const modelName = process.env.OLLAMA_TEXT_MODEL || 'gemma2';

        const response = await fetch(`${baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: modelName, prompt: prompt, stream: false })
        });

        if (!response.ok) throw new Error(`Ollama error: ${response.statusText}`);
        const data = await response.json();
        return data.response;
    } else {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
        const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-2.5-flash" });
        
        let result;
        let retries = 3;
        while (retries > 0) {
            try {
                result = await model.generateContent(prompt);
                break;
            } catch (error) {
                if (error.status === 503 && retries > 1) {
                    console.log(`Gemini 503 error, retrying... (${retries - 1} attempts left)`);
                    retries--;
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } else {
                    throw error;
                }
            }
        }
        return result.response.text();
    }
}

// Middleware to check if AI is enabled
const checkAIEnabled = (req, res, next) => {
    if (process.env.ENABLE_AI !== 'true') {
        return res.status(403).json({
            error: 'AI features are disabled.',
            aiEnabled: false
        });
    }
    next();
};

router.get('/ai-status', checkAIEnabled, async (req, res) => {
    res.json({ aiEnabled: true });
});

router.post('/insights', checkAIEnabled, async (req, res) => {
    try {
        const { expenses, assets, currentMonth, userLanguage } = req.body;
        console.log("Language received:", userLanguage);
        const prompt = `Analyze these expenses and assets for ${currentMonth}. Provide 3 brief, actionable financial insights. 
        Expenses: ${JSON.stringify(expenses)}
        Assets: ${JSON.stringify(assets)}
        IMPORTANT: You MUST reply entirely in ${getLanguageName(userLanguage)}.
        Respond ONLY with a valid JSON array of strings. Format: ["Insight 1", "Insight 2", "Insight 3"]`;

        let responseText = await generateAIText(prompt);
        if (responseText.startsWith('```json')) responseText = responseText.replace(/```json\n?/, '').replace(/```\n?$/, '');

        const insights = JSON.parse(responseText.trim());

        res.json({ insights, aiEnabled: true });
    } catch (error) {
        console.error('Error generating insights:', error);
        res.status(500).json({ error: 'Failed to generate insights' });
    }
});

router.post('/chat', checkAIEnabled, async (req, res) => {
    try {
        const { message, expenses, assets, currentMonth, history, userLanguage } = req.body;
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        console.log("Chat language received:", userLanguage);
        const prompt = `You are a helpful personal finance AI assistant answering questions about the user's spending.
        Context - Month: ${currentMonth} | Expenses: ${JSON.stringify(expenses)} | Assets: ${JSON.stringify(assets)}
        Conversation History: ${JSON.stringify(history)}
        IMPORTANT: You MUST reply entirely in ${getLanguageName(userLanguage)}.
        User Message: "${message}"
        Provide a helpful, conversational, and concise response.`;

        const reply = await generateAIText(prompt);

        res.json({ reply, aiEnabled: true });
    } catch (error) {
        console.error('Error in chat:', error);
        res.status(500).json({ error: 'Failed to process chat message' });
    }
});

router.post('/budget-planner', checkAIEnabled, async (req, res) => {
    try {
        const { expenses, userLanguage } = req.body;
        
        // Group expenses by category and calculate monthly average over the last 3 months
        const now = new Date();
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(now.getMonth() - 3);
        
        const recentExpenses = expenses.filter(e => new Date(e.date) >= threeMonthsAgo);
        const categoryTotals = {};
        
        recentExpenses.forEach(e => {
            if (!categoryTotals[e.category]) categoryTotals[e.category] = 0;
            categoryTotals[e.category] += e.amount;
        });
        
        const categoryAverages = Object.keys(categoryTotals).map(cat => ({
            category: cat,
            avgMonthlySpend: Math.round(categoryTotals[cat] / 3)
        }));

        const prompt = `You are a financial AI assistant. Analyze these monthly average spending patterns based on the last 3 months: ${JSON.stringify(categoryAverages)}.
        Suggest a reasonable monthly budget limit for each category.
        Provide a short reason for each suggestion in ${getLanguageName(userLanguage)}.
        IMPORTANT: Respond ONLY with a valid JSON array. Do not wrap it in markdown code blocks.
        Format:
        [
          {
            "category": "Food",
            "avgMonthlySpend": 450,
            "suggestedBudget": 400,
            "reason": "You spend a bit high on food, try cooking more."
          }
        ]`;

        let responseText = await generateAIText(prompt);
        if (responseText.startsWith('```json')) responseText = responseText.replace(/```json\n?/, '').replace(/```\n?$/, '');
        
        const suggestions = JSON.parse(responseText.trim());
        res.json({ suggestions, aiEnabled: true });
    } catch (error) {
        console.error('Error generating budget planner suggestions:', error);
        res.status(500).json({ error: 'Failed to generate budget suggestions' });
    }
});

export default router;
