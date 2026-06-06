import express from 'express';
import { GroceryItem } from '../models/GroceryItem.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(auth);

// Get all grocery items for the user
router.get('/', async (req, res) => {
    try {
        const query = req.query.workspaceId 
            ? { workspaceId: req.query.workspaceId } 
            : { user: req.userId, $or: [{ workspaceId: null }, { workspaceId: { $exists: false } }] };
            
        const items = await GroceryItem.find(query).sort({ createdAt: -1 });
        res.json(items);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch grocery list' });
    }
});

// Create a new grocery item
router.post('/', async (req, res) => {
    try {
        const { name, workspaceId } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Item name is required' });
        }

        const item = new GroceryItem({
            name,
            user: req.userId,
            workspaceId: workspaceId || null,
            isPurchased: false
        });

        await item.save();
        res.status(201).json(item);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create grocery item' });
    }
});

// Update a grocery item (e.g. toggle isPurchased, or change name)
router.patch('/:id', async (req, res) => {
    try {
        const { isPurchased, name } = req.body;
        
        const item = await GroceryItem.findOne({ _id: req.params.id, user: req.userId });
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }

        if (isPurchased !== undefined) item.isPurchased = isPurchased;
        if (name !== undefined) item.name = name;

        await item.save();
        res.json(item);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update item' });
    }
});

// Delete a grocery item
router.delete('/:id', async (req, res) => {
    try {
        const item = await GroceryItem.findOneAndDelete({ _id: req.params.id, user: req.userId });
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }
        res.json({ message: 'Item deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete item' });
    }
});

export default router;
