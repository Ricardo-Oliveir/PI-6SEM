import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeContextProvider } from './context/ThemeContext';
import AdminLayout from './components/AdminLayout';
import AdminDashboardPage from './components/AdminDashboardPage';
import QuestionnaireManagerPage from './components/QuestionnaireManagerPage';
import InsightsPage from './components/InsightsPage';
import UserManagerPage from './components/UserManagerPage';
import LoginPage from './components/LoginPage';
import UserLayout from './components/UserLayout';
import UserDashboardPage from './components/UserDashboardPage';
import AnswerQuestionnairePage from './components/AnswerQuestionnairePage';
import PublicTVDashboard from './components/PublicTVDashboard';
import ResponsesViewPage from './components/ResponsesViewPage';

const ProtectedRoute = ({ children, requiredRole }) => {
    const userStr = localStorage.getItem('user_data');
    if (!userStr) return <Navigate to="/login" />;

    let user;
    try {
        user = JSON.parse(userStr);
    } catch {
        localStorage.clear();
        return <Navigate to="/login" />;
    }

    if (!user || !user.role) {
        localStorage.clear();
        return <Navigate to="/login" />;
    }

    // Admin tentando acessar área de usuário → redireciona para dashboard admin
    if (requiredRole === 'user' && user.role === 'admin') {
        return <Navigate to="/dashboard" />;
    }

    // Usuário comum tentando acessar área admin → redireciona para dashboard usuário
    if (requiredRole === 'admin' && user.role !== 'admin') {
        return <Navigate to="/user-dashboard" />;
    }

    if (requiredRole === 'auto') {
        if (user.role === 'admin') return <Navigate to="/dashboard" />;
        else return <Navigate to="/user-dashboard" />;
    }

    return children;
};

function App() {
    return (
        <ThemeContextProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />

                    <Route path="/" element={<ProtectedRoute requiredRole="auto"><div /></ProtectedRoute>} />

                    <Route path="/" element={<ProtectedRoute requiredRole="admin"><AdminLayout /></ProtectedRoute>}>
                        <Route path="dashboard" element={<AdminDashboardPage />} />
                        <Route path="questionarios" element={<QuestionnaireManagerPage />} />
                        <Route path="questionarios/:questionnaireId/respostas" element={<ResponsesViewPage />} />
                        <Route path="insights" element={<InsightsPage />} />
                        <Route path="usuarios" element={<UserManagerPage />} />
                    </Route>

                    {/* USER ROUTES - apenas usuários com role 'user' */}
                    <Route path="/" element={<ProtectedRoute requiredRole="user"><UserLayout /></ProtectedRoute>}>
                        <Route path="user-dashboard" element={<UserDashboardPage />} />
                        <Route path="responder/questionario/:id" element={<AnswerQuestionnairePage />} />
                    </Route>

                    {/* PUBLIC ROUTES */}
                    <Route path="/tv" element={<PublicTVDashboard />} />

                    <Route path="*" element={<Navigate to="/" />} />
                </Routes>
            </BrowserRouter>
        </ThemeContextProvider>
    );
}

export default App;