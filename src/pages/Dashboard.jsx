import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, Settings } from 'lucide-react';
import { Header } from '../components/Header';
import { ExchangeRateWidget } from '../components/ExchangeRateWidget';
import { NetWorthCard } from '../components/NetWorthCard';
import { AssetManager } from '../components/AssetManager';
import { SpendingTracker } from '../components/SpendingTracker';
import { TransactionsList } from '../components/TransactionsList';
import { VisualCharts } from '../components/VisualCharts';
import { AIInsights } from '../components/AIInsights';
import { LendingManager } from '../components/LendingManager';
import { useExchangeRate } from '../hooks/useExchangeRate';
import { useAssets } from '../hooks/useAssets';
import { useExpenses } from '../hooks/useExpenses';
import { useLendings } from '../hooks/useLendings';
import { apiService } from '../services/apiService';

export function Dashboard() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [globalAiEnabled, setGlobalAiEnabled] = useState(false);
    const [userAiEnabled, setUserAiEnabled] = useState(user?.aiEnabled !== false);
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
        const checkAI = async () => {
            try {
                const status = await apiService.checkAIStatus();
                setGlobalAiEnabled(status.aiEnabled !== undefined ? status.aiEnabled : true);
            } catch (error) {
                setGlobalAiEnabled(false);
            }
        };
        checkAI();

        // Fetch latest user profile from DB to catch manual database edits
        const fetchUser = async () => {
            try {
                const response = await apiService.getMe();
                const latestUser = response?.user || response;
                setUserAiEnabled(latestUser?.aiEnabled !== false);
            } catch (error) {
                // Silent fail, fallback to Context state
            }
        };
        fetchUser();
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            fetchRate();
        }, 3600000);

        return () => clearInterval(interval);
    }, [fetchRate]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const handleSettings = () => {
        navigate('/settings');
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            {/* Header with User Info */}
            <div className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Header />
                        <div className="hidden md:block">
                            <p className="text-sm text-slate-400">Welcome,</p>
                            <p className="font-semibold text-white">
                                {user?.firstName && user?.lastName
                                    ? `${user.firstName} ${user.lastName}`
                                    : user?.username}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleSettings}
                            className="p-2 hover:bg-slate-800 rounded-lg transition text-slate-400 hover:text-white"
                            title="Settings"
                        >
                            <Settings size={20} />
                        </button>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600/10 hover:bg-red-600/20 border border-red-600/30 rounded-lg transition text-red-400 hover:text-red-300"
                        >
                            <LogOut size={18} />
                            <span className="hidden sm:inline">Logout</span>
                        </button>
                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto p-6">
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

                {/* Fifth Row - Visual Charts */}
                <div className="mb-8">
                    <VisualCharts
                        expenses={monthlyExpenses}
                        assets={assets}
                        selectedMonth={selectedMonth}
                        selectedYear={selectedYear}
                        exchangeRate={rate}
                        rates={rates}
                        selectedCurrency={selectedCurrency}
                    />
                </div>

                {/* Sixth Row - Transactions List */}
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

                {/* Seventh Row - Lending Manager */}
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

                {/* Eighth Row - AI Insights */}
                {(globalAiEnabled && userAiEnabled) && (
                    <div className="mb-8">
                        <AIInsights
                            expenses={monthlyExpenses}
                            assets={assets}
                            selectedMonth={selectedMonth}
                            selectedYear={selectedYear}
                        />
                    </div>
                )}

                {/* Footer */}
                <div className="mt-12 pt-6 border-t border-slate-800">
                    <p className="text-center text-slate-500 text-sm">
                        📊 Personal Finance Dashboard • All your data is secure and private
                    </p>
                </div>
            </main>
        </div>
    );
}
