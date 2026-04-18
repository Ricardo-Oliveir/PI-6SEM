import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import AdminLayout from './components/AdminLayout';
import AdminDashboardPage from './components/AdminDashboardPage';
import QuestionnaireManagerPage from './components/QuestionnaireManagerPage';
import InsightsPage from './components/InsightsPage';
import UserManagerPage from './components/UserManagerPage';
import LoginPage from './components/LoginPage';
import UserLayout from './components/UserLayout';
import UserDashboardPage from './components/UserDashboardPage';
import AnswerQuestionnairePage from './components/AnswerQuestionnairePage';
import { loadModels } from './services/faceRecognition';



const theme = createTheme({
    typography: {
        fontFamily: '"Open Sans", sans-serif',
    },
});

const ProtectedRoute = ({ children, requiredRole }) => {
    const userStr = localStorage.getItem('user_data');
    if (!userStr) return <Navigate to="/login" />;
    
    const user = JSON.parse(userStr);
    
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
        <ThemeProvider theme={theme}>
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />

                    <Route path="/" element={<ProtectedRoute requiredRole="auto"><div /></ProtectedRoute>} />

                    <Route path="/" element={<ProtectedRoute requiredRole="admin"><AdminLayout /></ProtectedRoute>}>
                        <Route path="dashboard" element={<AdminDashboardPage />} />
                        <Route path="questionarios" element={<QuestionnaireManagerPage />} />
                        <Route path="insights" element={<InsightsPage />} />
                        <Route path="usuarios" element={<UserManagerPage />} />
                    </Route>

                    {/* USER ROUTES */}
                    <Route path="/" element={<ProtectedRoute><UserLayout /></ProtectedRoute>}>
                        <Route path="user-dashboard" element={<UserDashboardPage />} />
                        <Route path="responder/questionario/:id" element={<AnswerQuestionnairePage />} />
                    </Route>

                    <Route path="*" element={<Navigate to="/" />} />
                </Routes>
            </BrowserRouter>
        </ThemeProvider>
    );
}

export default App;