import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Loader2, RefreshCw, Send, MessageSquare } from 'lucide-react';
import { getMonthName } from '../services/calculations';

export function AIInsights({ expenses, assets, selectedMonth, selectedYear }) {
    const [insights, setInsights] = useState([]);
    const [isLoadingInsights, setIsLoadingInsights] = useState(false);
    const [insightsError, setInsightsError] = useState(null);

    const [chatMessages, setChatMessages] = useState([]);
    const [currentMessage, setCurrentMessage] = useState('');
    const [isChatLoading, setIsChatLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const displayMonthDate = (selectedYear !== undefined && selectedMonth !== undefined)
        ? new Date(selectedYear, selectedMonth)
        : new Date();
    const currentMonthName = getMonthName(displayMonthDate);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [chatMessages, isChatLoading]);

    const generateInsights = async () => {
        setIsLoadingInsights(true);
        setInsightsError(null);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${import.meta.env.VITE_API_URL}/insights`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    expenses,
                    assets,
                    currentMonth: currentMonthName
                })
            });

            const data = await response.json();
            if (response.ok && data.insights) {
                setInsights(data.insights);
            } else if (data.error) {
                setInsightsError(data.error);
            }
        } catch (err) {
            console.error('Failed to get insights:', err);
            setInsightsError('Failed to connect to AI service. Make sure the backend is running.');
        } finally {
            setIsLoadingInsights(false);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!currentMessage.trim() || isChatLoading) return;

        const newUserMessage = { role: 'user', content: currentMessage.trim() };
        setChatMessages(prev => [...prev, newUserMessage]);
        setCurrentMessage('');
        setIsChatLoading(true);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${import.meta.env.VITE_API_URL}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    message: newUserMessage.content,
                    expenses,
                    assets,
                    currentMonth: currentMonthName,
                    history: chatMessages
                })
            });

            const data = await response.json();
            if (response.ok && data.reply) {
                setChatMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
            } else {
                setChatMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
            }
        } catch (error) {
            console.error('Chat error:', error);
            setChatMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Is the backend running?' }]);
        } finally {
            setIsChatLoading(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* AI Insights Section */}
            <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 shadow-xl flex flex-col">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <Sparkles className="text-purple-400" size={24} />
                        <h3 className="text-xl font-bold text-slate-100">
                            AI Financial Insights
                        </h3>
                    </div>
                    <button
                        onClick={generateInsights}
                        disabled={isLoadingInsights}
                        className="bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-500/30 px-4 py-2 rounded-lg transition flex items-center gap-2 text-sm font-medium"
                    >
                        {isLoadingInsights ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                        {insights.length > 0 ? 'Regenerate' : 'Analyze Finances'}
                    </button>
                </div>

                {insightsError && (
                    <div className="bg-red-500/20 text-red-400 p-4 rounded-lg text-sm mb-4">
                        {insightsError}
                    </div>
                )}

                {!isLoadingInsights && !insightsError && insights.length === 0 && (
                    <div className="text-slate-500 text-center py-6 flex-1 flex flex-col items-center justify-center">
                        <p>Click the button above to get an AI-powered analysis of your spending and assets for {currentMonthName}.</p>
                    </div>
                )}

                {insights.length > 0 && (
                    <div className="bg-slate-800/50 rounded-lg p-5 border border-slate-700 flex-1 overflow-y-auto">
                        <ul className="space-y-4">
                            {insights.map((insight, index) => (
                                <li key={index} className="flex gap-3 text-slate-300">
                                    <span className="text-purple-400 mt-1">✦</span>
                                    <span>{insight}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* AI Chat Section */}
            <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 shadow-xl flex flex-col h-[500px]">
                <div className="flex items-center gap-2 mb-6">
                    <MessageSquare className="text-blue-400" size={24} />
                    <h3 className="text-xl font-bold text-slate-100">
                        Chat with AI
                    </h3>
                </div>

                <div className="flex-1 overflow-y-auto bg-slate-950/50 rounded-lg p-4 mb-4 border border-slate-800 flex flex-col gap-4">
                    {chatMessages.length === 0 ? (
                        <div className="text-slate-500 text-center my-auto flex flex-col items-center gap-2">
                            <MessageSquare size={32} className="opacity-50" />
                            <p>Ask me anything about your finances for {currentMonthName}!</p>
                            <p className="text-xs">e.g., "How much did I spend on food?" or "Can I afford a new laptop?"</p>
                        </div>
                    ) : (
                        chatMessages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] rounded-lg p-3 text-sm ${msg.role === 'user'
                                    ? 'bg-blue-600 text-white rounded-br-none'
                                    : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none'
                                    }`}>
                                    {msg.content}
                                </div>
                            </div>
                        ))
                    )}
                    {isChatLoading && (
                        <div className="flex justify-start">
                            <div className="bg-slate-800 text-slate-200 border border-slate-700 rounded-lg rounded-bl-none p-3 text-sm flex gap-2 items-center">
                                <Loader2 size={14} className="animate-spin text-purple-400" />
                                <span className="text-slate-400 italic">AI is thinking...</span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <form onSubmit={handleSendMessage} className="flex gap-2">
                    <input
                        type="text"
                        value={currentMessage}
                        onChange={(e) => setCurrentMessage(e.target.value)}
                        placeholder={`Ask about ${currentMonthName} spending...`}
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        disabled={isChatLoading}
                    />
                    <button
                        type="submit"
                        disabled={!currentMessage.trim() || isChatLoading}
                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition flex items-center justify-center"
                    >
                        <Send size={18} />
                    </button>
                </form>
            </div>
        </div>
    );
}
