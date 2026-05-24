import React, { useState, useEffect } from 'react';
import {
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { getMonthName } from '../services/calculations';

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16'];

const getCurrencyLabel = (cur) => {
    const labels = { EUR: 'EUR (€)', USD: 'USD ($)', GBP: 'GBP (£)', CAD: 'CAD (C$)', AUD: 'AUD (A$)', CHF: 'CHF (CHF)', JPY: 'JPY (¥)', CNY: 'CNY (¥)', INR: 'INR (₹)' };
    return labels[cur] || cur;
};

export function VisualCharts({ expenses, assets, selectedMonth, selectedYear, exchangeRate = 1, rates = {}, selectedCurrency = 'EUR' }) {
    const [chartCurrency, setChartCurrency] = useState(selectedCurrency);

    // Sync internal dropdown if global currency changes
    useEffect(() => {
        setChartCurrency(selectedCurrency);
    }, [selectedCurrency]);

    const isMissingExchangeRate = exchangeRate === 1;

    // Process expenses data (group by category)
    const expensesByCategory = expenses.reduce((acc, expense) => {
        const category = expense.category || 'Other';
        // Note: SpendingTracker already converts amounts to EUR on save
        acc[category] = (acc[category] || 0) + Number(expense.amount);
        return acc;
    }, {});

    const pieData = Object.keys(expensesByCategory).map(key => {
        let valEUR = expensesByCategory[key];
        let displayValue = chartCurrency === 'EUR' ? valEUR :
            chartCurrency === 'INR' ? valEUR * exchangeRate :
                (rates[chartCurrency] ? (valEUR * exchangeRate) / rates[chartCurrency] : valEUR);

        return {
            name: key,
            value: Number(displayValue.toFixed(2))
        };
    }).filter(item => item.value > 0);

    // Process assets data (group by individual asset name)
    const assetsByName = assets.reduce((acc, asset) => {
        const name = asset.name || 'Unknown';
        const assetCurrency = asset.currency || 'EUR';

        let valueInEUR = assetCurrency === 'EUR' ? Number(asset.value) :
            assetCurrency === 'INR' ? Number(asset.value) / exchangeRate :
                (rates[assetCurrency] ? (Number(asset.value) * rates[assetCurrency]) / exchangeRate : Number(asset.value));

        acc[name] = (acc[name] || 0) + valueInEUR;
        return acc;
    }, {});

    const barData = Object.keys(assetsByName).map(key => {
        let valEUR = assetsByName[key];
        let displayValue = chartCurrency === 'EUR' ? valEUR :
            chartCurrency === 'INR' ? valEUR * exchangeRate :
                (rates[chartCurrency] ? (valEUR * exchangeRate) / rates[chartCurrency] : valEUR);

        return {
            name: key,
            value: Number(displayValue.toFixed(2))
        };
    }).filter(item => item.value > 0);

    const displayMonthDate = (selectedYear !== undefined && selectedMonth !== undefined)
        ? new Date(selectedYear, selectedMonth)
        : new Date();

    const getCurrencySymbol = (cur) => ({ EUR: '€', INR: '₹', USD: '$', GBP: '£', CAD: 'C$', AUD: 'A$', CHF: 'CHF', JPY: '¥', CNY: '¥' }[cur] || cur + ' ');
    const currencySymbol = getCurrencySymbol(chartCurrency);

    return (
        <div className="mb-8">
            {isMissingExchangeRate && (
                <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded-lg mb-6 text-sm flex flex-col gap-1">
                    <strong className="text-red-400">⚠️ Action Required: Missing Exchange Rate Prop</strong>
                    <p>The graph still looks wrong because <code>&lt;VisualCharts /&gt;</code> is missing the exchange rate from <code>App.jsx</code>, causing it to fall back to a 1:1 ratio.</p>
                    <p>Open <strong>src/App.jsx</strong> and update the component call to pass the rate: <code>&lt;VisualCharts exchangeRate=&#123;rate&#125; ... /&gt;</code></p>
                </div>
            )}

            <div className="flex justify-end mb-4">
                <select
                    value={chartCurrency}
                    onChange={(e) => setChartCurrency(e.target.value)}
                    className="bg-slate-800 text-white text-sm px-3 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-blue-500"
                >
                    {Array.from(new Set([selectedCurrency, 'INR'])).map(cur => (
                        <option key={cur} value={cur}>Show Charts in {getCurrencyLabel(cur)}</option>
                    ))}
                </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Spending Donut Chart */}
                <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 shadow-xl">
                    <h3 className="text-xl font-bold mb-6 text-slate-100">
                        Spending by Category ({getMonthName(displayMonthDate)})
                    </h3>
                    {pieData.length > 0 ? (
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                        labelLine={false}
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value) => `${currencySymbol}${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }}
                                        itemStyle={{ color: '#f8fafc' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-64 flex items-center justify-center text-slate-500">
                            No spending data to display.
                        </div>
                    )}
                </div>

                {/* Asset Distribution Bar Chart */}
                <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 shadow-xl">
                    <h3 className="text-xl font-bold mb-6 text-slate-100">
                        Asset Distribution
                    </h3>
                    {barData.length > 0 ? (
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={barData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                    <XAxis dataKey="name" stroke="#94a3b8" />
                                    <YAxis stroke="#94a3b8" tickFormatter={(value) => `${currencySymbol}${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`} />
                                    <Tooltip
                                        formatter={(value) => `${currencySymbol}${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }}
                                        itemStyle={{ color: '#f8fafc' }}
                                        cursor={{ fill: '#1e293b' }}
                                    />
                                    <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-64 flex items-center justify-center text-slate-500">
                            No asset data to display.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
