import mongoose from 'mongoose';

const groceryItemSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    isPurchased: {
        type: Boolean,
        default: false
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    workspaceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Workspace',
        default: null
    }
}, { timestamps: true });

export const GroceryItem = mongoose.model('GroceryItem', groceryItemSchema);
