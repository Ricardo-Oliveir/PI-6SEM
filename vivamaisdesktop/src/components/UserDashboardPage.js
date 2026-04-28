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
                <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, color: '#1b5e20', fontSize: { xs: '2rem', md: '2.5rem' } }}>
                    Bem-vindo, {user.full_name || 'Participante'}
                </Typography>
                <Typography sx={{ color: '#555', mb: 4, fontSize: '1.2rem', lineHeight: 1.6 }}>
                    Estas são as pesquisas de satisfação disponíveis para você responder no momento.
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
                                            <Typography variant="h5" sx={{ fontWeight: 800, color: '#333' }}>{s.title}</Typography>
                                            <Typography variant="body1" sx={{ color: '#555', mt: 1, mb: 2, fontSize: '1.1rem' }}>{s.description || 'Sua opinião é muito importante para nós.'}</Typography>
                                            <Typography variant="body2" sx={{ color: '#1b5e20', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1 }}>{s.question_count} perguntas</Typography>
                                        </Box>
                                        <Button 
                                            variant="contained" 
                                            startIcon={<PlayIcon sx={{ fontSize: 32 }} />} 
                                            sx={{ 
                                                bgcolor: '#1b5e20', 
                                                minWidth: 200, 
                                                py: 2, 
                                                borderRadius: 3, 
                                                fontSize: '1.2rem', 
                                                fontWeight: 800,
                                                boxShadow: '0 4px 12px rgba(27,94,32,0.3)'
                                            }}
                                            onClick={() => navigate(`/responder/questionario/${s.id}`)}
                                        >
                                            RESPONDER AGORA
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
