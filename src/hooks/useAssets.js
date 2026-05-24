import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

export const useAssets = () => {
    const [assets, setAssets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const loadAssets = async () => {
        try {
            setLoading(true);
            const response = await apiService.getAssets();
            const rawAssets = Array.isArray(response) ? response : (response?.assets || response?.data || []);
            setAssets(rawAssets.map(a => ({ ...a, id: a._id || a.id })));
            setError(null);
        } catch (err) {
            setError(err.message || 'Failed to load assets');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Load assets on mount
    useEffect(() => {
        loadAssets();
    }, []);

    const addAsset = async (asset) => {
        try {
            const response = await apiService.createAsset(asset);
            const newAsset = response?.asset || response?.data || response;
            const formatted = { ...newAsset, id: newAsset._id || newAsset.id };
            setAssets([...assets, formatted]);
            return formatted;
        } catch (err) {
            setError(err.message || 'Failed to add asset');
            console.error(err);
            throw err;
        }
    };

    const updateAsset = async (id, updatedAsset) => {
        try {
            const response = await apiService.updateAsset(id, updatedAsset);
            const returnedAsset = response?.asset || response?.data || response;
            const formatted = { ...returnedAsset, id: returnedAsset._id || returnedAsset.id };
            setAssets(assets.map(a => a.id === id ? { ...a, ...formatted } : a));
            return formatted;
        } catch (err) {
            setError(err.message || 'Failed to update asset');
            console.error(err);
            throw err;
        }
    };

    const deleteAsset = async (id) => {
        try {
            await apiService.deleteAsset(id);
            setAssets(assets.filter(a => a.id !== id));
        } catch (err) {
            setError(err.message || 'Failed to delete asset');
            console.error(err);
            throw err;
        }
    };

    return { assets, loading, error, addAsset, updateAsset, deleteAsset, refreshAssets: loadAssets };
};
