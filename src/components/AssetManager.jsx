import React, { useState } from 'react';
import { Plus, Trash2, Edit2, X } from 'lucide-react';

const ASSET_CATEGORIES = ['Investments', 'Bank Account', 'Crypto', 'Cash', 'Real Estate', 'Other'];

export function AssetManager({ assets, onAddAsset, onUpdateAsset, onDeleteAsset, exchangeRate, rates = {} }) {
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        value: '',
        currency: 'EUR',
        category: 'Bank Account',
    });

    const handleEdit = (asset) => {
        setFormData({
            name: asset.name,
            value: asset.value.toString(),
            currency: asset.currency || 'EUR',
            category: asset.category,
        });
        setEditingId(asset.id);
        setShowForm(true);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.name.trim() || !formData.value) {
            alert('Please fill in all fields');
            return;
        }

        const assetData = {
            name: formData.name.trim(),
            value: parseFloat(formData.value),
            currency: formData.currency,
            category: formData.category,
        };

        if (editingId) {
            onUpdateAsset(editingId, assetData);
        } else {
            onAddAsset(assetData);
        }

        setFormData({ name: '', value: '', currency: 'EUR', category: 'Bank Account' });
        setEditingId(null);
        setShowForm(false);
    };

    return (
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Assets</h2>
                <button
                    onClick={() => {
                        setShowForm(!showForm);
                        setEditingId(null);
                        setFormData({ name: '', value: '', currency: 'EUR', category: 'Bank Account' });
                    }}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
                >
                    {showForm ? <X size={20} /> : <Plus size={20} />}
                    {showForm ? 'Cancel' : 'Add Asset'}
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="bg-slate-700/50 rounded-lg p-4 mb-6 border border-slate-600">
                    <div className="grid grid-cols-4 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Name</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g., Trading 212"
                                className="w-full bg-slate-600 text-white px-3 py-2 rounded border border-slate-500 focus:border-blue-500 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Amount</label>
                            <input
                                type="number"
                                step="0.01"
                                value={formData.value}
                                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
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
                                <option value="EUR">EUR (€)</option>
                                <option value="USD">USD ($)</option>
                                <option value="GBP">GBP (£)</option>
                                <option value="CAD">CAD (C$)</option>
                                <option value="AUD">AUD (A$)</option>
                                <option value="CHF">CHF (CHF)</option>
                                <option value="JPY">JPY (¥)</option>
                                <option value="CNY">CNY (¥)</option>
                                <option value="INR">INR (₹)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Category</label>
                            <select
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                className="w-full bg-slate-600 text-white px-3 py-2 rounded border border-slate-500 focus:border-blue-500 focus:outline-none"
                            >
                                {ASSET_CATEGORIES.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="submit"
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition"
                        >
                            {editingId ? 'Update Asset' : 'Save Asset'}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setShowForm(false);
                                setEditingId(null);
                            }}
                            className="flex-1 bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded transition"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            )}

            {assets.length === 0 ? (
                <div className="text-center py-12">
                    <p className="text-slate-400">No assets yet. Add your first asset to get started!</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {assets.map(asset => {
                        const getCurrencySymbol = (cur) => ({ EUR: '€', INR: '₹', USD: '$', GBP: '£', CAD: 'C$', AUD: 'A$', CHF: 'CHF', JPY: '¥', CNY: '¥' }[cur] || cur + ' ');
                        const currencySymbol = getCurrencySymbol(asset.currency);

                        const valueInEUR = asset.currency === 'EUR' ? asset.value :
                            asset.currency === 'INR' ? asset.value / exchangeRate :
                                (rates[asset.currency] ? (asset.value * rates[asset.currency]) / exchangeRate : asset.value);

                        const valueInINR = asset.currency === 'INR' ? asset.value :
                            asset.currency === 'EUR' ? asset.value * exchangeRate :
                                (rates[asset.currency] ? asset.value * rates[asset.currency] : asset.value);

                        return (
                            <div
                                key={asset.id}
                                className="flex items-center justify-between bg-slate-700 rounded p-4 hover:bg-slate-700/80 transition"
                            >
                                <div className="flex-1">
                                    <p className="font-semibold text-white">{asset.name}</p>
                                    <p className="text-sm text-slate-400">{asset.category}</p>
                                </div>
                                <div className="text-right mr-4 flex flex-col items-end">
                                    <p className="font-bold text-green-400">
                                        {currencySymbol} {asset.value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                    <p className="text-xs text-slate-400">
                                        (€ {valueInEUR.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ₹ {valueInINR.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                                    </p>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => handleEdit(asset)}
                                        className="p-2 hover:bg-blue-500/20 rounded transition text-blue-400 hover:text-blue-300"
                                        title="Edit asset"
                                    >
                                        <Edit2 size={20} />
                                    </button>
                                    <button
                                        onClick={() => onDeleteAsset(asset.id)}
                                        className="p-2 hover:bg-red-500/20 rounded transition text-red-400 hover:text-red-300"
                                        title="Delete asset"
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
    );
}
