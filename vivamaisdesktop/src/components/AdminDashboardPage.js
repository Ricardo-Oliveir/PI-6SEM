import React, { useState, useEffect } from 'react';
import {
    Box, Grid, Paper, Typography, MenuItem, Select, FormControl,
    InputLabel, Stack, CircularProgress, Alert, Dialog, DialogTitle,
    DialogContent, DialogActions, TextField, Button, Zoom, LinearProgress
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
    BarChart as ChartIcon
} from '@mui/icons-material';
import { Bar, Line } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement,
    PointElement, LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import api from '../services/api';

ChartJS.register(
    CategoryScale, LinearScale, BarElement, PointElement,
    LineElement, Title, Tooltip, Legend, Filler
);

function AdminDashboardPage() {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
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
        activity: "0.0",
        questionnairesDetails: []
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [pendingUsers, setPendingUsers] = useState([]);
    const [respondents, setRespondents] = useState([]);
    const [batchSize, setBatchSize] = useState(5);
    const [realTotalResponses, setRealTotalResponses] = useState(0);

    const [engagementGoal, setEngagementGoal] = useState(80);
    const [showGoalDialog, setShowGoalDialog] = useState(false);
    const [tempGoal, setTempGoal] = useState(80);

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
                engagementRate: res.data.engagementRate || "0.0",
                questionnairesDetails: res.data.questionnairesDetails || []
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
            if (res.data.engagementGoal !== undefined) {
                setEngagementGoal(res.data.engagementGoal);
            }

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

    const handleSaveGoal = async () => {
        try {
            await api.post('/api/settings/goal', { goal: tempGoal });
            setEngagementGoal(tempGoal);
            setShowGoalDialog(false);
        } catch (error) {
            console.error("Erro ao salvar meta:", error);
        }
    };

    const chartData = {
        labels: selectedMonth === -1
            ? ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
            : Array.from({ length: dailyData.length }, (_, i) => `${i + 1}`),
        datasets: [
            {
                label: 'Questionários Respondidos',
                data: selectedMonth === -1 ? monthlyData : dailyData,
                backgroundColor: '#22c55e',
                borderRadius: 6,
            },
            {
                label: 'Novas Pesquisas',
                data: selectedMonth === -1 ? monthlyQuestionnaireData : dailyQuestionnaireData,
                backgroundColor: '#3b82f6',
                borderRadius: 6,
            }
        ]
    };

    const goalChartData = {
        labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
        datasets: [
            {
                label: 'Taxa de Engajamento (%)',
                data: (() => {
                    let cumulativeSum = 0;
                    return monthlyData.map(val => {
                        cumulativeSum += val;
                        const potential = (stats.totalUsers * (stats.totalQuestionnaires || 1)) || 1;
                        return ((cumulativeSum / potential) * 100).toFixed(1);
                    });
                })(),
                borderColor: isDark ? '#4caf50' : '#1b5e20',
                backgroundColor: isDark ? 'rgba(76, 175, 80, 0.1)' : 'rgba(27, 94, 32, 0.1)',
                fill: true,
                tension: 0.4,
                pointBackgroundColor: isDark ? '#4caf50' : '#1b5e20',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4,
            },
            {
                label: `Meta (${engagementGoal}%)`,
                data: new Array(12).fill(engagementGoal),
                borderColor: '#ef4444',
                borderDash: [5, 5],
                pointRadius: 0,
                fill: false,
                borderWidth: 2
            }
        ]
    };

    const commonOptions = {
        maintainAspectRatio: false,
        responsive: true,
        scales: {
            y: {
                beginAtZero: true,
                border: { display: false },
                grid: { color: isDark ? 'rgba(255, 255, 255, 0.08)' : '#f1f5f9' },
                ticks: { color: theme.palette.text.secondary }
            },
            x: {
                border: { display: false },
                grid: { display: false },
                ticks: { color: theme.palette.text.secondary }
            }
        },
        plugins: {
            legend: {
                display: true,
                position: 'top',
                labels: {
                    usePointStyle: true,
                    boxHeight: 6,
                    font: { size: 12, weight: 'bold' },
                    color: theme.palette.text.primary
                }
            }
        }
    };

    if (loading && stats.responses === 0) {
        return <Box display="flex" justifyContent="center" alignItems="center" height="80vh"><CircularProgress color="success" /></Box>;
    }

    return (
        <Box sx={{ p: { xs: 2, md: 4 }, bgcolor: 'background.default', color: 'text.primary', minHeight: '100vh' }}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems="center" spacing={2} sx={{ mb: 4 }}>
                <Box sx={{ flex: 1, minWidth: { xs: '100%', md: 'auto' } }}>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: 'primary.main', fontSize: { xs: '1.75rem', sm: '2.125rem', lg: '2.5rem' } }}>Olá, {userData?.full_name?.split(' ')[0] || 'Gestor'}!</Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>Acompanhe os indicadores de engajamento do Vida Mais.</Typography>
                </Box>

                <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                        <InputLabel sx={{ color: 'text.secondary' }}>Mês</InputLabel>
                        <Select
                            value={selectedMonth}
                            label="Mês"
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            sx={{ bgcolor: 'background.paper', color: 'text.primary', borderRadius: 2 }}
                        >
                            {months.map(m => <MenuItem key={m.val} value={m.val}>{m.label}</MenuItem>)}
                        </Select>
                    </FormControl>

                    <FormControl size="small" sx={{ minWidth: 90 }}>
                        <InputLabel sx={{ color: 'text.secondary' }}>Ano</InputLabel>
                        <Select
                            value={selectedYear}
                            label="Ano"
                            onChange={(e) => setSelectedYear(e.target.value)}
                            sx={{ bgcolor: 'background.paper', color: 'text.primary', borderRadius: 2 }}
                        >
                            {years.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                        </Select>
                    </FormControl>
                </Stack>
            </Stack>

            {error && <Alert severity="warning" sx={{ mb: 4, borderRadius: 3 }}>{error}</Alert>}

            <Grid container spacing={{ xs: 2, md: 3 }} rowSpacing={4} alignItems="stretch">
                {/* 1. Taxa de Engajamento */}
                <Grid item xs={12} sm={6} md={3}>
                    <Paper sx={{
                        p: 2.5,
                        borderRadius: 4,
                        border: isDark ? '1px solid rgba(255,255,255,0.08)' : 'none',
                        borderLeft: '6px solid #2e7d32',
                        bgcolor: 'background.paper',
                        color: 'text.primary',
                        boxShadow: isDark ? 'none' : '0 4px 12px rgba(0,0,0,0.05)',
                        transition: 'transform 0.2s',
                        position: 'relative',
                        overflow: 'hidden',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        '&:hover': { transform: 'translateY(-4px)' }
                    }}>
                        <Box sx={{ position: 'absolute', right: -10, top: -10, fontSize: '40px', opacity: 0.1 }}>🎯</Box>
                        <Box>
                            <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 900, fontSize: '0.7rem' }}>ENGAJAMENTO</Typography>
                            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.5 }}>
                                <Typography variant="h3" sx={{ fontWeight: 950, color: '#2e7d32' }}>{engagementRate}%</Typography>
                                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>(Meta: {engagementGoal}%)</Typography>
                            </Box>
                        </Box>
                        <LinearProgress
                            variant="determinate"
                            value={Math.min(100, parseFloat(engagementRate))}
                            sx={{
                                mt: 2, height: 4, borderRadius: 2,
                                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                                '& .MuiLinearProgress-bar': {
                                    backgroundColor: parseFloat(engagementRate) >= engagementGoal ? '#2e7d32' : '#f57c00'
                                }
                            }}
                        />
                    </Paper>
                </Grid>

                {/* 2. Respostas Recebidas */}
                <Grid item xs={12} sm={6} md={3}>
                    <Paper sx={{
                        p: 2.5,
                        borderRadius: 4,
                        border: isDark ? '1px solid rgba(255,255,255,0.08)' : 'none',
                        borderLeft: '6px solid #0277bd',
                        bgcolor: 'background.paper',
                        color: 'text.primary',
                        boxShadow: isDark ? 'none' : '0 4px 12px rgba(0,0,0,0.05)',
                        transition: 'transform 0.2s',
                        position: 'relative',
                        overflow: 'hidden',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        '&:hover': { transform: 'translateY(-4px)' }
                    }}>
                        <Box sx={{ position: 'absolute', right: -10, top: -10, fontSize: '40px', opacity: 0.1 }}>💬</Box>
                        <Box>
                            <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 900, fontSize: '0.7rem' }}>RESPOSTAS</Typography>
                            <Typography variant="h3" sx={{ fontWeight: 950, color: '#0277bd', mt: 0.5 }}>{stats.responses}</Typography>
                        </Box>
                    </Paper>
                </Grid>

                {/* 3. Questionários */}
                <Grid item xs={12} sm={6} md={3}>
                    <Paper sx={{
                        p: 2.5,
                        borderRadius: 4,
                        border: isDark ? '1px solid rgba(255,255,255,0.08)' : 'none',
                        borderLeft: '6px solid #9c27b0',
                        bgcolor: 'background.paper',
                        color: 'text.primary',
                        boxShadow: isDark ? 'none' : '0 4px 12px rgba(0,0,0,0.05)',
                        transition: 'transform 0.2s',
                        position: 'relative',
                        overflow: 'hidden',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        '&:hover': { transform: 'translateY(-4px)' }
                    }}>
                        <Box sx={{ position: 'absolute', right: -10, top: -10, fontSize: '40px', opacity: 0.1 }}>📋</Box>
                        <Box>
                            <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 900, fontSize: '0.7rem' }}>PESQUISAS</Typography>
                            <Typography variant="h3" sx={{ fontWeight: 950, color: '#9c27b0', mt: 0.5 }}>{stats.totalQuestionnaires}</Typography>
                        </Box>
                    </Paper>
                </Grid>

                {/* 4. Colaboradores */}
                <Grid item xs={12} sm={6} md={3}>
                    <Paper sx={{
                        p: 2.5,
                        borderRadius: 4,
                        border: isDark ? '1px solid rgba(255,255,255,0.08)' : 'none',
                        borderLeft: '6px solid #f59e0b',
                        bgcolor: 'background.paper',
                        color: 'text.primary',
                        boxShadow: isDark ? 'none' : '0 4px 12px rgba(0,0,0,0.05)',
                        transition: 'transform 0.2s',
                        position: 'relative',
                        overflow: 'hidden',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        '&:hover': { transform: 'translateY(-4px)' }
                    }}>
                        <Box sx={{ position: 'absolute', right: -10, top: -10, fontSize: '40px', opacity: 0.1 }}>👥</Box>
                        <Box>
                            <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 900, fontSize: '0.7rem' }}>COLABORADORES</Typography>
                            <Typography variant="h3" sx={{ fontWeight: 950, color: '#f59e0b', mt: 0.5 }}>{stats.totalUsers}</Typography>
                        </Box>
                    </Paper>
                </Grid>

                {/* Gráfico e Pendências Lado a Lado */}
                <Grid item xs={12} md={8.5}>
                    <Stack spacing={3}>
                        <Paper sx={{
                            p: { xs: 2, md: 3 },
                            borderRadius: 6,
                            border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0',
                            boxShadow: isDark ? 'none' : '0 10px 30px rgba(0,0,0,0.02)',
                            bgcolor: 'background.paper',
                            color: 'text.primary',
                            height: '400px',
                            display: 'flex',
                            flexDirection: 'column'
                        }}>
                            <Typography variant="h6" sx={{ fontWeight: 900, mb: 2, display: 'flex', alignItems: 'center', gap: 1.5, color: isDark ? 'primary.light' : '#1b5e20' }}>
                                📊 Fluxo de Engajamento ({selectedYear})
                            </Typography>
                            <Box sx={{ flex: 1, minHeight: 0 }}>
                                <Bar data={chartData} options={commonOptions} />
                            </Box>
                        </Paper>

                        <Paper sx={{
                            p: { xs: 2, md: 3 },
                            borderRadius: 6,
                            border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0',
                            boxShadow: isDark ? 'none' : '0 10px 30px rgba(0,0,0,0.02)',
                            bgcolor: 'background.paper',
                            color: 'text.primary',
                            height: '400px',
                            display: 'flex',
                            flexDirection: 'column'
                        }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Typography variant="h6" sx={{ fontWeight: 900, display: 'flex', alignItems: 'center', gap: 1.5, color: isDark ? 'primary.light' : '#1b5e20', flexWrap: 'wrap' }}>
                                    🎯 Evolução vs Meta ({engagementGoal}%)
                                </Typography>
                                <Button
                                    size="small"
                                    startIcon={<ChartIcon />}
                                    onClick={() => { setTempGoal(engagementGoal); setShowGoalDialog(true); }}
                                    sx={{ color: isDark ? 'primary.light' : '#1b5e20', fontWeight: 800, borderRadius: 2 }}
                                >
                                    Ajustar Meta
                                </Button>
                            </Box>
                            <Box sx={{ flex: 1, minHeight: 0 }}>
                                <Line data={goalChartData} options={commonOptions} />
                            </Box>
                        </Paper>
                    </Stack>
                </Grid>

                <Grid item xs={12} md={3.5}>
                    <Paper sx={{
                        p: 3,
                        borderRadius: 6,
                        height: '450px',
                        border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0',
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: isDark ? 'none' : '0 10px 30px rgba(0,0,0,0.02)',
                        bgcolor: 'background.paper',
                        color: 'text.primary'
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
                                            bgcolor: isDark ? 'rgba(239, 68, 68, 0.08)' : '#fffafb',
                                            borderRadius: 3,
                                            border: isDark ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid #fee2e2',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 1.5
                                        }}>
                                            <Box sx={{ width: 6, height: 6, bgcolor: '#ef4444', borderRadius: '50%' }} />
                                            <Box sx={{ flex: 1 }}>
                                                <Typography variant="body2" sx={{ color: '#ef4444', fontWeight: 800, fontSize: '0.65rem', textTransform: 'uppercase' }}>
                                                    {user.questionnaire}
                                                </Typography>
                                                <Typography variant="body2" fontWeight={700} color="text.primary" sx={{ fontSize: '0.85rem' }}>
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
                    border: isDark ? '1px solid rgba(2, 136, 209, 0.2)' : '1px solid #b3e5fc',
                    bgcolor: isDark ? 'rgba(2, 136, 209, 0.1)' : '#e1f5fe',
                    color: 'text.primary',
                    '& .MuiAlert-icon': { color: '#0288d1' }
                }}
            >
                <Typography variant="subtitle2" fontWeight="bold">🛡️ Política de Anonimato Ativada (Lotes de {batchSize})</Typography>
                <Typography variant="body2">
                    Para garantir o anonimato dos colaboradores, os resultados e nomes são liberados apenas em grupos de {batchSize} pessoas.
                </Typography>
            </Alert>

            {/* Dialog para Definir Meta */}
            <Dialog open={showGoalDialog} onClose={() => setShowGoalDialog(false)} TransitionComponent={Zoom}>
                <DialogTitle sx={{ fontWeight: 900, color: 'primary.main' }}>Definir Meta de Engajamento</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
                        Defina a porcentagem alvo de engajamento para os colaboradores.
                    </Typography>
                    <TextField
                        fullWidth
                        label="Meta (%)"
                        type="number"
                        value={tempGoal}
                        onChange={(e) => setTempGoal(Number(e.target.value))}
                        InputProps={{ inputProps: { min: 0, max: 100 } }}
                        variant="outlined"
                        sx={{ mt: 1 }}
                    />
                </DialogContent>
                <DialogActions sx={{ p: 3 }}>
                    <Button onClick={() => setShowGoalDialog(false)} color="inherit" sx={{ fontWeight: 800 }}>Cancelar</Button>
                    <Button onClick={handleSaveGoal} variant="contained" sx={{ bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' }, color: '#fff', fontWeight: 900, borderRadius: 2 }}>
                        Salvar Meta
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

export default AdminDashboardPage;