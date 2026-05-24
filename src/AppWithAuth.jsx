import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { Dashboard } from './pages/Dashboard';

function AppRoutes() {
    const { isAuthenticated, isLoading } = useAuth();

    return (
        <Routes>
            {/* Public Routes */}
            <Route path="/login" element={!isAuthenticated && !isLoading ? <Login /> : <Navigate to="/dashboard" />} />
            <Route path="/signup" element={!isAuthenticated && !isLoading ? <Signup /> : <Navigate to="/dashboard" />} />

            {/* Protected Routes */}
            <Route
                path="/dashboard"
                element={
                    <ProtectedRoute isAuthenticated={isAuthenticated} isLoading={isLoading}>
                        <Dashboard />
                    </ProtectedRoute>
                }
            />

            {/* Default Route */}
            <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} />

            {/* Catch all */}
            <Route path="*" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} />
        </Routes>
    );
}

function App() {
    return (
        <Router>
            <AuthProvider>
                <AppRoutes />
            </AuthProvider>
        </Router>
    );
}

export default App;
