import React, { useState, useEffect } from 'react';
import {
    Box, Button, TextField, Typography, CircularProgress, Paper,
    Stack, Divider, IconButton, InputAdornment, Link
} from '@mui/material';
import {
    PhotoCamera as CameraIcon, Visibility, VisibilityOff,
    WhatsApp, Email, Phone, LocationOn
} from '@mui/icons-material';
import * as faceapi from '@vladmandic/face-api';
import api from '../services/api';
import FaceCapture from './FaceCapture';
import { loadModels } from '../services/faceRecognition';
import logo from '../img/logo-sem-fundo.png';

function LoginPage() {
    const [loading, setLoading] = useState(false);
    const [showCamera, setShowCamera] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [cachedUsers, setCachedUsers] = useState([]);

    useEffect(() => {
        loadModels();
        api.get('/auth/biometric-data')
            .then(res => setCachedUsers(res.data))
            .catch(err => console.error("Erro ao carregar dados:", err));
    }, []);

    const loginSuccess = (user, token) => {
        localStorage.setItem('user_data', JSON.stringify(user));
        localStorage.setItem('token', token);

        // Injetar token imediatamente na instância do Axios
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        if (user.role === 'admin') {
            window.location.href = '/dashboard';
        } else {
            window.location.href = '/user-dashboard';
        }
    };

    const handleFaceLogin = async (descriptor) => {
        try {
            setLoading(true);
            // Limpeza preventiva de sessões anteriores para evitar conflitos de token
            localStorage.removeItem('token');
            localStorage.removeItem('user_data');

            const users = cachedUsers.length > 0 ? cachedUsers : (await api.get('/auth/biometric-data')).data;
            let bestMatch = null;
            let minDistance = 0.55;

            users.forEach(u => {
                if (!u.face_descriptor) return;

                // Garantir que temos um array de floats, independente de como está no Firestore
                const savedDescriptor = Array.isArray(u.face_descriptor)
                    ? u.face_descriptor
                    : Object.values(u.face_descriptor);

                const dist = faceapi.euclideanDistance(descriptor, savedDescriptor);
                if (dist < minDistance) {
                    minDistance = dist;
                    bestMatch = u;
                }
            });

            if (bestMatch) {
                console.log(`✅ Rosto reconhecido: ${bestMatch.username} (Distância: ${minDistance.toFixed(4)})`);
                // Solicitar um Token Oficial para este usuário reconhecido
                const res = await api.post('/auth/login-biometric', { userId: bestMatch.id });
                loginSuccess(res.data.user, res.data.token);
            } else {
                alert("Rosto não reconhecido na base de dados.");
            }
        } catch (err) {
            console.error("ERRO LOGIN FACIAL:", err);
            const status = err.response?.status;
            const message = err.response?.data?.error || err.message;
            alert(`Erro no Login Facial: ${message} (Status: ${status || 'Conexão'})`);
        } finally {
            setLoading(false);
            setShowCamera(false);
        }
    };

    return (
        <Box sx={{ height: '100vh', display: 'flex', flexDirection: { xs: 'column', md: 'row' }, bgcolor: '#f0f2f5' }}>

            {/* LADO ESQUERDO: LOGO E INFORMAÇÕES DE CONTATO */}
            <Box sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: '#fff',
                p: 4,
                borderRight: '1px solid #ddd'
            }}>
                {/* Logo Principal */}
                <img src={logo} alt="Vida Mais" style={{ width: '100%', maxWidth: '400px' }} />

                {/* Seção de Contatos com Hyperlinks */}
                <Stack spacing={2} sx={{ mt: 4, width: '100%', maxWidth: '400px' }}>
                    <Link
                        href="https://www.google.com/maps/search/?api=1&query=Rua+Farmaceutico+Antonio+Serra+345+Itapira+SP"
                        target="_blank"
                        sx={{ display: 'flex', alignItems: 'center', color: '#444', textDecoration: 'none', '&:hover': { color: '#1b5e20' } }}
                    >
                        <LocationOn sx={{ mr: 1, color: '#1b5e20' }} /> Rua Farmacêutico Antonio Serra, 345 - Itapira/SP
                    </Link>

                    <Link
                        href="tel:1938437848"
                        sx={{ display: 'flex', alignItems: 'center', color: '#444', textDecoration: 'none', '&:hover': { color: '#1b5e20' } }}
                    >
                        <Phone sx={{ mr: 1, color: '#1b5e20' }} /> (19) 3843-7848
                    </Link>

                    <Link
                        href="https://wa.me/5519997412511"
                        target="_blank"
                        sx={{ display: 'flex', alignItems: 'center', color: '#25D366', textDecoration: 'none', fontWeight: 'bold' }}
                    >
                        <WhatsApp sx={{ mr: 1 }} /> (19) 99741-2511
                    </Link>

                    <Link
                        href="mailto:vidamais@vidamaisitapira.org.br"
                        sx={{ display: 'flex', alignItems: 'center', color: '#444', textDecoration: 'none', '&:hover': { color: '#1b5e20' } }}
                    >
                        <Email sx={{ mr: 1, color: '#1b5e20' }} /> vidamais@vidamaisitapira.org.br
                    </Link>
                </Stack>
            </Box>

            {/* LADO DIREITO: FORMULÁRIO DE LOGIN */}
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
                <Paper elevation={4} sx={{ p: 4, width: '100%', maxWidth: 400, borderRadius: 4, textAlign: 'center' }}>
                    <Typography variant="h5" sx={{ mb: 4, fontWeight: 700, color: '#1b5e20' }}>Acesso Restrito</Typography>

                    <form onSubmit={(e) => {
                        e.preventDefault();
                        setLoading(true);
                        api.post('/auth/login', { username, password })
                            .then(res => loginSuccess(res.data.user, res.data.token || res.data.accessToken))
                            .catch(() => alert("Credenciais inválidas"))
                            .finally(() => setLoading(false));
                    }}>
                        <Stack spacing={2.5}>
                            <TextField
                                label="Usuário"
                                fullWidth
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                            />
                            <TextField
                                label="Senha"
                                type={showPassword ? 'text' : 'password'}
                                fullWidth
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                InputProps={{
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton onClick={() => setShowPassword(!showPassword)}>
                                                {showPassword ? <VisibilityOff /> : <Visibility />}
                                            </IconButton>
                                        </InputAdornment>
                                    )
                                }}
                            />
                            <Button
                                variant="contained"
                                fullWidth
                                size="large"
                                type="submit"
                                sx={{ bgcolor: '#1b5e20', py: 1.8, fontWeight: 'bold' }}
                            >
                                {loading ? <CircularProgress size={24} color="inherit" /> : 'ENTRAR NO SISTEMA'}
                            </Button>

                            <Link 
                                href="https://wa.me/5519997412511?text=Olá,%20esqueci%20minha%20senha%20do%20portal%20Vida%20Mais." 
                                target="_blank"
                                sx={{ 
                                    color: '#666', 
                                    fontSize: '0.85rem', 
                                    textDecoration: 'none', 
                                    '&:hover': { color: '#1b5e20', textDecoration: 'underline' } 
                                }}
                            >
                                Esqueceu a senha? Clique aqui para suporte.
                            </Link>

                            <Divider>OU</Divider>

                            <Button
                                variant="outlined"
                                fullWidth
                                size="large"
                                startIcon={<CameraIcon />}
                                onClick={() => setShowCamera(true)}
                                color="success"
                                sx={{ py: 1.5, fontWeight: 'bold', borderWidth: 2 }}
                            >
                                RECONHECIMENTO FACIAL
                            </Button>
                        </Stack>
                    </form>

                    {showCamera && (
                        <Box sx={{ mt: 3 }}>
                            <FaceCapture onCapture={handleFaceLogin} />
                            <Button onClick={() => setShowCamera(false)} color="error" sx={{ mt: 1 }}>
                                FECHAR CÂMERA
                            </Button>
                        </Box>
                    )}
                </Paper>
            </Box>
        </Box>
    );
}

export default LoginPage;