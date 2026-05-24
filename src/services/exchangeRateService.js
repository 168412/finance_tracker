// Exchange Rate Service - Fetch EUR to INR conversion using local JSON server
const API_URL = import.meta.env.VITE_API_URL || '';
const CACHE_DURATION = 3600000; // 1 hour in milliseconds

const getHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
};

export const exchangeRateService = {
    async fetchExchangeRate(forceRefresh = false) {
        try {
            if (!forceRefresh) {
                const dbResponse = await fetch(`${API_URL}/exchangeRate/1`, { headers: getHeaders() });
                if (dbResponse.ok) {
                    const contentType = dbResponse.headers.get("content-type");
                    if (contentType && contentType.indexOf("application/json") !== -1) {
                        const cachedData = await dbResponse.json();
                        const now = new Date().getTime();
                        const lastFetchedTime = new Date(cachedData.lastFetched || cachedData.timestamp).getTime();

                        if (now - lastFetchedTime < CACHE_DURATION) {
                            console.log("Using cached exchange rate from db.json");
                            return { rate: cachedData.rate, rates: cachedData.rates, timestamp: cachedData.timestamp };
                        }
                    }
                }
            }

            console.log("Cache expired or manual refresh requested. Fetching fresh rate from Frankfurter API...");
            // Fetch directly from Frankfurter API (it supports CORS natively)
            const apiUrl = 'https://api.frankfurter.app/latest?from=EUR&to=INR,USD,GBP,JPY,CAD,AUD,CHF,CNY';

            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error('Failed to fetch exchange rate');

            const parsedData = await response.json();

            const baseRates = parsedData.rates;
            const rate = baseRates.INR;
            const rates = {
                EUR: baseRates.INR,
                USD: baseRates.INR / baseRates.USD,
                GBP: baseRates.INR / baseRates.GBP,
                CAD: baseRates.INR / baseRates.CAD,
                AUD: baseRates.INR / baseRates.AUD,
                CHF: baseRates.INR / baseRates.CHF,
                JPY: baseRates.INR / baseRates.JPY,
                CNY: baseRates.INR / baseRates.CNY,
            };
            const timestamp = new Date().toISOString();

            // Save to local database
            await fetch(`${API_URL}/exchangeRate/1`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', ...getHeaders() },
                body: JSON.stringify({
                    rate,
                    rates,
                    timestamp,
                    lastFetched: timestamp,
                }),
            });

            return { rate, rates, timestamp };
        } catch (error) {
            console.warn('Error fetching from API:', error);
            // Return current rate from local database (fallback)
            try {
                const response = await fetch(`${API_URL}/exchangeRate/1`, { headers: getHeaders() });
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.indexOf("application/json") !== -1) {
                    const data = await response.json();
                    return { rate: data.rate, rates: data.rates, timestamp: data.timestamp || new Date().toISOString() };
                }
                throw new Error("Invalid content type");
            } catch (dbError) {
                console.error('Error reading from database:', dbError);
                // Last resort fallback
                return { rate: 103.5, rates: { EUR: 103.5, USD: 83.2, GBP: 105.1 }, timestamp: new Date().toISOString(), error: true };
            }
        }
    },

    async getCachedRate() {
        try {
            const response = await fetch(`${API_URL}/exchangeRate/1`, { headers: getHeaders() });
            if (!response.ok) return null;

            // Ensure response is actually JSON and not an HTML fallback
            const contentType = response.headers.get("content-type");
            if (!contentType || contentType.indexOf("application/json") === -1) return null;

            const data = await response.json();
            const cacheAge = new Date() - new Date(data.timestamp);

            if (cacheAge > CACHE_DURATION) {
                // Rate is stale, fetch new one
                return await this.fetchExchangeRate();
            }

            return { rate: data.rate, rates: data.rates, timestamp: data.timestamp };
        } catch (error) {
            console.error('Error getting cached rate:', error);
            return null;
        }
    },

    async getOrFetchRate() {
        const cached = await this.getCachedRate();
        if (cached && !cached.error) return cached;
        return this.fetchExchangeRate();
    },
};