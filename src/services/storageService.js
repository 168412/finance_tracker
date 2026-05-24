import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3002/api',
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 10000,
});

export const storageService = {
    // Assets management
    async getAssets() {
        try {
            const response = await api.get('/assets');
            return response.data;
        } catch (error) {
            console.error('Error getting assets:', error.message);
            // Return empty array as fallback
            return [];
        }
    },

    async addAsset(asset) {
        try {
            const newAsset = {
                ...asset,
                id: Date.now().toString(),
                createdAt: new Date().toISOString(),
            };
            const response = await api.post('/assets', newAsset);
            return response.data;
        } catch (error) {
            console.error('Error adding asset:', error.message);
            throw error;
        }
    },

    async updateAsset(id, updatedAsset) {
        try {
            const response = await api.patch(`/assets/${id}`, updatedAsset);
            return response.data;
        } catch (error) {
            console.error('Error updating asset:', error.message);
            throw error;
        }
    },

    async deleteAsset(id) {
        try {
            await api.delete(`/assets/${id}`);
        } catch (error) {
            console.error('Error deleting asset:', error.message);
            throw error;
        }
    },

    // Expenses management
    async getExpenses() {
        try {
            const response = await api.get('/expenses');
            return response.data;
        } catch (error) {
            console.error('Error getting expenses:', error.message);
            // Return empty array as fallback
            return [];
        }
    },

    async addExpense(expense) {
        try {
            const newExpense = {
                ...expense,
                id: Date.now().toString(),
                createdAt: new Date().toISOString(),
            };
            const response = await api.post('/expenses', newExpense);
            return response.data;
        } catch (error) {
            console.error('Error adding expense:', error.message);
            throw error;
        }
    },

    async updateExpense(id, updatedExpense) {
        try {
            const response = await api.patch(`/expenses/${id}`, updatedExpense);
            return response.data;
        } catch (error) {
            console.error('Error updating expense:', error.message);
            throw error;
        }
    },

    async deleteExpense(id) {
        try {
            await api.delete(`/expenses/${id}`);
        } catch (error) {
            console.error('Error deleting expense:', error.message);
            throw error;
        }
    },

    // Get expenses for current month
    async getMonthlyExpenses() {
        try {
            const expenses = await this.getExpenses();
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();

            return expenses.filter(e => {
                const expenseDate = new Date(e.date);
                return expenseDate.getMonth() === currentMonth && expenseDate.getFullYear() === currentYear;
            });
        } catch (error) {
            console.error('Error getting monthly expenses:', error.message);
            return [];
        }
    },

    // Lendings management
    async getLendings() {
        try {
            const response = await api.get('/lendings');
            return response.data;
        } catch (error) {
            console.error('Error getting lendings:', error.message);
            return [];
        }
    },

    async addLending(lending) {
        try {
            const newLending = {
                ...lending,
                id: Date.now().toString(),
                createdAt: new Date().toISOString(),
            };
            const response = await api.post('/lendings', newLending);
            return response.data;
        } catch (error) {
            console.error('Error adding lending:', error.message);
            throw error;
        }
    },

    async updateLending(id, updatedLending) {
        try {
            const response = await api.patch(`/lendings/${id}`, updatedLending);
            return response.data;
        } catch (error) {
            console.error('Error updating lending:', error.message);
            throw error;
        }
    },

    async deleteLending(id) {
        try {
            await api.delete(`/lendings/${id}`);
        } catch (error) {
            console.error('Error deleting lending:', error.message);
            throw error;
        }
    },

    // Exchange rate management
    async getExchangeRate() {
        try {
            const response = await api.get('/exchangeRate/1');
            return response.data;
        } catch (error) {
            console.error('Error fetching exchange rate:', error.message);
            return { id: '1', rate: 103.5, timestamp: new Date().toISOString() };
        }
    },

    async updateExchangeRate(rate, timestamp) {
        try {
            const response = await api.patch('/exchangeRate/1', {
                rate,
                timestamp,
                lastFetched: new Date().toISOString(),
            });
            return response.data;
        } catch (error) {
            console.error('Error updating exchange rate:', error.message);
            throw error;
        }
    },
};
