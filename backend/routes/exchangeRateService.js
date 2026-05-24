// Exchange Rate Service - Fetch EUR to INR conversion using local JSON server
const API_URL = import.meta.env.VITE_API_URL || '';

const getHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
};

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
        return this.fetchExchangeRate();
    },

    async getOrFetchRate() {
        return this.fetchExchangeRate();
    },
};