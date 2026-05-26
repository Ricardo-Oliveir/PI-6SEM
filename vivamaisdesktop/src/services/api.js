// src/services/api.js
import axios from 'axios';

const getApiBaseUrl = () => {
    // Usa a variável de ambiente se disponível, senão usa o padrão de produção
    return process.env.REACT_APP_API_URL || 'https://api-jzao6okpha-uc.a.run.app/api';
};

const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Inicialização imediata do token se existir no localStorage
const initialToken = localStorage.getItem('token');
if (initialToken && initialToken !== 'undefined' && initialToken !== 'null') {
    api.defaults.headers.common['Authorization'] = `Bearer ${initialToken}`;
}

// Interceptor de requisição: Garante que o Token mais atual seja enviado
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');

    if (token && token !== 'undefined' && token !== 'null') {
        config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

// Interceptor de resposta: Redireciona para login quando o token expira
api.interceptors.response.use(
    response => response,
    error => {
        if (error.response?.status === 401) {
            // Token expirado ou inválido — limpa sessão e redireciona
            localStorage.removeItem('token');
            localStorage.removeItem('user_data');
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

// --- FUNÇÕES HELPER ---

export const getAllQuestionnaires = async () => {
    const response = await api.get('/questionnaires');
    return response.data;
};

export const createQuestionnaire = async (title, description) => {
    const response = await api.post('/questionnaires', {
        title,
        description,
        created_at: new Date().toISOString()
    });
    return response.data;
};

export const deleteQuestionnaire = async (id) => {
    const response = await api.delete(`/questionnaires/${id}`);
    return response.data;
};

export const createQuestion = async (questionnaireId, text, type, options = null) => {
    const cleanOptions = options ? options.filter(o => o.trim() !== '') : null;
    const response = await api.post(`/questionnaires/${questionnaireId}/questions`, {
        text,
        type,
        options: cleanOptions,
        is_required: true,
        order: 0
    });
    return response.data;
};

export default api;