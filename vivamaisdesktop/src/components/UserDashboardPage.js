import React, { useState, useEffect } from 'react';
import { Box, Typography, Card, CardContent, Button, CircularProgress, Grid } from '@mui/material';
import { PlayArrow as PlayIcon, Logout as LogoutIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import logo from '../img/logo-sem-fundo.png';

function UserDashboardPage() {
    const navigate = useNavigate();
    const [surveys, setSurveys] = useState([]);
    const [loading, setLoading] = useState(true);

    const userStr = localStorage.getItem('user_data');
    const user = userStr ? JSON.parse(userStr) : {};

    useEffect(() => {
        const fetchSurveys = async () => {
            try {
                // A rota fetch active traz apenas os não respondidos associados a este usuário
                const res = await api.get('/questionnaires/active');
                setSurveys(res.data);
            } catch (err) {
                console.error("Erro ao buscar questionários", err);
            } finally {
                setLoading(false);
            }
        };
        fetchSurveys();
    }, []);

    return (
        <Box sx={{ pb: 5 }}>
            <Box sx={{ maxWidth: 800, margin: '0 auto', px: 2 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, mb: 1, color: '#1b5e20' }}>
                    Bem-vindo, {user.full_name || 'Participante'}
                </Typography>
                <Typography sx={{ color: '#555', mb: 4 }}>
                    Estas são as pesquisas de satisfação disponíveis para você responder.
                </Typography>

                {loading ? (
                    <Box textAlign="center" mt={5}><CircularProgress color="success" /></Box>
                ) : surveys.length === 0 ? (
                    <Card sx={{ textAlign: 'center', p: 6, borderRadius: 4, border: '1px dashed #ccc', bgcolor: 'transparent', boxShadow: 'none' }}>
                        <Typography variant="h6" sx={{ color: '#1b5e20', fontWeight: 'bold', mb: 1 }}>
                            Tudo em dia por aqui!
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#666' }}>
                            Não há pesquisas pendentes no momento. <br/>
                            Verifique mais tarde ou contate o administrador se você acha que deveria ver algo aqui.
                        </Typography>
                    </Card>
                ) : (
                    <Grid container spacing={3}>
                        {surveys.map(s => (
                            <Grid item xs={12} key={s.id}>
                                <Card sx={{ borderRadius: 4, '&:hover': { boxShadow: '0 8px 16px rgba(0,0,0,0.1)' } }}>
                                    <CardContent sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'space-between', alignItems: 'center', p: 3 }}>
                                        <Box sx={{ flexGrow: 1 }}>
                                            <Typography variant="h6" sx={{ fontWeight: 700 }}>{s.title}</Typography>
                                            <Typography variant="body2" sx={{ color: '#666', mt: 0.5, mb: 1 }}>{s.description || 'Avalie nossos serviços.'}</Typography>
                                            <Typography variant="caption" sx={{ color: '#888', fontWeight: 'bold' }}>{s.question_count} perguntas</Typography>
                                        </Box>
                                        <Button 
                                            variant="contained" 
                                            startIcon={<PlayIcon />} 
                                            sx={{ bgcolor: '#1b5e20', minWidth: 160 }}
                                            onClick={() => navigate(`/responder/questionario/${s.id}`)}
                                        >
                                            RESPONDER
                                        </Button>
                                    </CardContent>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>
                )}
            </Box>
        </Box>
    );
}

export default UserDashboardPage;
