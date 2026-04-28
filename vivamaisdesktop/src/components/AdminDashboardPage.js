import React, { useState, useEffect } from 'react';
import { Box, Grid, Paper, Typography, MenuItem, Select, FormControl, InputLabel, Stack, CircularProgress, Alert } from '@mui/material';
import { People as PeopleIcon, AutoAwesome as IAIcon, BarChart as ChartIcon } from '@mui/icons-material';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import api from '../services/api';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function AdminDashboardPage() {
    const [userData, setUserData] = useState({ full_name: 'Usuário' });
    const [selectedYear, setSelectedYear] = useState(2026);
    const [selectedMonth, setSelectedMonth] = useState(-1); // -1 = Todos
    const [monthlyData, setMonthlyData] = useState(new Array(12).fill(0));
    const [monthlyQuestionnaireData, setMonthlyQuestionnaireData] = useState(new Array(12).fill(0));
    const [dailyData, setDailyData] = useState([]);
    const [dailyQuestionnaireData, setDailyQuestionnaireData] = useState([]);
    const [stats, setStats] = useState({
        totalUsers: 0,
        totalQuestionnaires: 0,
        responses: 0,
        activity: "0.0"
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [pendingUsers, setPendingUsers] = useState([]);
    const [respondents, setRespondents] = useState([]);
    const [batchSize, setBatchSize] = useState(5);
    const [realTotalResponses, setRealTotalResponses] = useState(0);

    const years = [2026];
    const months = [
        { val: -1, label: "Todos os meses" },
        { val: 0, label: "Janeiro" }, { val: 1, label: "Fevereiro" }, { val: 2, label: "Março" },
        { val: 3, label: "Abril" }, { val: 4, label: "Maio" }, { val: 5, label: "Junho" },
        { val: 6, label: "Julho" }, { val: 7, label: "Agosto" }, { val: 8, label: "Setembro" },
        { val: 9, label: "Outubro" }, { val: 10, label: "Novembro" }, { val: 11, label: "Dezembro" }
    ];

    const fetchStats = async () => {
        setLoading(true);
        try {
            const url = `/api/dashboard-data?year=${selectedYear}${selectedMonth !== -1 ? `&month=${selectedMonth}` : ''}`;
            const res = await api.get(url);
            setStats({
                totalUsers: res.data.totalUsers || 0,
                totalQuestionnaires: res.data.totalQuestionnaires || 0,
                responses: res.data.responses || 0,
                activity: res.data.activity || "0.0",
                engagementRate: res.data.engagementRate || "0.0"
            });
            if (res.data.monthlyCounts) {
                setMonthlyData(res.data.monthlyCounts);
            }
            if (res.data.monthlyQuestionnaireCounts) {
                setMonthlyQuestionnaireData(res.data.monthlyQuestionnaireCounts);
            }
            if (res.data.dailyCounts) {
                setDailyData(res.data.dailyCounts);
            }
            if (res.data.dailyQuestionnaireCounts) {
                setDailyQuestionnaireData(res.data.dailyQuestionnaireCounts);
            }
            setPendingUsers(res.data.pendingUsers || []);
            setRespondents(res.data.respondents || []);
            setBatchSize(res.data.batchSize || 5);
            setRealTotalResponses(res.data.realTotalResponses || 0);
            setError('');
        } catch (err) {
            console.error("Erro ao carregar dashboard:", err);
            setError('Falha ao sincronizar dados com o servidor.');
        } finally {
            setLoading(false);
        }
    };

    const engagementRate = stats.engagementRate || "0.0";

    useEffect(() => {
        const stored = localStorage.getItem('user_data');
        if (stored) setUserData(JSON.parse(stored));
        fetchStats();
    }, [selectedYear, selectedMonth]);

    const chartData = {
        labels: selectedMonth === -1 
            ? ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
            : Array.from({ length: dailyData.length }, (_, i) => `${i + 1}`),
        datasets: [
            {
                label: selectedMonth === -1 ? 'Fluxo de Questionários' : `Questionários (${months.find(m => m.val === selectedMonth)?.label})`,
                data: selectedMonth === -1 ? monthlyData : dailyData,
                backgroundColor: 'rgba(27, 94, 32, 0.7)',
                borderColor: '#1b5e20',
                borderWidth: 2,
                borderRadius: 4,
                hoverBackgroundColor: '#1b5e20',
            },
            {
                label: selectedMonth === -1 ? 'Novos Questionários' : 'Novos Questionários',
                data: selectedMonth === -1 ? monthlyQuestionnaireData : dailyQuestionnaireData,
                backgroundColor: 'rgba(2, 136, 209, 0.7)',
                borderColor: '#0288d1',
                borderWidth: 2,
                borderRadius: 4,
                hoverBackgroundColor: '#0288d1',
            }
        ]
    };

    if (loading && stats.responses === 0) {
        return <Box display="flex" justifyContent="center" alignItems="center" height="80vh"><CircularProgress color="success" /></Box>;
    }

    return (
        <Box sx={{ p: { xs: 2, md: 4 }, bgcolor: '#f4f6f8', minHeight: '100vh' }}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems="center" spacing={2} sx={{ mb: 4 }}>
                <Box sx={{ flex: 1, minWidth: { xs: '100%', md: 'auto' } }}>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: '#1b5e20', fontSize: { xs: '1.75rem', sm: '2.125rem', lg: '2.5rem' } }}>Olá, {userData?.full_name?.split(' ')[0] || 'Gestor'}!</Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>Acompanhe os indicadores de engajamento do Vida Mais.</Typography>
                </Box>
                
                <Stack direction="row" spacing={2}>
                    <FormControl size="small" sx={{ minWidth: 150 }}>
                        <InputLabel>Mês</InputLabel>
                        <Select
                            value={selectedMonth}
                            label="Mês"
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            sx={{ bgcolor: '#fff', borderRadius: 2 }}
                        >
                            {months.map(m => <MenuItem key={m.val} value={m.val}>{m.label}</MenuItem>)}
                        </Select>
                    </FormControl>

                    <FormControl size="small" sx={{ minWidth: 100 }}>
                        <InputLabel>Ano</InputLabel>
                        <Select
                            value={selectedYear}
                            label="Ano"
                            onChange={(e) => setSelectedYear(e.target.value)}
                            sx={{ bgcolor: '#fff', borderRadius: 2 }}
                        >
                            {years.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                        </Select>
                    </FormControl>
                </Stack>
            </Stack>

            {error && <Alert severity="warning" sx={{ mb: 4, borderRadius: 3 }}>{error}</Alert>}



            <Grid container spacing={{ xs: 3, md: 5 }} rowSpacing={8} alignItems="stretch">
                <Grid item xs={12} sm={6} md={3}>
                    <Paper sx={{ 
                        p: { xs: 2, md: 2.5 }, 
                        borderRadius: 5, 
                        border: '1px solid #e2e8f0', 
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', 
                        transition: 'transform 0.2s', 
                        '&:hover': { transform: 'translateY(-4px)' } 
                    }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                            <Box sx={{ overflow: 'hidden' }}>
                                <Typography variant="overline" sx={{ color: '#64748b', fontWeight: 800, letterSpacing: 1.5, fontSize: '0.65rem', display: 'block', whiteSpace: 'nowrap' }}>ATIVIDADE MÉDIA</Typography>
                                <Typography variant="h3" sx={{ fontWeight: 900, mt: 0.5, color: '#1b5e20', fontSize: { xs: '1.8rem', md: '2rem', lg: '2.5rem' } }}>{stats.activity}</Typography>
                            </Box>
                            <IAIcon sx={{ color: '#1b5e20', fontSize: { xs: 24, md: 32 }, opacity: 0.2, ml: 1 }} />
                        </Stack>
                    </Paper>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                    <Paper sx={{ 
                        p: { xs: 2, md: 2.5 }, 
                        borderRadius: 5, 
                        border: '1px solid #e2e8f0', 
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', 
                        transition: 'transform 0.2s', 
                        '&:hover': { transform: 'translateY(-4px)' } 
                    }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                            <Box sx={{ overflow: 'hidden' }}>
                                <Typography variant="overline" sx={{ color: '#64748b', fontWeight: 800, letterSpacing: 1.5, fontSize: '0.65rem', display: 'block', whiteSpace: 'nowrap' }}>QUESTIONÁRIOS</Typography>
                                <Typography variant="h3" sx={{ fontWeight: 900, mt: 0.5, color: '#1b5e20', fontSize: { xs: '1.8rem', md: '2rem', lg: '2.5rem' } }}>{stats.responses}</Typography>
                            </Box>
                            <PeopleIcon sx={{ color: '#1b5e20', fontSize: { xs: 24, md: 32 }, opacity: 0.2, ml: 1 }} />
                        </Stack>
                    </Paper>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                    <Paper sx={{ 
                        p: { xs: 2, md: 2.5 }, 
                        borderRadius: 5, 
                        border: '1px solid #e2e8f0', 
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', 
                        transition: 'transform 0.2s', 
                        '&:hover': { transform: 'translateY(-4px)' } 
                    }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                            <Box sx={{ overflow: 'hidden' }}>
                                <Typography variant="overline" sx={{ color: '#64748b', fontWeight: 800, letterSpacing: 1.5, fontSize: '0.65rem', display: 'block', whiteSpace: 'nowrap' }}>COLABORADORES</Typography>
                                <Typography variant="h3" sx={{ fontWeight: 900, mt: 0.5, color: '#333', fontSize: { xs: '1.8rem', md: '2rem', lg: '2.5rem' } }}>{stats.totalUsers}</Typography>
                            </Box>
                            <PeopleIcon sx={{ color: '#1b5e20', fontSize: { xs: 20, md: 28 }, opacity: 0.1, ml: 1 }} />
                        </Stack>
                    </Paper>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                    <Paper sx={{ 
                        p: { xs: 2, md: 2.5 }, 
                        borderRadius: 5, 
                        border: '1px solid #e2e8f0', 
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', 
                        transition: 'transform 0.2s', 
                        '&:hover': { transform: 'translateY(-4px)' } 
                    }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                            <Box sx={{ overflow: 'hidden' }}>
                                <Typography variant="overline" sx={{ color: '#64748b', fontWeight: 800, letterSpacing: 1.5, fontSize: '0.65rem', display: 'block', whiteSpace: 'nowrap' }}>TAXA DE ENGAJAMENTO</Typography>
                                <Typography variant="h3" sx={{ fontWeight: 900, mt: 0.5, color: '#1b5e20', fontSize: { xs: '1.8rem', md: '2rem', lg: '2.5rem' } }}>{engagementRate}%</Typography>
                            </Box>
                            <ChartIcon sx={{ color: '#1b5e20', fontSize: { xs: 20, md: 28 }, opacity: 0.1, ml: 1 }} />
                        </Stack>
                    </Paper>
                </Grid>

                {/* Gráfico e Pendências Lado a Lado */}
                <Grid item xs={12} md={8.5}>
                    <Paper sx={{ 
                        p: { xs: 2, md: 3 }, 
                        borderRadius: 6, 
                        border: '1px solid #e2e8f0', 
                        boxShadow: '0 10px 30px rgba(0,0,0,0.02)',
                        bgcolor: '#fff',
                        height: '450px',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        <Typography variant="h6" sx={{ mb: 2, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 1.5, color: '#1b5e20' }}>
                            <ChartIcon sx={{ fontSize: 24 }} /> Fluxo de Questionários ({selectedYear})
                        </Typography>
                        <Box sx={{ flex: 1, minHeight: 0 }}>
                            <Bar 
                                data={chartData} 
                                options={{ 
                                    maintainAspectRatio: false, 
                                    responsive: true,
                                    scales: {
                                        y: { beginAtZero: true, border: { display: false }, grid: { color: '#f1f5f9' } },
                                        x: { border: { display: false }, grid: { display: false } }
                                    },
                                    plugins: { 
                                        legend: { 
                                            display: true, 
                                            position: 'top',
                                            labels: { usePointStyle: true, boxHeight: 6, font: { size: 10, weight: 'bold' } }
                                        }
                                    } 
                                }} 
                            />
                        </Box>
                    </Paper>
                </Grid>

                <Grid item xs={12} md={3.5}>
                    <Paper sx={{ 
                        p: 3, 
                        borderRadius: 6, 
                        height: '450px', 
                        border: '1px solid #e2e8f0', 
                        display: 'flex', 
                        flexDirection: 'column',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.02)',
                        bgcolor: '#fff'
                    }}>
                        <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 800, color: '#d32f2f', display: 'flex', alignItems: 'center', gap: 1 }}>
                            ⏳ Pendências
                        </Typography>
                        
                        <Box className="carousel-container" sx={{ flex: 1, height: '350px' }}>
                            {pendingUsers.length > 0 ? (
                                <Box className="carousel-track" sx={{ animationDuration: `${Math.max(12, pendingUsers.length * 3.5)}s` }}>
                                    {[...pendingUsers, ...pendingUsers].map((user, i) => (
                                        <Box key={i} sx={{ 
                                            p: 1.5, 
                                            mb: 1, 
                                            bgcolor: '#fffafb', 
                                            borderRadius: 3, 
                                            border: '1px solid #fee2e2', 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: 1.5
                                        }}>
                                            <Box sx={{ width: 6, height: 6, bgcolor: '#ef4444', borderRadius: '50%' }} />
                                            <Box sx={{ flex: 1 }}>
                                                <Typography variant="body2" sx={{ color: '#ef4444', fontWeight: 800, fontSize: '0.65rem', textTransform: 'uppercase' }}>
                                                    {user.questionnaire}
                                                </Typography>
                                                <Typography variant="body2" fontWeight={700} color="#334155" sx={{ fontSize: '0.85rem' }}>
                                                    {user.full_name}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    ))}
                                </Box>
                            ) : (
                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.6 }}>
                                    <Typography variant="caption" fontWeight={700}>✅ Sem pendências</Typography>
                                </Box>
                            )}
                        </Box>
                    </Paper>
                </Grid>
            </Grid>

            <Alert 
                severity="info" 
                sx={{ 
                    mt: 10, 
                    mb: 4, 
                    borderRadius: 4, 
                    border: '1px solid #b3e5fc',
                    bgcolor: '#e1f5fe',
                    '& .MuiAlert-icon': { color: '#0288d1' }
                }}
            >
                <Typography variant="subtitle2" fontWeight="bold">🛡️ Política de Anonimato Ativada (Lotes de {batchSize})</Typography>
                <Typography variant="body2">
                    Para garantir o anonimato dos colaboradores, os resultados e nomes são liberados apenas em grupos de {batchSize} pessoas. 
                    Atualmente existem {realTotalResponses} questionários respondidos totais, dos quais {stats.responses} já foram processados e anonimizados.
                </Typography>
            </Alert>
        </Box>
    );
}

export default AdminDashboardPage;