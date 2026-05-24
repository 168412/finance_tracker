import React, { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { ExchangeRateWidget } from './components/ExchangeRateWidget';
import { NetWorthCard } from './components/NetWorthCard';
import { AssetManager } from './components/AssetManager';
import { SpendingTracker } from './components/SpendingTracker';
import { TransactionsList } from './components/TransactionsList';
import { VisualCharts } from './components/VisualCharts';
import { AIInsights } from './components/AIInsights';
import { useExchangeRate } from './hooks/useExchangeRate';
import { useAssets } from './hooks/useAssets';
import { useExpenses } from './hooks/useExpenses';
import { useLendings } from './hooks/useLendings';
import { LendingManager } from './components/LendingManager';

function App() {
    const [selectedCurrency, setSelectedCurrency] = useState('EUR');
    const { rate, rates, lastUpdated, loading: rateLoading, error: rateError, fetchRate } = useExchangeRate();
    const { assets: rawAssets, addAsset, updateAsset, deleteAsset } = useAssets();
    const assets = Array.isArray(rawAssets) ? rawAssets : [];

    const {
        expenses: rawExpenses,
        monthlyExpenses: rawMonthlyExpenses,
        addExpense,
        updateExpense,
        deleteExpense,
        selectedMonth,
        setSelectedMonth,
        selectedYear,
        setSelectedYear
    } = useExpenses();
    const monthlyExpenses = Array.isArray(rawMonthlyExpenses) ? rawMonthlyExpenses : [];
    const expenses = Array.isArray(rawExpenses) ? rawExpenses : [];

    const { lendings: rawLendings, addLending, updateLending, deleteLending } = useLendings();
    const lendings = Array.isArray(rawLendings) ? rawLendings : [];

    const handleAddExpense = async (expenseData, sourceAssetId, currentAssetValue = null) => {
        try {
            await addExpense(expenseData);
            if (sourceAssetId) {
                const sourceAsset = assets.find(a => a.id === sourceAssetId);
                if (sourceAsset) {
                    // Convert back to asset's original currency if needed
                    const deduction = sourceAsset.currency === 'EUR' ? expenseData.amount :
                        sourceAsset.currency === 'INR' ? (expenseData.amount * rate) :
                            (rates[sourceAsset.currency] ? (expenseData.amount * rate) / rates[sourceAsset.currency] : expenseData.amount);
                    const baseValue = currentAssetValue !== null ? currentAssetValue : sourceAsset.value;
                    const newAssetValue = Math.max(0, baseValue - deduction);
                    await updateAsset(sourceAssetId, { ...sourceAsset, value: parseFloat(newAssetValue.toFixed(2)) });
                    return newAssetValue;
                }
            }
        } catch (error) {
            console.error("Error saving expense or updating asset:", error);
        }
    };

    const handleDeleteExpense = async (expenseId) => {
        try {
            // Find the expense to retrieve the sourceAssetId and amount before it is deleted
            const expenseToDelete = expenses.find(e => e.id === expenseId);
            await deleteExpense(expenseId);

            if (expenseToDelete && expenseToDelete.sourceAssetId) {
                const sourceAsset = assets.find(a => a.id === expenseToDelete.sourceAssetId);
                if (sourceAsset) {
                    const refund = sourceAsset.currency === 'EUR' ? expenseToDelete.amount :
                        sourceAsset.currency === 'INR' ? (expenseToDelete.amount * rate) :
                            (rates[sourceAsset.currency] ? (expenseToDelete.amount * rate) / rates[sourceAsset.currency] : expenseToDelete.amount);
                    const newAssetValue = sourceAsset.value + refund;
                    await updateAsset(sourceAsset.id, { ...sourceAsset, value: parseFloat(newAssetValue.toFixed(2)) });
                }
            }
        } catch (error) {
            console.error("Error deleting expense or updating asset:", error);
        }
    };

    useEffect(() => {
        // Refresh rate every hour
        const interval = setInterval(() => {
            fetchRate();
        }, 3600000);

        return () => clearInterval(interval);
    }, [fetchRate]);

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            <Header />

            <main className="max-w-7xl mx-auto p-4 sm:p-6">
                {/* Top Row - Exchange Rate */}
                <div className="mb-8">
                    <ExchangeRateWidget
                        rate={rate}
                        rates={rates}
                        lastUpdated={lastUpdated}
                        onRefresh={fetchRate}
                        loading={rateLoading}
                        selectedCurrency={selectedCurrency}
                        setSelectedCurrency={setSelectedCurrency}
                    />
                </div>

                {/* Second Row - Net Worth Card (Full Width) */}
                <div className="mb-8">
                    <NetWorthCard assets={assets} exchangeRate={rate} rates={rates} />
                </div>

                {/* Third Row - Assets */}
                <div className="mb-8">
                    <AssetManager
                        assets={assets}
                        onAddAsset={addAsset}
                        onUpdateAsset={updateAsset}
                        onDeleteAsset={deleteAsset}
                        exchangeRate={rate}
                        rates={rates}
                    />
                </div>

                {/* Fourth Row - Spending Tracker */}
                <div className="mb-8">
                    <SpendingTracker
                        onAddExpense={handleAddExpense}
                        exchangeRate={rate}
                        rates={rates}
                        assets={assets}
                        selectedCurrency={selectedCurrency}
                    />
                </div>

                {/* AI Insights */}
                <AIInsights
                    expenses={monthlyExpenses}
                    assets={assets}
                    selectedMonth={selectedMonth}
                    selectedYear={selectedYear}
                />

                {/* Visual Charts */}
                <VisualCharts
                    expenses={monthlyExpenses}
                    assets={assets}
                    selectedMonth={selectedMonth}
                    selectedYear={selectedYear}
                    exchangeRate={rate}
                    rates={rates}
                    selectedCurrency={selectedCurrency}
                />

                {/* Fifth Row - Transactions List (Full Width) */}
                <div className="mb-8">
                    <TransactionsList
                        expenses={monthlyExpenses}
                        exchangeRate={rate}
                        onUpdateExpense={updateExpense}
                        onDeleteExpense={handleDeleteExpense}
                        selectedMonth={selectedMonth}
                        setSelectedMonth={setSelectedMonth}
                        selectedYear={selectedYear}
                        setSelectedYear={setSelectedYear}
                        assets={assets}
                    />
                </div>

                {/* Sixth Row - Lending Management */}
                <div className="mb-8">
                    <LendingManager
                        lendings={lendings}
                        onAddLending={addLending}
                        onUpdateLending={updateLending}
                        onDeleteLending={deleteLending}
                        exchangeRate={rate}
                        rates={rates}
                        selectedCurrency={selectedCurrency}
                    />
                </div>

                {/* Footer */}
                <div className="mt-12 pt-6 border-t border-slate-800">
                    <p className="text-center text-slate-500 text-sm">
                        📊 Personal Finance Dashboard • Data persisted locally in your browser
                    </p>
                </div>
            </main>
        </div>
    );
}

export default App;
