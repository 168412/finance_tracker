import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

export const useExpenses = () => {
    const [expenses, setExpenses] = useState([]);
    const [monthlyExpenses, setMonthlyExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    const loadExpenses = async () => {
        try {
            setLoading(true);
            const response = await apiService.getExpenses();
            const rawExpenses = Array.isArray(response) ? response : (response?.expenses || response?.data || []);
            setExpenses(rawExpenses.map(e => ({ ...e, id: e._id || e.id })));
            setError(null);
        } catch (err) {
            setError(err.message || 'Failed to load expenses');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Load expenses on mount
    useEffect(() => {
        loadExpenses();
    }, []);

    // Filter expenses when expenses, selectedMonth, or selectedYear changes
    useEffect(() => {
        const monthly = expenses.filter(e => {
            const expenseDate = new Date(e.date);
            return expenseDate.getUTCMonth() === selectedMonth && expenseDate.getUTCFullYear() === selectedYear;
        });
        setMonthlyExpenses(monthly);
    }, [expenses, selectedMonth, selectedYear]);

    const addExpense = async (expense) => {
        try {
            const response = await apiService.createExpense(expense);
            const newExpense = response?.expense || response?.data || response;
            const formatted = { ...newExpense, id: newExpense._id || newExpense.id };
            setExpenses(prev => [...prev, formatted]);
            return formatted;
        } catch (err) {
            setError(err.message || 'Failed to add expense');
            console.error(err);
            throw err;
        }
    };

    const updateExpense = async (id, updatedData) => {
        try {
            const response = await apiService.updateExpense(id, updatedData);
            const updated = response?.expense || response?.data || response;
            const formatted = { ...updated, id: updated._id || updated.id };
            setExpenses(prev => prev.map(e => e.id === id ? formatted : e));
            return formatted;
        } catch (err) {
            setError(err.message || 'Failed to update expense');
            console.error(err);
            throw err;
        }
    };

    const deleteExpense = async (id) => {
        try {
            await apiService.deleteExpense(id);
            setExpenses(prev => prev.filter(e => e.id !== id));
        } catch (err) {
            setError(err.message || 'Failed to delete expense');
            console.error(err);
            throw err;
        }
    };

    return {
        expenses,
        monthlyExpenses,
        loading,
        error,
        addExpense,
        updateExpense,
        deleteExpense,
        refreshExpenses: loadExpenses,
        selectedMonth,
        setSelectedMonth,
        selectedYear,
        setSelectedYear
    };
};
