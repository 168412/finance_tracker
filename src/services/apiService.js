// Ensure fallback for VITE_API_URL so it doesn't try to fetch relative paths
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';

const getHeaders = () => {
    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('token');
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
};

const handleResponse = async (response) => {
    if (response.status === 401) {
        // Auto-logout user if token expires
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        throw new Error('Session expired. Please login again.');
    }

    const isJson = response.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await response.json() : null;

    if (!response.ok) {
        throw new Error((data && data.error) || 'API request failed');
    }

    return data;
};

export const apiService = {
    getAssets: async () => handleResponse(await fetch(`${API_URL}/assets`, { headers: getHeaders() })),
    createAsset: async (data) => handleResponse(await fetch(`${API_URL}/assets`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(data) })),
    updateAsset: async (id, data) => handleResponse(await fetch(`${API_URL}/assets/${id}`, { method: 'PATCH', headers: getHeaders(), body: JSON.stringify(data) })),
    deleteAsset: async (id) => handleResponse(await fetch(`${API_URL}/assets/${id}`, { method: 'DELETE', headers: getHeaders() })),

    getExpenses: async () => handleResponse(await fetch(`${API_URL}/expenses`, { headers: getHeaders() })),
    createExpense: async (data) => handleResponse(await fetch(`${API_URL}/expenses`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(data) })),
    updateExpense: async (id, data) => handleResponse(await fetch(`${API_URL}/expenses/${id}`, { method: 'PATCH', headers: getHeaders(), body: JSON.stringify(data) })),
    deleteExpense: async (id) => handleResponse(await fetch(`${API_URL}/expenses/${id}`, { method: 'DELETE', headers: getHeaders() })),

    getLendings: async () => handleResponse(await fetch(`${API_URL}/lendings`, { headers: getHeaders() })),
    createLending: async (data) => handleResponse(await fetch(`${API_URL}/lendings`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(data) })),
    updateLending: async (id, data) => handleResponse(await fetch(`${API_URL}/lendings/${id}`, { method: 'PATCH', headers: getHeaders(), body: JSON.stringify(data) })),
    deleteLending: async (id) => handleResponse(await fetch(`${API_URL}/lendings/${id}`, { method: 'DELETE', headers: getHeaders() })),

    getMe: async () => handleResponse(await fetch(`${API_URL}/auth/me`, { headers: getHeaders() })),
    checkAIStatus: async () => handleResponse(await fetch(`${API_URL}/ai-status`, { headers: getHeaders() })),
};