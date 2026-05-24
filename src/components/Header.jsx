import React from 'react';
import { Wallet } from 'lucide-react';

export function Header() {
    return (
        <header className="bg-slate-900 border-b border-slate-800 p-6">
            <div className="max-w-7xl mx-auto flex items-center gap-3">
                <Wallet className="text-blue-500" size={32} />
                <div>
                    <h1 className="text-3xl font-bold text-white">Personal Finance Dashboard</h1>
                    <p className="text-slate-400 text-sm">Track your wealth, monitor spending, real-time currency conversion</p>
                </div>
            </div>
        </header>
    );
}
