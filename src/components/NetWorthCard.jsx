import React from 'react';
import { PiggyBank } from 'lucide-react';
import { calculateTotalNetWorth, calculateTotalNetWorthINR, formatCurrency } from '../services/calculations';

export function NetWorthCard({ assets, exchangeRate, rates = {} }) {
    const safeAssets = Array.isArray(assets) ? assets : [];

    const totalEUR = calculateTotalNetWorth(safeAssets, exchangeRate, rates);
    const totalINR = calculateTotalNetWorthINR(safeAssets, exchangeRate, rates);

    return (
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg p-8 border border-blue-500 shadow-lg">
            <div className="flex items-center gap-3 mb-6">
                <PiggyBank className="text-white" size={32} />
                <h2 className="text-2xl font-bold text-white">Total Net Worth</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                    <p className="text-blue-100 text-sm mb-2">In EUR</p>
                    <p className="text-3xl md:text-4xl lg:text-5xl font-bold text-white break-words">{formatCurrency(totalEUR, 'EUR')}</p>
                </div>
                <div>
                    <p className="text-blue-100 text-sm mb-2">In INR</p>
                    <p className="text-3xl md:text-4xl lg:text-5xl font-bold text-white break-words">{formatCurrency(totalINR, 'INR')}</p>
                </div>
            </div>

            {safeAssets.length === 0 && (
                <div className="mt-6 pt-6 border-t border-blue-500">
                    <p className="text-blue-100 text-sm italic">No assets added yet. Start by adding your first asset.</p>
                </div>
            )}

            {safeAssets.length > 0 && (
                <div className="mt-6 pt-6 border-t border-blue-500">
                    <p className="text-blue-100 text-sm mb-3">Assets breakdown ({safeAssets.length}):</p>
                    <div className="space-y-2">
                        {safeAssets.map(asset => {
                            const currency = asset.currency || 'EUR';

                            const valueInEUR = currency === 'EUR' ? asset.value :
                                currency === 'INR' ? asset.value / exchangeRate :
                                    (rates[currency] ? (asset.value * rates[currency]) / exchangeRate : asset.value);

                            const valueInINR = currency === 'INR' ? asset.value :
                                currency === 'EUR' ? asset.value * exchangeRate :
                                    (rates[currency] ? asset.value * rates[currency] : asset.value);

                            return (
                                <div key={asset.id} className="flex flex-col sm:flex-row justify-between text-blue-100 text-sm py-1 sm:py-0 border-b border-blue-500/30 sm:border-0 last:border-0">
                                    <span className="mb-1 sm:mb-0 font-medium sm:font-normal">{asset.name} ({currency})</span>
                                    <span className="text-left sm:text-right">
                                        {formatCurrency(asset.value, currency)}
                                        <span className="text-xs text-blue-200 block sm:inline sm:ml-2">
                                            / €{valueInEUR.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ₹{valueInINR.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
