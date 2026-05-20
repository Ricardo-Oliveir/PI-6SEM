import React, { useState, useEffect } from 'react';
import { Box, Grid, Paper, Typography, CircularProgress, Stack, Fade, Chip, IconButton, LinearProgress } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
    Brightness4 as Brightness4Icon,
    Brightness7 as Brightness7Icon
} from '@mui/icons-material';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    Filler
} from 'chart.js';
import api from '../services/api';
import { useColorMode } from '../context/ThemeContext';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    Filler
);

function PublicTVDashboard() {
    const theme = useTheme();
    const { mode, toggleColorMode } = useColorMode();
    const isDark = theme.palette.mode === 'dark';
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [activeSlide, setActiveSlide] = useState(0);
    const [selectedQuestionnaire] = useState('auto'); // 'auto', 'all', ou ID
    const [rotationIndex, setRotationIndex] = useState(0);

    const getRotationList = () => {
        const details = (stats && stats.questionnairesDetails) || [];
        return ['all', ...details.map(q => q.id)];
    };

    const rotationList = getRotationList();
    const activeQId = selectedQuestionnaire === 'auto'
        ? (rotationList[rotationIndex % rotationList.length] || 'all')
        : selectedQuestionnaire;

    const fetchData = async (qId) => {
        try {
            const url = `/api/public/dashboard-data${qId && qId !== 'all' ? `?questionnaireId=${qId}` : ''}`;
            const res = await api.get(url);
            setStats(prevStats => {
                const newStats = res.data;
                if (!newStats.questionnairesDetails || newStats.questionnairesDetails.length === 0) {
                    newStats.questionnairesDetails = prevStats ? prevStats.questionnairesDetails : [];
                }
                return newStats;
            });
            setLoading(false);
        } catch (error) {
            console.error("Erro ao carregar dados da TV:", error);
            setStats(prevStats => ({
                totalUsers: 0,
                totalQuestionnaires: 0,
                responses: 0,
                engagementRate: "0.0",
                activity: "0.0",
                monthlyCounts: new Array(12).fill(0),
                monthlyQuestionnaireCounts: new Array(12).fill(0),
                respondents: [],
                pendingUsers: [],
                questionnairesDetails: prevStats ? prevStats.questionnairesDetails : []
            }));
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData(activeQId);
    }, [activeQId]);

    useEffect(() => {
        const refreshInterval = setInterval(() => {
            fetchData(activeQId);
        }, 180000); // 3 minutos

        return () => clearInterval(refreshInterval);
    }, [activeQId]);

    useEffect(() => {
        if (selectedQuestionnaire !== 'auto') return;
        const list = getRotationList();
        if (list.length <= 1) return;

        const interval = setInterval(() => {
            setRotationIndex(prev => (prev + 1) % list.length);
        }, 20000); // Rotaciona a cada 20 segundos

        return () => clearInterval(interval);
    }, [selectedQuestionnaire, stats?.questionnairesDetails]);

    useEffect(() => {
        const clock = setInterval(() => setCurrentTime(new Date()), 1000);
        const slideTimer = setInterval(() => {
            setActiveSlide(prev => (prev + 1) % 3);
        }, 12000);

        return () => {
            clearInterval(clock);
            clearInterval(slideTimer);
        };
    }, []);

    if (loading || !stats) {
        return (
            <Box sx={{
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'background.default',
                color: 'text.primary',
                p: 3
            }}>
                <CircularProgress size={80} sx={{ color: 'primary.main' }} />
                <Typography variant="h4" sx={{ mt: 4, fontWeight: 900, textAlign: 'center', fontSize: { xs: '1.5rem', md: '2.125rem' } }}>
                    INICIALIZANDO MONITOR VIDA MAIS...
                </Typography>
            </Box>
        );
    }

    const engagementRate = stats.engagementRate || "0.0";

    // Dados do card de engajamento ativo na TV (usa o questionário da rotação atual)
    const tvActiveCardData = (() => {
        const details = stats.questionnairesDetails || [];
        if (activeQId && activeQId !== 'all') {
            const found = details.find(d => d.id === activeQId);
            if (found) return found;
        }
        // Modo "all" — rotaciona pelos detalhes se houver mais de um
        if (details.length > 0) {
            return details[rotationIndex % details.length];
        }
        return { title: null, engagementRate: parseFloat(engagementRate), engagementGoal: stats.engagementGoal || 80 };
    })();

    const tvActiveRate = tvActiveCardData.engagementRate ?? parseFloat(engagementRate);
    const tvActiveGoal = tvActiveCardData.engagementGoal ?? (stats.engagementGoal || 80);
    const tvActiveTitle = tvActiveCardData.title || null;

    const engagementData = {
        labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
        datasets: [
            {
                label: 'Respondidos',
                data: stats.monthlyCounts || new Array(12).fill(0),
                backgroundColor: '#22c55e',
                borderRadius: 8,
            },
            {
                label: 'Novas Pesquisas',
                data: stats.monthlyQuestionnaireCounts || new Array(12).fill(0),
                backgroundColor: '#3b82f6',
                borderRadius: 8,
            }
        ]
    };

    const goalData = {
        labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
        datasets: [
            {
                label: 'Engajamento (%)',
                data: (() => {
                    let cumulativeSum = 0;
                    return (stats.monthlyCounts || new Array(12).fill(0)).map(val => {
                        cumulativeSum += val;
                        const potential = (stats.totalUsers * stats.totalQuestionnaires) || 1;
                        return ((cumulativeSum / potential) * 100).toFixed(1);
                    });
                })(),
                borderColor: '#2e7d32',
                backgroundColor: 'rgba(46, 125, 50, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 4,
            },
            {
                label: `Meta (${tvActiveGoal}%)`,
                data: new Array(12).fill(tvActiveGoal),
                borderColor: '#dc2626',
                borderDash: [5, 5],
                pointRadius: 0,
                fill: false
            }
        ]
    };

    const dailyLabels = stats.dailyCounts ? Array.from({ length: stats.dailyCounts.length }, (_, i) => `${i + 1}`) : [];
    const monthlyDailyData = {
        labels: dailyLabels,
        datasets: [
            {
                label: 'Respostas do Dia',
                data: stats.dailyCounts || [],
                backgroundColor: '#2e7d32',
                borderRadius: 4,
            }
        ]
    };

    const doughnutData = {
        labels: ['Participações', 'Pendentes'],
        datasets: [{
            data: [stats.responses, Math.max(0, (stats.totalUsers * stats.totalQuestionnaires) - stats.responses)],
            backgroundColor: ['#22c55e', isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0,0,0,0.05)'],
            borderWidth: 0,
        }]
    };

    const chartOptions = {
        maintainAspectRatio: false,
        responsive: true,
        plugins: {
            legend: {
                position: 'top',
                labels: { font: { size: 12, weight: 'bold' }, usePointStyle: true, boxWidth: 8, color: theme.palette.text.primary }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: { font: { size: 10 }, color: theme.palette.text.secondary },
                grid: { color: isDark ? 'rgba(255, 255, 255, 0.08)' : '#f1f5f9' }
            },
            x: {
                ticks: { font: { size: 10, weight: 600 }, color: theme.palette.text.secondary },
                grid: { display: false }
            }
        }
    };

    return (
        <Box sx={{
            minHeight: '100vh',
            bgcolor: 'background.default',
            color: 'text.primary',
            p: { xs: 1, sm: 2, md: 3 },
            display: 'flex',
            flexDirection: 'column',
            gap: { xs: 1, md: 2 }
        }}>
            {/* Header Responsivo */}
            <Paper elevation={0} sx={{
                p: { xs: 1.5, md: 2 },
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                justifyContent: 'space-between',
                alignItems: 'center',
                textAlign: { xs: 'center', sm: 'left' },
                bgcolor: 'background.paper',
                color: 'text.primary',
                borderRadius: 3,
                borderBottom: '4px solid #2e7d32',
                boxShadow: isDark ? 'none' : '0 2px 10px rgba(0,0,0,0.05)',
                border: isDark ? '1px solid rgba(255,255,255,0.08)' : 'none',
                gap: { xs: 2, sm: 0 }
            }}>
                <Stack direction="row" spacing={2} alignItems="center">
                    <Box component="img" src="/logo-sem-fundo.png" sx={{ height: { xs: 40, md: 60 } }} />
                    <Box>
                        <Typography variant="h5" sx={{ fontWeight: 900, color: 'text.primary', fontSize: { xs: '1.1rem', md: '1.5rem' } }}>
                            VIDA MAIS MONITOR
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, letterSpacing: 1, display: { xs: 'none', sm: 'block' } }}>
                            {activeQId === 'all' ? "PAINEL DE ENGAJAMENTO (TODAS)" : `PESQUISA: ${(stats?.questionnairesDetails?.find(q => q.id === activeQId)?.title || 'CARREGANDO...').toUpperCase()}`}
                        </Typography>
                    </Box>
                </Stack>
                <Stack direction="row" spacing={2} alignItems="center">
                    <IconButton onClick={toggleColorMode} color="inherit" sx={{ mr: { xs: 0, sm: 1 } }}>
                        {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
                    </IconButton>
                    <Box sx={{ textAlign: { xs: 'center', sm: 'right' } }}>
                        <Typography variant="h4" sx={{ fontWeight: 900, color: 'primary.light', fontSize: { xs: '1.5rem', md: '2.125rem' } }}>
                            {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 700, fontSize: { xs: '0.75rem', md: '0.875rem' } }}>
                            {currentTime.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </Typography>
                    </Box>
                </Stack>
            </Paper>

            <Grid container spacing={2}>
                {/* KPIs - 1 coluna em mobile, 2 em tablet, 4 em monitor/TV se sozinhos, mas aqui ficam na lateral */}
                <Grid item xs={12} lg={3}>
                    <Grid container spacing={1.5}>
                        <Grid item xs={6} sm={3} lg={12}>
                            <Paper sx={{
                                p: { xs: 1, md: 2 },
                                bgcolor: 'background.paper',
                                color: 'text.primary',
                                borderRadius: 3,
                                boxShadow: isDark ? 'none' : '0 2px 10px rgba(0,0,0,0.02)',
                                border: isDark ? '1px solid rgba(255,255,255,0.08)' : 'none',
                                height: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                position: 'relative',
                                overflow: 'hidden',
                                borderLeft: { xs: '4px solid #2e7d32', md: '6px solid #2e7d32' }
                            }}>
                                <Box sx={{ position: 'absolute', right: -5, top: -5, fontSize: { xs: '30px', md: '60px' }, opacity: isDark ? 0.15 : 0.05 }}>🎯</Box>

                                <Box>
                                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 900, fontSize: { xs: '0.6rem', md: '0.75rem' }, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {tvActiveTitle ? tvActiveTitle.toUpperCase() : (activeQId === 'all' ? "ENGAJAMENTO" : "ENGAJAMENTO FILTRADO")}
                                    </Typography>

                                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.5 }}>
                                        <Typography variant="h4" sx={{ fontWeight: 950, color: '#2e7d32', fontSize: { xs: '1.2rem', md: '2.125rem' } }}>
                                            {typeof tvActiveRate === 'number' ? tvActiveRate.toFixed(1) : tvActiveRate}%
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 800, fontSize: { xs: '0.65rem', md: '0.85rem' } }}>
                                            (Meta: {tvActiveGoal}%)
                                        </Typography>
                                    </Box>
                                </Box>

                                <Box sx={{ mt: 1 }}>
                                    <LinearProgress
                                        variant="determinate"
                                        value={Math.min(100, parseFloat(tvActiveRate))}
                                        sx={{
                                            height: 4,
                                            borderRadius: 2,
                                            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                                            '& .MuiLinearProgress-bar': {
                                                backgroundColor: parseFloat(tvActiveRate) >= tvActiveGoal ? '#2e7d32' : '#f57c00'
                                            }
                                        }}
                                    />
                                    {/* Pontinhos de paginação quando há múltiplos questionários */}
                                    {(stats.questionnairesDetails || []).length > 1 && (
                                        <Stack direction="row" spacing={0.5} justifyContent="center" sx={{ mt: 0.5 }}>
                                            {(stats.questionnairesDetails || []).map((_, i) => (
                                                <Box key={i} sx={{
                                                    width: i === (rotationIndex % (stats.questionnairesDetails || []).length) ? 12 : 5,
                                                    height: 3,
                                                    borderRadius: 2,
                                                    bgcolor: i === (rotationIndex % (stats.questionnairesDetails || []).length) ? '#2e7d32' : (isDark ? 'rgba(255,255,255,0.2)' : '#cbd5e1'),
                                                    transition: 'all 0.3s'
                                                }} />
                                            ))}
                                        </Stack>
                                    )}
                                </Box>
                            </Paper>
                        </Grid>
                        <Grid item xs={6} sm={3} lg={12}>
                            <KPIBox title="RESPOSTAS" value={stats.responses} color="#0277bd" icon="💬" />
                        </Grid>
                        <Grid item xs={6} sm={3} lg={12}>
                            <KPIBox title="PESQUISAS" value={stats.totalQuestionnaires} color="#9c27b0" icon="📋" />
                        </Grid>
                        <Grid item xs={6} sm={3} lg={12}>
                            <KPIBox title="COLABORADORES" value={stats.totalUsers} color="#f59e0b" icon="👥" />
                        </Grid>
                    </Grid>
                </Grid>

                {/* Gráfico Principal */}
                <Grid item xs={12} md={8} lg={6}>
                    <Paper sx={{
                        p: { xs: 1.5, md: 3 },
                        height: { xs: 300, md: 400 },
                        bgcolor: 'background.paper',
                        color: 'text.primary',
                        borderRadius: 4,
                        boxShadow: isDark ? 'none' : '0 2px 15px rgba(0,0,0,0.03)',
                        border: isDark ? '1px solid rgba(255,255,255,0.08)' : 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        position: 'relative'
                    }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1, fontSize: { xs: '0.9rem', md: '1.25rem' } }}>
                            {activeSlide === 0 && "📊 Fluxo de Engajamento Anual"}
                            {activeSlide === 1 && "🎯 Evolução vs Meta"}
                            {activeSlide === 2 && `📅 Mensal (${currentTime.toLocaleString('pt-BR', { month: 'short' })})`}
                        </Typography>

                        <Box sx={{ flex: 1, minHeight: 0 }}>
                            {activeSlide === 0 && <Fade in={activeSlide === 0} timeout={1000}><Box sx={{ height: '100%' }}><Bar data={engagementData} options={chartOptions} /></Box></Fade>}
                            {activeSlide === 1 && <Fade in={activeSlide === 1} timeout={1000}><Box sx={{ height: '100%' }}><Line data={goalData} options={chartOptions} /></Box></Fade>}
                            {activeSlide === 2 && <Fade in={activeSlide === 2} timeout={1000}><Box sx={{ height: '100%' }}><Bar data={monthlyDailyData} options={chartOptions} /></Box></Fade>}
                        </Box>

                        <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 1 }}>
                            {[0, 1, 2].map(i => (
                                <Box key={i} sx={{
                                    width: activeSlide === i ? 20 : 6,
                                    height: 6,
                                    borderRadius: 3,
                                    bgcolor: activeSlide === i ? 'primary.main' : (isDark ? 'rgba(255,255,255,0.2)' : '#cbd5e1'),
                                    transition: '0.3s'
                                }} />
                            ))}
                        </Stack>
                    </Paper>
                </Grid>

                {/* Distribuição - Escondido em mobile muito pequeno ou movido */}
                <Grid item xs={12} md={4} lg={3}>
                    <Paper sx={{
                        p: 3,
                        height: { xs: 250, md: 400 },
                        bgcolor: 'background.paper',
                        color: 'text.primary',
                        borderRadius: 4,
                        boxShadow: isDark ? 'none' : '0 2px 15px rgba(0,0,0,0.03)',
                        border: isDark ? '1px solid rgba(255,255,255,0.08)' : 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center'
                    }}>
                        <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 800 }}>Distribuição</Typography>
                        <Box sx={{ flex: 1, width: '100%', position: 'relative', minHeight: 0 }}>
                            <Doughnut data={doughnutData} options={{ maintainAspectRatio: false, responsive: true, plugins: { legend: { display: false } } }} />
                        </Box>
                        <Box sx={{ mt: 1.5, width: '100%', p: 1, bgcolor: isDark ? 'rgba(46, 125, 50, 0.08)' : '#f0fdf4', borderRadius: 2, textAlign: 'center', border: '1px dashed #2e7d32' }}>
                            <Typography variant="h6" sx={{ color: isDark ? 'primary.light' : '#2e7d32', fontWeight: 900 }}>{stats.totalUsers + stats.totalQuestionnaires}</Typography>
                            <Typography variant="caption" sx={{ color: isDark ? 'primary.light' : '#166534', fontWeight: 800, fontSize: '0.65rem' }}>REGISTROS TOTAIS</Typography>
                        </Box>
                    </Paper>
                </Grid>

                {/* Listas Inferiores */}
                <Grid item xs={12} md={6}>
                    <Paper sx={{
                        p: 2,
                        borderRadius: 4,
                        bgcolor: 'background.paper',
                        color: 'text.primary',
                        border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0',
                        height: { xs: 150, md: 180 },
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden'
                    }}>
                        <Typography variant="caption" sx={{ mb: 1, fontWeight: 900, color: isDark ? 'primary.light' : '#2e7d32', display: 'flex', alignItems: 'center', gap: 1, textTransform: 'uppercase' }}>
                            🤝 Participantes Recentes
                        </Typography>
                        <Box className="carousel-container" sx={{ flex: 1 }}>
                            <Box className="carousel-track" sx={{ animationDuration: `${Math.max(20, stats.respondents.length * 4)}s` }}>
                                {(stats.respondents.length > 0 ? [...stats.respondents, ...stats.respondents] : [{ name: "Aguardando...", questionnaire: "" }]).map((res, i) => (
                                    <Box key={i} sx={{ px: 1.5, py: 0.8, mb: 1, bgcolor: isDark ? 'rgba(46, 125, 50, 0.08)' : '#f0fdf4', borderRadius: 2, border: isDark ? '1px solid rgba(46, 125, 50, 0.2)' : '1px solid #dcfce7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Typography variant="caption" sx={{ fontWeight: 700, color: isDark ? 'primary.light' : '#166534' }}>{res.name}</Typography>
                                        {res.questionnaire && <Chip label={res.questionnaire} size="small" sx={{ height: 16, fontSize: '0.55rem', bgcolor: '#2e7d32', color: '#fff', fontWeight: 800 }} />}
                                    </Box>
                                ))}
                            </Box>
                        </Box>
                    </Paper>
                </Grid>

                <Grid item xs={12} md={6}>
                    <Paper sx={{
                        p: 2,
                        borderRadius: 4,
                        bgcolor: 'background.paper',
                        color: 'text.primary',
                        border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0',
                        height: { xs: 150, md: 180 },
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden'
                    }}>
                        <Typography variant="caption" sx={{ mb: 1, fontWeight: 900, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 1, textTransform: 'uppercase' }}>
                            ⏳ Pendências Ativas
                        </Typography>
                        <Box className="carousel-container" sx={{ flex: 1 }}>
                            <Box className="carousel-track" sx={{ animationDuration: `${Math.max(20, stats.pendingUsers.length * 4)}s` }}>
                                {(stats.pendingUsers.length > 0 ? [...stats.pendingUsers, ...stats.pendingUsers] : ["Sem pendências"]).map((user, i) => (
                                    <Box key={i} sx={{ px: 1.5, py: 0.8, mb: 1, bgcolor: isDark ? 'rgba(220, 38, 38, 0.08)' : '#fef2f2', borderRadius: 2, border: isDark ? '1px solid rgba(220, 38, 38, 0.2)' : '1px solid #fee2e2', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Typography variant="caption" sx={{ fontWeight: 800, color: isDark ? '#ef4444' : '#991b1b' }}>{typeof user === 'string' ? user : user.full_name}</Typography>
                                        {user.questionnaire && <Chip label={user.questionnaire} size="small" sx={{ height: 16, fontSize: '0.55rem', bgcolor: '#dc2626', color: '#fff', fontWeight: 800 }} />}
                                    </Box>
                                ))}
                            </Box>
                        </Box>
                    </Paper>
                </Grid>
            </Grid>

            {/* Footer */}
            <Box sx={{ textAlign: 'center', opacity: 0.5, py: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.65rem' }}>
                    SISTEMA VIDA MAIS • ATUALIZADO EM {currentTime.toLocaleTimeString()}
                </Typography>
            </Box>
        </Box>
    );
}

function KPIBox({ title, value, color, icon }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    return (
        <Paper sx={{
            p: { xs: 1, md: 2 },
            bgcolor: 'background.paper',
            color: 'text.primary',
            borderRadius: 3,
            boxShadow: isDark ? 'none' : '0 2px 10px rgba(0,0,0,0.02)',
            border: isDark ? '1px solid rgba(255,255,255,0.08)' : 'none',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
            borderLeft: { xs: `4px solid ${color}`, md: `6px solid ${color}` }
        }}>
            <Box sx={{ position: 'absolute', right: -5, top: -5, fontSize: { xs: '30px', md: '60px' }, opacity: isDark ? 0.15 : 0.05 }}>{icon}</Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 900, fontSize: { xs: '0.6rem', md: '0.75rem' } }}>{title}</Typography>
            <Typography variant="h4" sx={{ fontWeight: 950, color: color, fontSize: { xs: '1.2rem', md: '2.125rem' } }}>{value}</Typography>
        </Paper>
    );
}

export default PublicTVDashboard;
