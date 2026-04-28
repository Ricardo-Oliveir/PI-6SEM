import React, { useState, useEffect } from 'react';
import { Box, Grid, Paper, Typography, CircularProgress, Stack, Fade, Chip } from '@mui/material';
import { Bar, Doughnut } from 'react-chartjs-2';
import { 
    Chart as ChartJS, 
    CategoryScale, 
    LinearScale, 
    BarElement, 
    Title, 
    Tooltip, 
    Legend, 
    ArcElement 
} from 'chart.js';
import api from '../services/api';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

function PublicTVDashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());

    const fetchData = async () => {
        try {
            const res = await api.get('/api/public/dashboard-data');
            setStats(res.data);
            setLoading(false);
        } catch (error) {
            console.error("Erro ao carregar dados da TV:", error);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 180000); // Atualiza a cada 3 minutos (180.000 ms)
        const clock = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => {
            clearInterval(interval);
            clearInterval(clock);
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
                bgcolor: '#f8fafc',
                color: '#1e293b'
            }}>
                <CircularProgress size={80} sx={{ color: '#2e7d32' }} />
                <Typography variant="h4" sx={{ mt: 4, fontWeight: 900, letterSpacing: 2 }}>INICIALIZANDO MONITOR VIDA MAIS...</Typography>
            </Box>
        );
    }

    const engagementRate = stats.engagementRate || "0.0";

    const barData = {
        labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
        datasets: [
            {
                label: 'Questionários Respondidos',
                data: stats.monthlyCounts,
                backgroundColor: '#22c55e', 
                borderRadius: 8,
            },
            {
                label: 'Novas Pesquisas',
                data: stats.monthlyQuestionnaireCounts,
                backgroundColor: '#3b82f6',
                borderRadius: 8,
            }
        ]
    };

    const doughnutData = {
        labels: ['Participações', 'Pendentes'],
        datasets: [{
            data: [stats.responses, Math.max(0, (stats.totalUsers * stats.totalQuestionnaires) - stats.responses)],
            backgroundColor: ['#22c55e', 'rgba(255,255,255,0.1)'],
            borderWidth: 0,
        }]
    };

    return (
        <Box sx={{ 
            minHeight: '100vh', 
            bgcolor: '#f8fafc', // Light Professional Gray
            color: '#1e293b',
            p: { xs: 2, md: 3 },
            display: 'flex',
            flexDirection: 'column',
            gap: 2
        }}>
            {/* Header Compacto */}
            <Paper elevation={0} sx={{ 
                p: 2, 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                bgcolor: '#fff',
                borderRadius: 3,
                borderBottom: '4px solid #2e7d32',
                boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
            }}>
                <Stack direction="row" spacing={2} alignItems="center">
                    <Box component="img" src="/logo-sem-fundo.png" sx={{ height: 60 }} />
                    <Box>
                        <Typography variant="h5" sx={{ fontWeight: 900, color: '#1e293b' }}>VIDA MAIS MONITOR</Typography>
                        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, letterSpacing: 1 }}>PAINEL DE ENGAJAMENTO</Typography>
                    </Box>
                </Stack>
                <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="h4" sx={{ fontWeight: 900, color: '#2e7d32' }}>
                        {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 700 }}>
                        {currentTime.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </Typography>
                </Box>
            </Paper>

            <Grid container spacing={2}>
                {/* KPIs */}
                <Grid item xs={12} lg={3}>
                    <Stack spacing={2} sx={{ height: 400 }}>
                        <KPIBox title="ENGAJAMENTO" value={`${engagementRate}%`} color="#2e7d32" icon="🎯" />
                        <KPIBox title="RESPOSTAS" value={stats.responses} color="#0277bd" icon="💬" />
                        <KPIBox title="COLABORADORES" value={stats.totalUsers} color="#f59e0b" icon="👥" />
                    </Stack>
                </Grid>

                {/* Gráfico */}
                <Grid item xs={12} lg={6}>
                    <Paper sx={{ p: 3, height: 400, bgcolor: '#fff', borderRadius: 4, boxShadow: '0 2px 15px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <Typography variant="h6" sx={{ mb: 2, fontWeight: 800 }}>Fluxo Mensal de Engajamento</Typography>
                        <Box sx={{ flex: 1, minHeight: 0 }}>
                            <Bar 
                                data={barData} 
                                options={{
                                    maintainAspectRatio: false,
                                    responsive: true,
                                    plugins: { legend: { labels: { font: { size: 14, weight: 'bold' } } } },
                                    scales: {
                                        y: { beginAtZero: true, ticks: { font: { size: 12 } }, grid: { color: '#f1f5f9' } },
                                        x: { ticks: { font: { size: 12, weight: 600 } }, grid: { display: false } }
                                    }
                                }} 
                            />
                        </Box>
                    </Paper>
                </Grid>

                {/* Distribuição */}
                <Grid item xs={12} lg={3}>
                    <Paper sx={{ p: 3, height: 400, bgcolor: '#fff', borderRadius: 4, boxShadow: '0 2px 15px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'hidden' }}>
                        <Typography variant="h6" sx={{ mb: 2, fontWeight: 800 }}>Distribuição</Typography>
                        <Box sx={{ flex: 1, width: '100%', position: 'relative', minHeight: 0 }}>
                            <Doughnut data={doughnutData} options={{ maintainAspectRatio: false, responsive: true, plugins: { legend: { display: false } } }} />
                        </Box>
                        <Box sx={{ mt: 2, width: '100%', p: 1.5, bgcolor: '#f0fdf4', borderRadius: 2, textAlign: 'center', border: '1px dashed #2e7d32' }}>
                            <Typography variant="h5" sx={{ color: '#2e7d32', fontWeight: 900 }}>{stats.totalUsers + stats.totalQuestionnaires}</Typography>
                            <Typography variant="caption" sx={{ color: '#166534', fontWeight: 800 }}>REGISTROS TOTAIS</Typography>
                        </Box>
                    </Paper>
                </Grid>

                {/* Listas Inferiores Compactas */}
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2, borderRadius: 4, bgcolor: '#fff', border: '1px solid #e2e8f0', height: '180px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 900, color: '#2e7d32', display: 'flex', alignItems: 'center', gap: 1 }}>
                            🤝 PARTICIPANTES RECENTES
                        </Typography>
                        <Box className="carousel-container" sx={{ flex: 1 }}>
                            <Box className="carousel-track" sx={{ animationDuration: `${Math.max(20, stats.respondents.length * 4)}s` }}>
                                {(stats.respondents.length > 0 ? [...stats.respondents, ...stats.respondents] : [{ name: "Aguardando...", questionnaire: "" }]).map((res, i) => (
                                    <Box key={i} sx={{ px: 2, py: 1, mb: 1, bgcolor: '#f0fdf4', borderRadius: 2, border: '1px solid #dcfce7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#166534' }}>{res.name}</Typography>
                                        {res.questionnaire && <Chip label={res.questionnaire} size="small" sx={{ height: 20, fontSize: '0.65rem', bgcolor: '#2e7d32', color: '#fff', fontWeight: 800 }} />}
                                    </Box>
                                ))}
                            </Box>
                        </Box>
                    </Paper>
                </Grid>

                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2, borderRadius: 4, bgcolor: '#fff', border: '1px solid #e2e8f0', height: '180px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 900, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 1 }}>
                            ⏳ PENDÊNCIAS ATIVAS
                        </Typography>
                        <Box className="carousel-container" sx={{ flex: 1 }}>
                            <Box className="carousel-track" sx={{ animationDuration: `${Math.max(20, stats.pendingUsers.length * 4)}s` }}>
                                {(stats.pendingUsers.length > 0 ? [...stats.pendingUsers, ...stats.pendingUsers] : ["Sem pendências"]).map((user, i) => (
                                    <Box key={i} sx={{ px: 2, py: 1, mb: 1, bgcolor: '#fef2f2', borderRadius: 2, border: '1px solid #fee2e2', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Typography variant="body2" sx={{ fontWeight: 800, color: '#991b1b' }}>{typeof user === 'string' ? user : user.full_name}</Typography>
                                        {user.questionnaire && <Chip label={user.questionnaire} size="small" sx={{ height: 20, fontSize: '0.65rem', bgcolor: '#dc2626', color: '#fff', fontWeight: 800 }} />}
                                    </Box>
                                ))}
                            </Box>
                        </Box>
                    </Paper>
                </Grid>
            </Grid>

            {/* Rodapé Discreto */}
            <Box sx={{ textAlign: 'center', opacity: 0.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 700 }}>
                    SISTEMA VIDA MAIS • ATUALIZADO EM {currentTime.toLocaleTimeString()}
                </Typography>
            </Box>
        </Box>
    );
}

function KPIBox({ title, value, color, icon }) {
    return (
        <Paper sx={{ 
            p: 2, 
            bgcolor: '#fff', 
            borderRadius: 3, 
            boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
            borderLeft: `6px solid ${color}`
        }}>
            <Box sx={{ position: 'absolute', right: -5, top: -5, fontSize: '60px', opacity: 0.05 }}>{icon}</Box>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 900 }}>{title}</Typography>
            <Typography variant="h4" sx={{ fontWeight: 950, color: color }}>{value}</Typography>
        </Paper>
    );
}

export default PublicTVDashboard;
