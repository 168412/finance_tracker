import React, { useState, useEffect, useRef } from 'react';
import { Plus, Wand2, Loader2, Camera, FileText, Trash2, X, Check } from 'lucide-react';

const EXPENSE_CATEGORIES = ['Food', 'Grocery', 'Rent', 'Utilities', 'Transport', 'Entertainment', 'Health', 'Shopping', 'Insurance', 'Family', 'Other'];

const getLocalDateString = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getCurrencyLabel = (cur) => {
    const labels = { EUR: 'EUR (€)', USD: 'USD ($)', GBP: 'GBP (£)', CAD: 'CAD (C$)', AUD: 'AUD (A$)', CHF: 'CHF (CHF)', JPY: 'JPY (¥)', CNY: 'CNY (¥)', INR: 'INR (₹)' };
    return labels[cur] || cur;
};

export function SpendingTracker({ onAddExpense, exchangeRate, rates = {}, assets = [], selectedCurrency = 'EUR' }) {
    const [formData, setFormData] = useState({
        amount: '',
        currency: selectedCurrency,
        category: 'Food',
        date: getLocalDateString(),
        notes: '',
        sourceAssetId: '',
    });
    const [isCategorizing, setIsCategorizing] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [isScanningStatement, setIsScanningStatement] = useState(false);
    const [hasSetDefault, setHasSetDefault] = useState(false);
    const [pendingExpenses, setPendingExpenses] = useState([]);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const fileInputRef = useRef(null);
    const statementInputRef = useRef(null);

    useEffect(() => {
        setFormData(prev => ({ ...prev, currency: selectedCurrency }));
    }, [selectedCurrency]);

    // Automatically set default asset to "Trading 212" when assets load
    useEffect(() => {
        if (!hasSetDefault && assets.length > 0) {
            const validAssets = assets.filter(a => a.category !== 'Investments');
            const defaultAsset = validAssets.find(a => a.name && a.name.toLowerCase().includes('trading 212')) || validAssets[0];
            if (defaultAsset) {
                setFormData(prev => ({ ...prev, sourceAssetId: defaultAsset.id }));
                setHasSetDefault(true);
            }
        }
    }, [assets, hasSetDefault]);

    const handleAutoCategorize = async () => {
        if (!formData.notes.trim()) return;

        setIsCategorizing(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${import.meta.env.VITE_API_URL}/categorize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    note: formData.notes,
                    categories: EXPENSE_CATEGORIES
                })
            });

            const data = await response.json();
            if (response.ok && data.category) {
                setFormData(prev => ({ ...prev, category: data.category }));
            } else if (data.error) {
                alert(data.error);
            }
        } catch (error) {
            console.error('Failed to auto-categorize:', error);
            alert('Failed to connect to AI service. Make sure the backend is running.');
        } finally {
            setIsCategorizing(false);
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsScanning(true);
        const uploadData = new FormData();
        uploadData.append('receipt', file);
        uploadData.append('categories', JSON.stringify(EXPENSE_CATEGORIES));

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${import.meta.env.VITE_API_URL}/scan-receipt`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: uploadData
            });

            const data = await response.json();
            if (response.ok) {
                setPendingExpenses([{
                    amount: data.amount ? data.amount.toString() : '',
                    currency: data.currency || formData.currency,
                    date: data.date || formData.date,
                    category: EXPENSE_CATEGORIES.includes(data.category) ? data.category : 'Other',
                    notes: data.notes || '',
                    sourceAssetId: formData.sourceAssetId || ''
                }]);
                setShowReviewModal(true);
            } else {
                alert(data.error || 'Failed to scan receipt');
            }
        } catch (error) {
            console.error('Failed to scan receipt:', error);
            alert('Failed to connect to AI service.');
        } finally {
            setIsScanning(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleStatementUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsScanningStatement(true);
        const uploadData = new FormData();
        uploadData.append('statement', file);
        uploadData.append('categories', JSON.stringify(EXPENSE_CATEGORIES));

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${import.meta.env.VITE_API_URL}/scan-statement`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: uploadData
            });

            const data = await response.json();
            if (response.ok && data.expenses) {
                const newPending = data.expenses.map(exp => ({
                    amount: exp.amount ? exp.amount.toString() : '',
                    currency: exp.currency || formData.currency,
                    date: exp.date || formData.date,
                    category: EXPENSE_CATEGORIES.includes(exp.category) ? exp.category : 'Other',
                    notes: exp.notes || 'Imported from statement',
                    sourceAssetId: formData.sourceAssetId || ''
                }));
                setPendingExpenses(newPending);
                setShowReviewModal(true);
            } else {
                alert(data.error || 'Failed to scan statement');
            }
        } catch (error) {
            console.error('Failed to scan statement:', error);
            alert('Failed to connect to AI service.');
        } finally {
            setIsScanningStatement(false);
            if (statementInputRef.current) statementInputRef.current.value = '';
        }
    };

    const updatePendingExpense = (index, field, value) => {
        const updated = [...pendingExpenses];
        updated[index][field] = value;
        setPendingExpenses(updated);
    };

    const removePendingExpense = (index) => {
        setPendingExpenses(pendingExpenses.filter((_, i) => i !== index));
        if (pendingExpenses.length <= 1) setShowReviewModal(false);
    };

    const handleConfirmPending = async () => {
        let count = 0;
        const assetValues = {}; // Track intermediate asset values manually

        for (const exp of pendingExpenses) {
            if (!exp.amount || isNaN(exp.amount)) continue;

            const amountInEUR = exp.currency === 'EUR' ? parseFloat(exp.amount) :
                exp.currency === 'INR' ? parseFloat(exp.amount) / exchangeRate :
                    (rates[exp.currency] ? (parseFloat(exp.amount) * rates[exp.currency]) / exchangeRate : parseFloat(exp.amount));

            const currentVal = assetValues[exp.sourceAssetId] !== undefined ? assetValues[exp.sourceAssetId] : null;

            const newValue = await onAddExpense({
                amount: amountInEUR,
                category: exp.category,
                date: exp.date,
                notes: exp.notes.trim(),
                sourceAssetId: exp.sourceAssetId,
                currency: exp.currency
            }, exp.sourceAssetId, currentVal);

            if (newValue !== undefined && exp.sourceAssetId) {
                assetValues[exp.sourceAssetId] = newValue;
            }
            count++;
        }
        alert(`Successfully saved ${count} expenses!`);
        setShowReviewModal(false);
        setPendingExpenses([]);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.amount || parseFloat(formData.amount) <= 0) {
            alert('Please enter a valid amount');
            return;
        }

        // Convert to EUR if entered in other currency
        const amountInEUR = formData.currency === 'EUR' ? parseFloat(formData.amount) :
            formData.currency === 'INR' ? parseFloat(formData.amount) / exchangeRate :
                (rates[formData.currency] ? (parseFloat(formData.amount) * rates[formData.currency]) / exchangeRate : parseFloat(formData.amount));

        onAddExpense({
            amount: amountInEUR,
            category: formData.category,
            date: formData.date,
            notes: formData.notes.trim(),
            sourceAssetId: formData.sourceAssetId,
            currency: formData.currency
        }, formData.sourceAssetId);

        setFormData({
            amount: '',
            currency: selectedCurrency,
            category: 'Food',
            date: getLocalDateString(),
            notes: '',
            sourceAssetId: formData.sourceAssetId // Preserve selection for subsequent entries
        });
    };

    return (
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            {showReviewModal && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="bg-slate-900 border border-slate-700 shadow-2xl rounded-xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
                            <div>
                                <h2 className="text-2xl font-bold text-white">Review Imported Data</h2>
                                <p className="text-slate-400 text-sm mt-1">Please review and correct the AI-parsed data before saving it to your dashboard.</p>
                            </div>
                            <button onClick={() => setShowReviewModal(false)} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 transition">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1">
                            <div className="space-y-4">
                                {pendingExpenses.map((exp, index) => (
                                    <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                                        <div className="md:col-span-2">
                                            <label className="block text-xs text-slate-400 mb-1">Amount</label>
                                            <input type="number" step="0.01" value={exp.amount} onChange={(e) => updatePendingExpense(index, 'amount', e.target.value)} className="w-full bg-slate-950 text-white px-3 py-2 rounded text-sm border border-slate-700 focus:border-blue-500 outline-none" />
                                        </div>
                                        <div className="md:col-span-1">
                                            <label className="block text-xs text-slate-400 mb-1">Currency</label>
                                            <select value={exp.currency} onChange={(e) => updatePendingExpense(index, 'currency', e.target.value)} className="w-full bg-slate-950 text-white px-3 py-2 rounded text-sm border border-slate-700 focus:border-blue-500 outline-none">
                                                {Array.from(new Set([exp.currency, selectedCurrency, 'INR'])).filter(Boolean).map(cur => (
                                                    <option key={cur} value={cur}>{getCurrencyLabel(cur)}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-xs text-slate-400 mb-1">Source Asset</label>
                                            <select value={exp.sourceAssetId} onChange={(e) => updatePendingExpense(index, 'sourceAssetId', e.target.value)} className="w-full bg-slate-950 text-white px-3 py-2 rounded text-sm border border-slate-700 focus:border-blue-500 outline-none">
                                                <option value="">None</option>
                                                {assets.filter(a => a.category !== 'Investments').map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
                                            </select>
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-xs text-slate-400 mb-1">Category</label>
                                            <select value={exp.category} onChange={(e) => updatePendingExpense(index, 'category', e.target.value)} className="w-full bg-slate-950 text-white px-3 py-2 rounded text-sm border border-slate-700 focus:border-blue-500 outline-none">
                                                {EXPENSE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                            </select>
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-xs text-slate-400 mb-1">Date</label>
                                            <input type="date" value={exp.date} onChange={(e) => updatePendingExpense(index, 'date', e.target.value)} className="w-full bg-slate-950 text-white px-3 py-2 rounded text-sm border border-slate-700 focus:border-blue-500 outline-none" />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-xs text-slate-400 mb-1">Notes</label>
                                            <input type="text" value={exp.notes} onChange={(e) => updatePendingExpense(index, 'notes', e.target.value)} className="w-full bg-slate-950 text-white px-3 py-2 rounded text-sm border border-slate-700 focus:border-blue-500 outline-none" />
                                        </div>
                                        <div className="md:col-span-1 flex items-end justify-end">
                                            <button onClick={() => removePendingExpense(index)} className="w-full md:w-auto p-2 hover:bg-red-500/20 text-red-400 rounded transition border border-transparent hover:border-red-500/30 flex justify-center" title="Remove Entry">
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="p-6 border-t border-slate-800 bg-slate-800/50 flex justify-end gap-3">
                            <button onClick={() => setShowReviewModal(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition font-medium">Cancel</button>
                            <button onClick={handleConfirmPending} className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition font-medium flex items-center gap-2">
                                <Check size={20} />
                                Confirm & Save {pendingExpenses.length}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Log Expense</h2>
                <div className="flex gap-2">
                    <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                    />
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isScanning || isScanningStatement}
                        className="bg-slate-700 hover:bg-slate-600 text-blue-400 px-3 py-1.5 rounded transition flex items-center gap-2 text-sm font-medium border border-slate-600"
                    >
                        {isScanning ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                        {isScanning ? 'Scanning...' : 'Scan Receipt'}
                    </button>

                    <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        ref={statementInputRef}
                        onChange={handleStatementUpload}
                    />
                    <button
                        type="button"
                        onClick={() => statementInputRef.current?.click()}
                        disabled={isScanning || isScanningStatement}
                        className="bg-slate-700 hover:bg-slate-600 text-emerald-400 px-3 py-1.5 rounded transition flex items-center gap-2 text-sm font-medium border border-slate-600"
                    >
                        {isScanningStatement ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                        {isScanningStatement ? 'Processing...' : 'Upload Statement'}
                    </button>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Amount</label>
                        <input
                            type="number"
                            step="0.01"
                            value={formData.amount}
                            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                            placeholder="0.00"
                            className="w-full bg-slate-600 text-white px-3 py-2 rounded border border-slate-500 focus:border-blue-500 focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Currency</label>
                        <select
                            value={formData.currency}
                            onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                            className="w-full bg-slate-600 text-white px-3 py-2 rounded border border-slate-500 focus:border-blue-500 focus:outline-none"
                        >
                            {Array.from(new Set([selectedCurrency, 'INR'])).map(cur => (
                                <option key={cur} value={cur}>{getCurrencyLabel(cur)}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Source Asset</label>
                        <select
                            value={formData.sourceAssetId}
                            onChange={(e) => setFormData({ ...formData, sourceAssetId: e.target.value })}
                            className="w-full bg-slate-600 text-white px-3 py-2 rounded border border-slate-500 focus:border-blue-500 focus:outline-none"
                        >
                            <option value="">None</option>
                            {assets.filter(asset => asset.category !== 'Investments').map(asset => (
                                <option key={asset.id} value={asset.id}>{asset.name} ({asset.currency})</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Category</label>
                        <select
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            className="w-full bg-slate-600 text-white px-3 py-2 rounded border border-slate-500 focus:border-blue-500 focus:outline-none"
                        >
                            {EXPENSE_CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Date</label>
                        <input
                            type="date"
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            className="w-full bg-slate-600 text-white px-3 py-2 rounded border border-slate-500 focus:border-blue-500 focus:outline-none"
                        />
                    </div>
                    <div className="flex items-end">
                        <button
                            type="submit"
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition font-medium flex items-center justify-center gap-2"
                        >
                            <Plus size={20} />
                            Add
                        </button>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Notes & Auto-Categorize</label>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <input
                            type="text"
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="e.g., Uber to airport"
                            className="flex-1 bg-slate-600 text-white px-3 py-2 rounded border border-slate-500 focus:border-blue-500 focus:outline-none"
                        />
                        <button
                            type="button"
                            onClick={handleAutoCategorize}
                            disabled={isCategorizing || !formData.notes.trim()}
                            title="Auto-detect category based on notes"
                            className="bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded transition flex items-center justify-center"
                        >
                            {isCategorizing ? <Loader2 size={20} className="animate-spin" /> : <Wand2 size={20} />}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}
