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
    const [stats, setStats] = useState({
        totalUsers: 0,
        totalQuestionnaires: 0,
        responses: 0,
        activity: "0.0"
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

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
                activity: res.data.activity || "0.0"
            });
            if (res.data.monthlyCounts) {
                setMonthlyData(res.data.monthlyCounts);
            }
            setError('');
        } catch (err) {
            console.error("Erro ao carregar dashboard:", err);
            setError('Falha ao sincronizar dados com o servidor.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const stored = localStorage.getItem('user');
        if (stored) setUserData(JSON.parse(stored));
        fetchStats();
    }, [selectedYear, selectedMonth]);

    const chartData = {
        labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
        datasets: [{
            label: 'Fluxo de Respostas',
            data: monthlyData,
            backgroundColor: 'rgba(27, 94, 32, 0.7)',
            borderColor: '#1b5e20',
            borderWidth: 2,
            borderRadius: 8,
            hoverBackgroundColor: '#1b5e20',
        }]
    };

    if (loading && stats.responses === 0) {
        return <Box display="flex" justifyContent="center" alignItems="center" height="80vh"><CircularProgress color="success" /></Box>;
    }

    return (
        <Box sx={{ p: { xs: 2, md: 4 }, bgcolor: '#f4f6f8', minHeight: '100vh' }}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems="center" spacing={2} sx={{ mb: 4 }}>
                <Box>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: '#1b5e20' }}>Olá, {userData.full_name.split(' ')[0]}! 🌿</Typography>
                    <Typography variant="body1" color="text.secondary">Acompanhe os indicadores de engajamento do Viva Mais.</Typography>
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

            <Grid container spacing={4}>
                <Grid item xs={12} sm={6} md={3}>
                    <Paper sx={{ p: 4, borderRadius: 5, border: '1px solid #e2e8f0', boxShadow: 'none', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)' } }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                            <Box>
                                <Typography variant="overline" sx={{ color: '#64748b', fontWeight: 800 }}>ATIVIDADE MÉDIA</Typography>
                                <Typography variant="h3" sx={{ fontWeight: 900, mt: 1, color: '#1b5e20' }}>{stats.activity}</Typography>
                            </Box>
                            <IAIcon sx={{ color: '#1b5e20', fontSize: 40, opacity: 0.2 }} />
                        </Stack>
                    </Paper>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                    <Paper sx={{ p: 4, borderRadius: 5, border: '1px solid #e2e8f0', boxShadow: 'none', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)' } }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                            <Box>
                                <Typography variant="overline" sx={{ color: '#64748b', fontWeight: 800 }}>RESPOSTAS</Typography>
                                <Typography variant="h3" sx={{ fontWeight: 900, mt: 1, color: '#1b5e20' }}>{stats.responses}</Typography>
                            </Box>
                            <PeopleIcon sx={{ color: '#1b5e20', fontSize: 40, opacity: 0.2 }} />
                        </Stack>
                    </Paper>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                    <Paper sx={{ p: 4, borderRadius: 5, border: '1px solid #e2e8f0', boxShadow: 'none', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)' } }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                            <Box>
                                <Typography variant="overline" sx={{ color: '#64748b', fontWeight: 800 }}>COLABORADORES</Typography>
                                <Typography variant="h3" sx={{ fontWeight: 900, mt: 1 }}>{stats.totalUsers}</Typography>
                            </Box>
                            <PeopleIcon sx={{ color: '#1b5e20', fontSize: 32, opacity: 0.1 }} />
                        </Stack>
                    </Paper>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                    <Paper sx={{ p: 4, borderRadius: 5, border: '1px solid #e2e8f0', boxShadow: 'none', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)' } }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                            <Box>
                                <Typography variant="overline" sx={{ color: '#64748b', fontWeight: 800 }}>PESQUISAS ATIVAS</Typography>
                                <Typography variant="h3" sx={{ fontWeight: 900, mt: 1 }}>{stats.totalQuestionnaires}</Typography>
                            </Box>
                            <ChartIcon sx={{ color: '#1b5e20', fontSize: 32, opacity: 0.1 }} />
                        </Stack>
                    </Paper>
                </Grid>

                <Grid item xs={12}>
                    <Paper sx={{ 
                        p: { xs: 3, md: 5 }, 
                        borderRadius: 6, 
                        border: '1px solid #e2e8f0', 
                        boxShadow: '0 10px 30px rgba(0,0,0,0.02)',
                        bgcolor: 'rgba(255,255,255,0.8)',
                        backdropFilter: 'blur(10px)'
                    }}>
                        <Typography variant="h5" sx={{ mb: 4, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 1.5, color: '#1b5e20' }}>
                            <ChartIcon sx={{ fontSize: 28 }} /> Fluxo de Respostas por Mês ({selectedYear})
                        </Typography>
                        <Box sx={{ height: 400 }}>
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
                                        legend: { display: false },
                                        tooltip: { 
                                            backgroundColor: '#1e293b',
                                            padding: 12,
                                            titleFont: { size: 14, weight: 'bold' },
                                            bodyFont: { size: 13 },
                                            cornerRadius: 8
                                        }
                                    } 
                                }} 
                            />
                        </Box>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
}

export default AdminDashboardPage;