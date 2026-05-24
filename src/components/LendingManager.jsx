import React, { useState, useEffect } from 'react';
import { ArrowRightLeft, Plus, Trash2, Edit2, X, Check, Search } from 'lucide-react';
import { formatCurrency } from '../services/calculations';

const getCurrencyLabel = (cur) => {
    const labels = { EUR: 'EUR (€)', USD: 'USD ($)', GBP: 'GBP (£)', CAD: 'CAD (C$)', AUD: 'AUD (A$)', CHF: 'CHF (CHF)', JPY: 'JPY (¥)', CNY: 'CNY (¥)', INR: 'INR (₹)' };
    return labels[cur] || cur;
};

export function LendingManager({ lendings, onAddLending, onUpdateLending, onDeleteLending, exchangeRate, rates = {}, selectedCurrency = 'EUR' }) {
    const [formData, setFormData] = useState({
        name: '', amount: '', currency: selectedCurrency, type: 'Given', date: new Date().toISOString().split('T')[0]
    });
    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState({});
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        setFormData(prev => ({ ...prev, currency: selectedCurrency }));
    }, [selectedCurrency]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.name || !formData.amount || parseFloat(formData.amount) <= 0) return;
        onAddLending({ ...formData, amount: parseFloat(formData.amount) });
        setFormData({ ...formData, name: '', amount: '', currency: selectedCurrency });
    };

    const handleEditClick = (lending) => {
        setEditingId(lending.id);
        setEditData({ ...lending });
    };

    const handleSaveEdit = (lending) => {
        if (!editData.name || !editData.amount || isNaN(editData.amount)) return;
        onUpdateLending(lending.id, { ...lending, ...editData, amount: parseFloat(editData.amount) });
        setEditingId(null);
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const getAmountInEUR = (amount, currency) => {
        if (currency === 'EUR') return amount;
        if (currency === 'INR') return amount / exchangeRate;
        return rates[currency] ? (amount * rates[currency]) / exchangeRate : amount;
    };

    // Calculations for totals using the live exchange rate
    const totalGivenEUR = lendings
        .filter(l => l.type === 'Given')
        .reduce((acc, curr) => acc + getAmountInEUR(curr.amount, curr.currency), 0);

    const totalReceivedEUR = lendings
        .filter(l => l.type === 'Received')
        .reduce((acc, curr) => acc + getAmountInEUR(curr.amount, curr.currency), 0);

    const filteredLendings = lendings.filter(lending =>
        lending.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="flex items-center gap-2 mb-6">
                <ArrowRightLeft className="text-blue-400" size={24} />
                <h2 className="text-2xl font-bold text-white">Lending Management</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-700/50 rounded p-4 border border-slate-600">
                    <p className="text-slate-400 text-sm mb-2">Total Given (They owe you)</p>
                    <p className="text-3xl font-bold text-red-400">{formatCurrency(totalGivenEUR, 'EUR')}</p>
                    <p className="text-sm text-slate-400">{formatCurrency(totalGivenEUR * exchangeRate, 'INR')}</p>
                </div>
                <div className="bg-slate-700/50 rounded p-4 border border-slate-600">
                    <p className="text-slate-400 text-sm mb-2">Total Received (You owe them)</p>
                    <p className="text-3xl font-bold text-green-400">{formatCurrency(totalReceivedEUR, 'EUR')}</p>
                    <p className="text-sm text-slate-400">{formatCurrency(totalReceivedEUR * exchangeRate, 'INR')}</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="bg-slate-700/50 rounded-lg p-4 border border-slate-600 mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-4 mb-4">
                    <div className="col-span-1">
                        <label className="block text-sm text-slate-300 mb-2">Type</label>
                        <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })} className="w-full bg-slate-600 text-white px-3 py-2 rounded focus:outline-none focus:border-blue-500 border border-slate-500">
                            <option value="Given">Given</option>
                            <option value="Received">Received</option>
                        </select>
                    </div>
                    <div className="col-span-1">
                        <label className="block text-sm text-slate-300 mb-2">Name</label>
                        <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Person's Name" className="w-full bg-slate-600 text-white px-3 py-2 rounded focus:outline-none focus:border-blue-500 border border-slate-500" required />
                    </div>
                    <div className="col-span-1">
                        <label className="block text-sm text-slate-300 mb-2">Amount</label>
                        <input type="number" step="0.01" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} placeholder="0.00" className="w-full bg-slate-600 text-white px-3 py-2 rounded focus:outline-none focus:border-blue-500 border border-slate-500" required />
                    </div>
                    <div className="col-span-1">
                        <label className="block text-sm text-slate-300 mb-2">Currency</label>
                        <select value={formData.currency} onChange={e => setFormData({ ...formData, currency: e.target.value })} className="w-full bg-slate-600 text-white px-3 py-2 rounded focus:outline-none focus:border-blue-500 border border-slate-500">
                            {Array.from(new Set([selectedCurrency, 'INR'])).map(cur => (
                                <option key={cur} value={cur}>{getCurrencyLabel(cur)}</option>
                            ))}
                        </select>
                    </div>
                    <div className="col-span-1">
                        <label className="block text-sm text-slate-300 mb-2">Date</label>
                        <input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="w-full bg-slate-600 text-white px-3 py-2 rounded focus:outline-none focus:border-blue-500 border border-slate-500" required />
                    </div>
                    <div className="col-span-1 flex items-end">
                        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition flex items-center justify-center gap-2 font-medium">
                            <Plus size={20} /> Add
                        </button>
                    </div>
                </div>
            </form>

            <div className="border-t border-slate-700 pt-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                    <h3 className="text-lg font-semibold text-white">Transaction History</h3>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by name..."
                            className="w-full sm:w-64 bg-slate-800 text-white pl-9 pr-3 py-1.5 rounded-lg border border-slate-600 focus:outline-none focus:border-blue-500 text-sm"
                        />
                    </div>
                </div>
                {filteredLendings.length === 0 ? (
                    <p className="text-slate-400 text-center py-4">
                        {lendings.length === 0 ? "No lending records found." : "No matching records found."}
                    </p>
                ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                        {filteredLendings.map(lending => {
                            if (editingId === lending.id) {
                                return (
                                    <div key={lending.id} className="bg-slate-700/80 rounded p-4 border border-blue-500/50">
                                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-2">
                                            <select value={editData.type} onChange={e => setEditData({ ...editData, type: e.target.value })} className="bg-slate-800 text-white px-3 py-1.5 rounded text-sm outline-none border border-slate-600">
                                                <option value="Given">Given</option>
                                                <option value="Received">Received</option>
                                            </select>
                                            <input type="text" value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} className="bg-slate-800 text-white px-3 py-1.5 rounded text-sm outline-none border border-slate-600" placeholder="Name" />
                                            <input type="number" step="0.01" value={editData.amount} onChange={e => setEditData({ ...editData, amount: e.target.value })} className="bg-slate-800 text-white px-3 py-1.5 rounded text-sm outline-none border border-slate-600" />
                                            <select value={editData.currency} onChange={e => setEditData({ ...editData, currency: e.target.value })} className="bg-slate-800 text-white px-3 py-1.5 rounded text-sm outline-none border border-slate-600">
                                                {Array.from(new Set([editData.currency, selectedCurrency, 'INR'])).filter(Boolean).map(cur => (
                                                    <option key={cur} value={cur}>{getCurrencyLabel(cur)}</option>
                                                ))}
                                            </select>
                                            <input type="date" value={editData.date} onChange={e => setEditData({ ...editData, date: e.target.value })} className="bg-slate-800 text-white px-3 py-1.5 rounded text-sm outline-none border border-slate-600" />
                                        </div>
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => setEditingId(null)} className="flex items-center gap-1 px-3 py-1 bg-slate-600 rounded text-sm hover:bg-slate-500"><X size={14} /> Cancel</button>
                                            <button onClick={() => handleSaveEdit(lending)} className="flex items-center gap-1 px-3 py-1 bg-green-600 rounded text-sm hover:bg-green-500"><Check size={14} /> Save</button>
                                        </div>
                                    </div>
                                );
                            }
                            return (
                                <div key={lending.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-700/50 rounded p-4 hover:bg-slate-700 transition border border-slate-600 gap-4">
                                    <div className="flex-1">
                                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1">
                                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${lending.type === 'Given' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                                                {lending.type}
                                            </span>
                                            <span className="font-semibold text-white truncate max-w-full">{lending.name}</span>
                                            <span className="text-slate-400 text-xs sm:text-sm">{formatDate(lending.date)}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto border-t sm:border-0 border-slate-600 pt-3 sm:pt-0 mt-1 sm:mt-0">
                                        <div className="text-left sm:text-right mr-2">
                                            <p className="font-bold text-white">{formatCurrency(lending.amount, lending.currency)}</p>
                                            <p className="text-xs text-slate-400">
                                                {lending.currency === 'EUR' ? formatCurrency(lending.amount * exchangeRate, 'INR') : formatCurrency(getAmountInEUR(lending.amount, lending.currency), 'EUR')}
                                            </p>
                                        </div>
                                        <button onClick={() => handleEditClick(lending)} className="p-2 text-blue-400 hover:bg-blue-500/20 rounded transition" title="Edit">
                                            <Edit2 size={18} />
                                        </button>
                                        <button onClick={() => { if (window.confirm('Delete this record?')) onDeleteLending(lending.id); }} className="p-2 text-red-400 hover:bg-red-500/20 rounded transition" title="Delete">
                                            <Trash2 size={18} />
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