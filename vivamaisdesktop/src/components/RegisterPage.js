import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, TextField, Button, Typography, Paper, Alert, Chip } from '@mui/material';
import PersonAddAltRoundedIcon from '@mui/icons-material/PersonAddAltRounded';
import logo from '../img/logo-sem-fundo.png';
import api from '../services/api';
import { brand, fadeUp, glassPanel, gradients, pageShell } from '../styles/designSystem';

function RegisterPage() {
    const navigate = useNavigate();
    const [fullName, setFullName] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const generateUsername = (name) => {
        if (!name) return '';
        return name.trim()
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '')
            .substring(0, 30);
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');

        if (!fullName.trim() || fullName.trim().length < 3) {
            return setError('Nome deve ter pelo menos 3 caracteres.');
        }
        if (!password || password.length < 6) {
            return setError('Senha deve ter pelo menos 6 caracteres.');
        }
        if (password !== confirmPassword) {
            return setError('Senhas não coincidem.');
        }

        setLoading(true);

        try {
            const username = generateUsername(fullName);
            const email = `${username}@vivamais.com`;

            await api.post('/auth/register', {
                username,
                full_name: fullName.trim(),
                email,
                password,
                role: 'user'
            });

            setSuccessMsg(`Conta criada! Seu usuário é: "${username}".`);

            setTimeout(() => {
                navigate('/');
            }, 3000);
        } catch (err) {
            console.error(err);
            const msg = err.response?.data?.error || 'Erro ao criar conta. Tente outro nome.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box
            sx={{
                ...pageShell,
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                p: 2.5,
                background: 'linear-gradient(180deg, #f8fcfb 0%, #eef5f2 100%)'
            }}
        >
            <Paper
                elevation={0}
                sx={{
                    ...glassPanel,
                    width: '100%',
                    maxWidth: 560,
                    p: { xs: 3, md: 4 },
                    borderRadius: 8,
                    position: 'relative',
                    zIndex: 1,
                    ...fadeUp(0)
                }}
            >
                <Chip
                    icon={<PersonAddAltRoundedIcon />}
                    label="Nova conta"
                    sx={{
                        mb: 2.5,
                        color: brand.primaryDark,
                        background: 'rgba(15,122,90,0.08)'
                    }}
                />

                <Box
                    sx={{
                        width: 86,
                        height: 86,
                        borderRadius: 6,
                        display: 'grid',
                        placeItems: 'center',
                        background: gradients.panel,
                        border: `1px solid ${brand.line}`,
                        mb: 3
                    }}
                >
                    <img src={logo} alt="Logo" style={{ width: '56px' }} />
                </Box>

                <Typography variant="h4" sx={{ mb: 1 }}>
                    Criar acesso ao painel
                </Typography>
                <Typography sx={{ color: 'text.secondary', mb: 4 }}>
                    Cadastro com identidade visual atualizada e fluxo mais claro para o usuário.
                </Typography>

                {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 4 }}>{error}</Alert>}
                {successMsg && <Alert severity="success" sx={{ mb: 3, borderRadius: 4 }}>{successMsg}</Alert>}

                <form onSubmit={handleRegister}>
                    <TextField
                        label="Nome Completo"
                        fullWidth
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        sx={{ mb: 2.5 }}
                        placeholder="Ex: Maria da Silva"
                    />

                    {fullName.trim().length > 0 && (
                        <Box
                            sx={{
                                mb: 2.5,
                                p: 2,
                                borderRadius: 5,
                                background: 'linear-gradient(135deg, rgba(15,122,90,0.08) 0%, rgba(47,111,237,0.08) 100%)',
                                border: `1px solid ${brand.line}`
                            }}
                        >
                            <Typography variant="body2" color="text.secondary">
                                Seu usuário para login será:
                            </Typography>
                            <Typography variant="h6" sx={{ color: brand.primary, fontWeight: 800 }}>
                                {generateUsername(fullName)}
                            </Typography>
                        </Box>
                    )}

                    <TextField
                        label="Senha"
                        type="password"
                        fullWidth
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        sx={{ mb: 2.5 }}
                    />

                    <TextField
                        label="Confirmar Senha"
                        type="password"
                        fullWidth
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        sx={{ mb: 1 }}
                    />

                    <Button type="submit" fullWidth disabled={loading} sx={{ mt: 2, minHeight: 54, fontSize: 16 }}>
                        {loading ? 'Criando conta...' : 'Criar conta'}
                    </Button>

                    <Button fullWidth onClick={() => navigate('/')} sx={{ mt: 1.5, color: brand.secondary, fontWeight: 800 }}>
                        Já tenho conta
                    </Button>
                </form>
            </Paper>
        </Box>
    );
}

export default RegisterPage;
