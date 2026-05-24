// Calculation utilities

// Calculate total net worth in EUR, considering the actual currency of each asset
export const calculateTotalNetWorth = (assets, exchangeRate = 1) => {
    return assets.reduce((sum, asset) => {
        // If currency is not specified, assume EUR (for backward compatibility)
        const currency = asset.currency || 'EUR';
        const valueInEUR = currency === 'INR' ? asset.value / exchangeRate : asset.value;
        return sum + valueInEUR;
    }, 0);
};

// Calculate total net worth in INR
export const calculateTotalNetWorthINR = (assets, exchangeRate = 1) => {
    return assets.reduce((sum, asset) => {
        const currency = asset.currency || 'EUR';
        const valueInINR = currency === 'EUR' ? asset.value * exchangeRate : asset.value;
        return sum + valueInINR;
    }, 0);
};

export const calculateMonthlySpending = (expenses) => {
    return expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
};

export const convertCurrency = (amountEUR, exchangeRate) => {
    return (amountEUR * exchangeRate).toFixed(2);
};

export const formatCurrency = (amount, currency = 'EUR') => {
    const symbols = {
        EUR: '€',
        INR: '₹',
    };
    return `${symbols[currency] || currency} ${parseFloat(amount).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
};

export const getMonthName = (date) => {
    return new Date(date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

export const groupExpensesByCategory = (expenses) => {
    return expenses.reduce((acc, expense) => {
        const category = expense.category || 'Other';
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(expense);
        return acc;
    }, {});
};
