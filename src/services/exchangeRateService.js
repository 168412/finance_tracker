// Exchange Rate Service - Fetch EUR to INR conversion using backend
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';

const getHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
};

console.log('[exchangeRateService] Using API_URL:', API_URL);

export const exchangeRateService = {
    async fetchExchangeRate(forceRefresh = false) {
        try {
            const url = forceRefresh ? `${API_URL}/exchangeRate/1?refresh=true` : `${API_URL}/exchangeRate/1`;
            const response = await fetch(url, { headers: getHeaders() });

            if (!response.ok) throw new Error('Failed to fetch exchange rate');

            const data = await response.json();
            return { rate: data.rate, rates: data.rates, timestamp: data.timestamp };
        } catch (error) {
            console.error('Error in exchange rate service:', error);
            return { rate: 103.5, rates: { EUR: 103.5, USD: 83.2, GBP: 105.1 }, timestamp: new Date().toISOString(), error: true };
        }
    },

    async getCachedRate() {
        // Always fetch fresh data - don't use cache
        return this.fetchExchangeRate(true);
    },

    async getOrFetchRate() {
        // Always fetch fresh data on initial load
        return this.fetchExchangeRate(true);
    },
};