import React, { useState } from 'react';
import { TrendingUp, Trash2, Calendar, Edit2, X, Check } from 'lucide-react';
import { calculateMonthlySpending, convertCurrency, formatCurrency, getMonthName } from '../services/calculations';

const CATEGORY_COLORS = {
    Food: 'bg-orange-500/20 text-orange-400',
    Grocery: 'bg-lime-500/20 text-lime-400',
    Rent: 'bg-red-500/20 text-red-400',
    Utilities: 'bg-yellow-500/20 text-yellow-400',
    Transport: 'bg-blue-500/20 text-blue-400',
    Entertainment: 'bg-purple-500/20 text-purple-400',
    Health: 'bg-green-500/20 text-green-400',
    Shopping: 'bg-pink-500/20 text-pink-400',
    Insurance: 'bg-teal-500/20 text-teal-400',
    Family: 'bg-indigo-500/20 text-indigo-400',
    Other: 'bg-slate-500/20 text-slate-400',
};

const EXPENSE_CATEGORIES = ['Food', 'Grocery', 'Rent', 'Utilities', 'Transport', 'Entertainment', 'Health', 'Shopping', 'Insurance', 'Family', 'Other'];

export function TransactionsList({ expenses, exchangeRate, onUpdateExpense, onDeleteExpense, selectedMonth, setSelectedMonth, selectedYear, setSelectedYear, assets = [] }) {
    const [filterCategory, setFilterCategory] = useState('All');

    const filteredExpenses = filterCategory === 'All'
        ? expenses
        : expenses.filter(e => e.category === filterCategory);

    const totalSpentEUR = calculateMonthlySpending(filteredExpenses);
    const totalSpentINR = parseFloat(convertCurrency(totalSpentEUR, exchangeRate));

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const handleMonthChange = (e) => {
        if (!e.target.value) return;
        const [yearStr, monthStr] = e.target.value.split('-');
        setSelectedYear(parseInt(yearStr, 10));
        setSelectedMonth(parseInt(monthStr, 10) - 1);
    };

    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState({ amount: '', category: 'Food', date: '', notes: '', sourceAssetId: '' });

    const handleEditClick = (expense) => {
        setEditingId(expense.id);
        setEditData({
            amount: expense.amount,
            category: expense.category || 'Food',
            date: expense.date || '',
            notes: expense.notes || '',
            sourceAssetId: expense.sourceAssetId || ''
        });
    };

    const handleSaveEdit = (expense) => {
        if (!editData.amount || isNaN(editData.amount)) return;
        if (onUpdateExpense) {
            onUpdateExpense(expense.id, {
                ...expense,
                ...editData,
                amount: parseFloat(editData.amount)
            });
        }
        setEditingId(null);
    };

    const monthInputValue = selectedYear !== undefined && selectedMonth !== undefined
        ? `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`
        : '';

    const displayMonthDate = new Date(selectedYear, selectedMonth);

    return (
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="text-orange-400" size={24} />
                        <h2 className="text-2xl font-bold text-white">Spending Summary</h2>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto bg-slate-700/50 p-2 rounded-lg border border-slate-600 overflow-hidden">
                        <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="bg-transparent text-white focus:outline-none cursor-pointer border-r border-slate-600 pr-2 mr-2 text-sm"
                        >
                            <option value="All">All Categories</option>
                            {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <Calendar size={18} className="text-slate-400" />
                        <input
                            type="month"
                            value={monthInputValue}
                            onChange={handleMonthChange}
                            className="bg-transparent text-white focus:outline-none cursor-pointer"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <div className="bg-slate-700/50 rounded p-4 border border-slate-600">
                        <p className="text-slate-400 text-sm mb-2">{getMonthName(displayMonthDate)} - In EUR</p>
                        <p className="text-3xl font-bold text-orange-400">{formatCurrency(totalSpentEUR, 'EUR')}</p>
                    </div>
                    <div className="bg-slate-700/50 rounded p-4 border border-slate-600">
                        <p className="text-slate-400 text-sm mb-2">{getMonthName(displayMonthDate)} - In INR</p>
                        <p className="text-3xl font-bold text-orange-400">{formatCurrency(totalSpentINR, 'INR')}</p>
                    </div>
                </div>
            </div>

            <div className="border-t border-slate-700 pt-6">
                <h3 className="text-lg font-semibold text-white mb-4">Transactions ({filteredExpenses.length})</h3>

                {filteredExpenses.length === 0 ? (
                    <div className="text-center py-8">
                        <p className="text-slate-400">No expenses found.</p>
                    </div>
                ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {filteredExpenses.map(expense => {
                            if (editingId === expense.id) {
                                return (
                                    <div key={expense.id} className="flex flex-col gap-3 bg-slate-700/80 rounded p-4 border border-blue-500/50">
                                        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                                            <div>
                                                <label className="text-xs text-slate-400 mb-1 block">Amount (EUR)</label>
                                                <input type="number" step="0.01" value={editData.amount} onChange={e => setEditData({ ...editData, amount: e.target.value })} className="w-full bg-slate-800 text-white px-3 py-1.5 rounded text-sm border border-slate-600 focus:border-blue-500 outline-none" />
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-400 mb-1 block">Category</label>
                                                <select value={editData.category} onChange={e => setEditData({ ...editData, category: e.target.value })} className="w-full bg-slate-800 text-white px-3 py-1.5 rounded text-sm border border-slate-600 focus:border-blue-500 outline-none">
                                                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-400 mb-1 block">Spent From</label>
                                                <select value={editData.sourceAssetId} onChange={e => setEditData({ ...editData, sourceAssetId: e.target.value })} className="w-full bg-slate-800 text-white px-3 py-1.5 rounded text-sm border border-slate-600 focus:border-blue-500 outline-none">
                                                    <option value="">None</option>
                                                    {assets.filter(a => a.category !== 'Investments').map(a => (
                                                        <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-400 mb-1 block">Date</label>
                                                <input type="date" value={editData.date} onChange={e => setEditData({ ...editData, date: e.target.value })} className="w-full bg-slate-800 text-white px-3 py-1.5 rounded text-sm border border-slate-600 focus:border-blue-500 outline-none" />
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-400 mb-1 block">Notes</label>
                                                <input type="text" value={editData.notes} onChange={e => setEditData({ ...editData, notes: e.target.value })} className="w-full bg-slate-800 text-white px-3 py-1.5 rounded text-sm border border-slate-600 focus:border-blue-500 outline-none" placeholder="Notes" />
                                            </div>
                                        </div>
                                        <div className="flex justify-end gap-2 mt-1">
                                            <button onClick={() => setEditingId(null)} className="flex items-center gap-1 px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-white rounded text-sm transition"><X size={14} /> Cancel</button>
                                            <button onClick={() => handleSaveEdit(expense)} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition"><Check size={14} /> Save</button>
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <div
                                    key={expense.id}
                                    className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-700/50 rounded p-4 hover:bg-slate-700 transition border border-slate-600 gap-4"
                                >
                                    <div className="flex-1">
                                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                                            <span className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm font-medium ${CATEGORY_COLORS[expense.category] || CATEGORY_COLORS.Other}`}>
                                                {expense.category}
                                            </span>
                                            <span className="text-slate-400 text-xs sm:text-sm">{formatDate(expense.date)}</span>
                                            {expense.sourceAssetId && assets.find(a => a.id === expense.sourceAssetId) && (
                                                <span className="text-slate-400 text-xs sm:text-sm bg-slate-800 px-2 py-0.5 rounded border border-slate-600 break-all">
                                                    From: {assets.find(a => a.id === expense.sourceAssetId)?.name}
                                                </span>
                                            )}
                                        </div>
                                        {expense.notes && (
                                            <p className="text-slate-400 text-sm italic">{expense.notes}</p>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto border-t sm:border-0 border-slate-600 pt-3 sm:pt-0 mt-1 sm:mt-0">
                                        <div className="text-left sm:text-right mr-2">
                                            <p className="font-bold text-red-400">{formatCurrency(expense.amount, 'EUR')}</p>
                                            <p className="text-sm text-slate-400">{formatCurrency(convertCurrency(expense.amount, exchangeRate), 'INR')}</p>
                                        </div>
                                        <button
                                            onClick={() => handleEditClick(expense)}
                                            className="p-2 hover:bg-blue-500/20 rounded transition text-blue-400 hover:text-blue-300"
                                            title="Edit expense"
                                        >
                                            <Edit2 size={20} />
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (window.confirm('Are you sure you want to delete this expense?')) {
                                                    onDeleteExpense(expense.id);
                                                }
                                            }}
                                            className="p-2 hover:bg-red-500/20 rounded transition text-red-400 hover:text-red-300"
                                            title="Delete expense"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
