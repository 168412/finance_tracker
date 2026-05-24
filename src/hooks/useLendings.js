import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

export const useLendings = () => {
    const [lendings, setLendings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const loadLendings = async () => {
        try {
            setLoading(true);
            const response = await apiService.getLendings();
            const rawLendings = Array.isArray(response) ? response : (response?.lendings || response?.data || []);
            setLendings(rawLendings.map(l => ({ ...l, id: l._id || l.id })));
            setError(null);
        } catch (err) {
            setError(err.message || 'Failed to load lendings');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadLendings();
    }, []);

    const addLending = async (lending) => {
        try {
            const response = await apiService.createLending(lending);
            const newLending = response?.lending || response?.data || response;
            const formatted = { ...newLending, id: newLending._id || newLending.id };
            setLendings(prev => [...prev, formatted]);
            return formatted;
        } catch (err) {
            setError(err.message || 'Failed to add lending');
            throw err;
        }
    };

    const updateLending = async (id, updatedData) => {
        try {
            const response = await apiService.updateLending(id, updatedData);
            const updated = response?.lending || response?.data || response;
            const formatted = { ...updated, id: updated._id || updated.id };
            setLendings(prev => prev.map(l => l.id === id ? formatted : l));
            return formatted;
        } catch (err) {
            setError(err.message || 'Failed to update lending');
            throw err;
        }
    };

    const deleteLending = async (id) => {
        try {
            await apiService.deleteLending(id);
            setLendings(prev => prev.filter(l => l.id !== id));
        } catch (err) {
            setError(err.message || 'Failed to delete lending');
            throw err;
        }
    };

    return {
        lendings, loading, error, addLending, updateLending, deleteLending, refreshLendings: loadLendings
    };
};