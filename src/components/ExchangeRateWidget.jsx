import React from 'react';
import { RefreshCw, TrendingUp } from 'lucide-react';

export function ExchangeRateWidget({ rate, rates = {}, lastUpdated, onRefresh, loading, selectedCurrency = 'EUR', setSelectedCurrency }) {
    // Sort array so it defaults nicely
    const availableCurrencies = Object.keys(rates).length > 0 ? Object.keys(rates) : ['EUR'];

    const formattedDate = lastUpdated
        ? new Date(lastUpdated).toLocaleString()
        : 'Unknown';

    return (
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 shadow-lg">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                    <div className="bg-emerald-500/20 p-3 rounded-full">
                        <TrendingUp className="text-emerald-400" size={24} />
                    </div>
                    <div>
                        <p className="text-slate-200 font-bold text-lg mb-1">Live Exchange Rates</p>
                        <p className="text-xs text-slate-500 mt-1">Last updated: {formattedDate}</p>
                    </div>
                </div>

                <button
                    onClick={() => onRefresh(true)}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition"
                >
                    <RefreshCw size={16} className={loading ? "animate-spin text-blue-400" : ""} />
                    <span>{loading ? 'Updating...' : 'Refresh Rates'}</span>
                </button>
            </div>

            {/* Main Conversion Display with Dropdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-900/50 rounded-lg p-5 border border-slate-700 flex flex-col justify-center">
                    <label className="text-slate-400 text-sm mb-2 block">Base Currency</label>
                    <div className="flex items-center gap-3">
                        <span className="text-2xl font-bold text-white">1</span>
                        <select
                            value={selectedCurrency}
                            onChange={(e) => setSelectedCurrency?.(e.target.value)}
                            className="bg-slate-800 text-white font-bold text-xl px-3 py-1.5 rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                        >
                            {availableCurrencies.map(currency => (
                                <option key={currency} value={currency}>{currency}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="bg-emerald-900/20 rounded-lg p-5 border border-emerald-800/30 flex flex-col justify-center">
                    <label className="text-slate-400 text-sm mb-2 block">Converted to INR</label>
                    <p className="text-3xl font-bold text-emerald-400">₹{(rates[selectedCurrency] || rate)?.toFixed(2)}</p>
                </div>
            </div>
        </div>
    );
}
