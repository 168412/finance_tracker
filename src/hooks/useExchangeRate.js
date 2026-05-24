import { useState, useEffect } from 'react';
import { exchangeRateService } from '../services/exchangeRateService';

export const useExchangeRate = () => {
    const [rate, setRate] = useState(103.5);
    const [rates, setRates] = useState({ EUR: 103.5 });
    const [lastUpdated, setLastUpdated] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchRate = async (forceRefresh = false) => {
        setLoading(true);
        setError(null);
        try {
            const data = await exchangeRateService.fetchExchangeRate(forceRefresh);
            if (data) {
                setRate(data.rate);
                setRates(data.rates || { EUR: data.rate });
                setLastUpdated(data.timestamp);
                if (data.error) {
                    setError('Using fallback rate - API connection failed');
                }
            }
        } catch (err) {
            setError('Failed to fetch exchange rate');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Load initial rate on mount
        const loadInitialRate = async () => {
            try {
                const cachedData = await exchangeRateService.getCachedRate();
                if (cachedData && cachedData.rates) {
                    setRate(cachedData.rate);
                    setRates(cachedData.rates);
                    setLastUpdated(cachedData.timestamp);
                } else {
                    // If no cached data or no rates in cache (old format), fetch fresh data
                    fetchRate(true);
                }
            } catch (err) {
                console.error('Error loading initial rate:', err);
            }
        };

        loadInitialRate();
    }, []);

    return { rate, rates, lastUpdated, loading, error, fetchRate };
};
