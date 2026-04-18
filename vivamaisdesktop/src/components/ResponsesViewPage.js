// src/components/ResponsesViewPage.js
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Box, Typography, Paper, Grid, Card, CardContent, CircularProgress,
    Alert, Chip, IconButton, Tooltip, Divider, Table, TableBody,
    TableCell, TableContainer, TableHead, TableRow, Avatar, Button,
    Tabs, Tab, LinearProgress
} from '@mui/material';
import {
    ArrowBack as BackIcon,
    Person as PersonIcon,
    CheckCircle as CheckIcon,
    Star as StarIcon,
    StarBorder as StarBorderIcon,
    PieChart as PieChartIcon,
    BarChart as BarChartIcon,
    TableChart as TableIcon,
    Refresh as RefreshIcon
} from '@mui/icons-material';
import { Chart as ChartJS, ArcElement, Tooltip as ChartTooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import { Pie, Bar, Doughnut } from 'react-chartjs-2';
import api from '../services/api';

// Registrar componentes do Chart.js
ChartJS.register(ArcElement, ChartTooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

// Paleta de cores moderna
const COLORS = [
    '#2E7D32', '#4CAF50', '#81C784', '#A5D6A7', '#C8E6C9',
    '#1565C0', '#42A5F5', '#90CAF9',
    '#F57C00', '#FFB74D', '#FFE0B2',
    '#7B1FA2', '#BA68C8', '#E1BEE7',
    '#C62828', '#EF5350', '#FFCDD2'
];

// Estilos
const styles = {
    pageContainer: {
        padding: '24px',
        backgroundColor: '#F8F9FA',
        minHeight: '100vh'
    },
    headerCard: {
        background: 'linear-gradient(135deg, #2E7D32 0%, #4CAF50 100%)',
        borderRadius: '16px',
        padding: '24px',
        color: 'white',
        marginBottom: '24px',
        boxShadow: '0 8px 32px rgba(46, 125, 50, 0.3)'
    },
    statsCard: {
        borderRadius: '16px',
        padding: '20px',
        height: '100%',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 8px 30px rgba(0,0,0,0.12)'
        }
    },
    chartCard: {
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        height: '100%'
    },
    tableContainer: {
        borderRadius: '16px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        overflow: 'hidden'
    }
};

function ResponsesViewPage() {
    const { questionnaireId } = useParams();
    const navigate = useNavigate();
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [questionnaire, setQuestionnaire] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [activeTab, setActiveTab] = useState(0);
    const [statistics, setStatistics] = useState({});

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            setError('');

            // 1. Buscar detalhes do questionário
            const qResponse = await api.get(`/questionnaires/${questionnaireId}`);
            setQuestionnaire(qResponse.data);

            // 2. Buscar respostas (Rota oficial que agora retorna as respostas completas)
            const respResponse = await api.get(`/questionnaires/${questionnaireId}/responses`);
            const responsesData = respResponse.data || [];
            
            // 3. Reconstruir/Simular sessões a partir das respostas para a listagem
            const sessionMap = {};
            responsesData.forEach(r => {
                if (r.session_id && !sessionMap[r.session_id]) {
                    sessionMap[r.session_id] = {
                        id: r.session_id,
                        created_at: r.created_at,
                        respondent_name: 'Colaborador Anônimo',
                        questionnaire_id: questionnaireId
                    };
                }
            });
            const sessionsData = Object.values(sessionMap);
            setSessions(sessionsData);

            // 4. Calcular estatísticas por questão
            if (qResponse.data.questions) {
                const stats = {};
                qResponse.data.questions.forEach(question => {
                    const questionResponses = responsesData.filter(r => r.question_id === question.id);
                    stats[question.id] = calculateQuestionStats(question, questionResponses);
                });
                setStatistics(stats);
            }

        } catch (err) {
            console.error('Erro ao carregar dados:', err);
            setError('Não foi possível carregar as respostas.');
        } finally {
            setLoading(false);
        }
    }, [questionnaireId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const calculateQuestionStats = (question, responses) => {
        const stats = {
            total: responses.length,
            distribution: {},
            average: null
        };

        responses.forEach(r => {
            const value = r.value || r.numeric_value || 'N/A';
            stats.distribution[value] = (stats.distribution[value] || 0) + 1;
        });

        // Calcular média para ratings
        if (question.type === 'rating') {
            const numericResponses = responses
                .map(r => parseInt(r.numeric_value || r.value))
                .filter(n => !isNaN(n));
            if (numericResponses.length > 0) {
                stats.average = (numericResponses.reduce((a, b) => a + b, 0) / numericResponses.length).toFixed(1);
            }
        }

        return stats;
    };

    const getChartData = (question, stats) => {
        const labels = Object.keys(stats.distribution);
        const data = Object.values(stats.distribution);
        
        return {
            labels,
            datasets: [{
                data,
                backgroundColor: COLORS.slice(0, labels.length),
                borderColor: COLORS.slice(0, labels.length).map(c => c),
                borderWidth: 2,
                hoverOffset: 8
            }]
        };
    };

    const getBarChartData = (question, stats) => {
        const labels = Object.keys(stats.distribution);
        const data = Object.values(stats.distribution);
        
        return {
            labels,
            datasets: [{
                label: 'Respostas',
                data,
                backgroundColor: 'rgba(46, 125, 50, 0.8)',
                borderColor: '#2E7D32',
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false,
            }]
        };
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    padding: 20,
                    usePointStyle: true,
                    font: { size: 12 }
                }
            }
        }
    };

    const barOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: { stepSize: 1 },
                grid: { color: 'rgba(0,0,0,0.05)' }
            },
            x: {
                grid: { display: false }
            }
        }
    };

    const renderStars = (rating) => {
        const stars = [];
        for (let i = 1; i <= 5; i++) {
            stars.push(
                i <= rating 
                    ? <StarIcon key={i} sx={{ color: '#FFB400', fontSize: 20 }} />
                    : <StarBorderIcon key={i} sx={{ color: '#DDD', fontSize: 20 }} />
            );
        }
        return <Box sx={{ display: 'flex' }}>{stars}</Box>;
    };

    const getQuestionTypeLabel = (type) => {
        const types = {
            'rating': { label: 'Avaliação', color: '#F57C00' },
            'yes_no': { label: 'Sim/Não', color: '#1565C0' },
            'multiple_choice': { label: 'Múltipla Escolha', color: '#7B1FA2' },
            'text': { label: 'Texto Livre', color: '#2E7D32' }
        };
        return types[type] || { label: type, color: '#666' };
    };

    if (loading) {
        return (
            <Box sx={{ ...styles.pageContainer, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <Box textAlign="center">
                    <CircularProgress sx={{ color: '#2E7D32' }} size={60} />
                    <Typography sx={{ mt: 2, color: '#666' }}>Carregando respostas...</Typography>
                </Box>
            </Box>
        );
    }

    if (error) {
        return (
            <Box sx={styles.pageContainer}>
                <Alert severity="error" sx={{ borderRadius: '12px' }}>{error}</Alert>
                <Button startIcon={<BackIcon />} onClick={() => navigate('/questionarios')} sx={{ mt: 2 }}>
                    Voltar
                </Button>
            </Box>
        );
    }

    const totalResponses = sessions.length;
    const questions = questionnaire?.questions || [];

    return (
        <Box sx={styles.pageContainer}>
            {/* Header */}
            <Paper sx={styles.headerCard}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <IconButton onClick={() => navigate('/questionarios')} sx={{ color: 'white' }}>
                            <BackIcon />
                        </IconButton>
                        <Box>
                            <Typography variant="h4" fontWeight="bold">
                                📊 Respostas do Questionário
                            </Typography>
                            <Typography variant="h6" sx={{ opacity: 0.9, mt: 0.5 }}>
                                {questionnaire?.title}
                            </Typography>
                        </Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Tooltip title="Atualizar">
                            <IconButton onClick={loadData} sx={{ color: 'white' }}>
                                <RefreshIcon />
                            </IconButton>
                        </Tooltip>
                    </Box>
                </Box>
            </Paper>

            {/* Cards de Estatísticas Gerais */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={6} md={4}>
                    <Card sx={{ ...styles.statsCard, borderLeft: '4px solid #2E7D32' }}>
                        <CardContent>
                            <Typography color="textSecondary" gutterBottom sx={{ fontSize: 14 }}>
                                Total de Respostas
                            </Typography>
                            <Typography variant="h3" sx={{ color: '#2E7D32', fontWeight: 'bold' }}>
                                {totalResponses}
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                                questionários completos
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                    <Card sx={{ ...styles.statsCard, borderLeft: '4px solid #1565C0' }}>
                        <CardContent>
                            <Typography color="textSecondary" gutterBottom sx={{ fontSize: 14 }}>
                                Perguntas
                            </Typography>
                            <Typography variant="h3" sx={{ color: '#1565C0', fontWeight: 'bold' }}>
                                {questions.length}
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                                no questionário
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                    <Card sx={{ ...styles.statsCard, borderLeft: '4px solid #7B1FA2' }}>
                        <CardContent>
                            <Typography color="textSecondary" gutterBottom sx={{ fontSize: 14 }}>
                                Taxa de Conclusão
                            </Typography>
                            <Typography variant="h3" sx={{ color: '#7B1FA2', fontWeight: 'bold' }}>
                                {totalResponses > 0 ? '100%' : '0%'}
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                                dos iniciados
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Tabs */}
            <Paper sx={{ borderRadius: '16px', mb: 3, overflow: 'hidden' }}>
                <Tabs 
                    value={activeTab} 
                    onChange={(e, v) => setActiveTab(v)}
                    sx={{ 
                        borderBottom: '1px solid #eee',
                        '& .MuiTab-root': { 
                            textTransform: 'none', 
                            fontWeight: 600,
                            fontSize: 15
                        },
                        '& .Mui-selected': { color: '#2E7D32' },
                        '& .MuiTabs-indicator': { backgroundColor: '#2E7D32' }
                    }}
                >
                    <Tab icon={<PieChartIcon />} iconPosition="start" label="Gráficos" />
                    <Tab icon={<TableIcon />} iconPosition="start" label="Respondentes" />
                    <Tab icon={<BarChartIcon />} iconPosition="start" label="Análise Detalhada" />
                </Tabs>
            </Paper>

            {/* Tab 0: Gráficos */}
            {activeTab === 0 && (
                <Grid container spacing={3}>
                    {questions.map((question, index) => {
                        const stats = statistics[question.id] || { total: 0, distribution: {} };
                        const typeInfo = getQuestionTypeLabel(question.type);
                        
                        return (
                            <Grid item xs={12} md={6} key={question.id}>
                                <Card sx={styles.chartCard}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                                        <Box>
                                            <Chip 
                                                label={typeInfo.label} 
                                                size="small" 
                                                sx={{ 
                                                    backgroundColor: `${typeInfo.color}20`, 
                                                    color: typeInfo.color,
                                                    fontWeight: 600,
                                                    mb: 1
                                                }} 
                                            />
                                            <Typography variant="h6" sx={{ fontWeight: 600, color: '#333' }}>
                                                {index + 1}. {question.text}
                                            </Typography>
                                        </Box>
                                        <Chip 
                                            label={`${stats.total} respostas`} 
                                            size="small"
                                            sx={{ backgroundColor: '#E8F5E9', color: '#2E7D32' }}
                                        />
                                    </Box>

                                    {stats.average && (
                                        <Box sx={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: 1, 
                                            mb: 2,
                                            p: 2,
                                            backgroundColor: '#FFF8E1',
                                            borderRadius: '12px'
                                        }}>
                                            <StarIcon sx={{ color: '#FFB400' }} />
                                            <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#F57C00' }}>
                                                {stats.average}
                                            </Typography>
                                            <Typography color="textSecondary">
                                                média de avaliação
                                            </Typography>
                                        </Box>
                                    )}

                                    <Divider sx={{ my: 2 }} />

                                    {stats.total > 0 ? (
                                        <Box sx={{ height: 280 }}>
                                            {question.type === 'rating' ? (
                                                <Bar data={getBarChartData(question, stats)} options={barOptions} />
                                            ) : question.type === 'yes_no' ? (
                                                <Doughnut data={getChartData(question, stats)} options={chartOptions} />
                                            ) : question.type === 'text' ? (
                                                <Box sx={{ maxHeight: 280, overflow: 'auto' }}>
                                                    {Object.entries(stats.distribution).map(([text, count], i) => (
                                                        <Paper key={i} sx={{ p: 2, mb: 1, backgroundColor: '#F5F5F5', borderRadius: '8px' }}>
                                                            <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                                                                "{text}"
                                                            </Typography>
                                                        </Paper>
                                                    ))}
                                                </Box>
                                            ) : (
                                                <Pie data={getChartData(question, stats)} options={chartOptions} />
                                            )}
                                        </Box>
                                    ) : (
                                        <Box sx={{ 
                                            height: 200, 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            justifyContent: 'center',
                                            backgroundColor: '#F5F5F5',
                                            borderRadius: '12px'
                                        }}>
                                            <Typography color="textSecondary">
                                                Nenhuma resposta ainda
                                            </Typography>
                                        </Box>
                                    )}
                                </Card>
                            </Grid>
                        );
                    })}
                </Grid>
            )}

            {/* Tab 1: Respondentes */}
            {activeTab === 1 && (
                <Paper sx={styles.tableContainer}>
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow sx={{ backgroundColor: '#F8F9FA' }}>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Respondente</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Data</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {sessions.length > 0 ? sessions.map((session, index) => (
                                    <TableRow key={session.id} hover>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                <Avatar sx={{ backgroundColor: COLORS[index % COLORS.length] }}>
                                                    <PersonIcon />
                                                </Avatar>
                                                <Typography fontWeight={500}>
                                                    {session.respondent_name || 'Anônimo'}
                                                </Typography>
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            {session.created_at 
                                                ? new Date(session.created_at).toLocaleDateString('pt-BR', {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })
                                                : '-'
                                            }
                                        </TableCell>
                                        <TableCell>
                                            <Chip 
                                                icon={<CheckIcon />}
                                                label="Completo" 
                                                size="small"
                                                sx={{ 
                                                    backgroundColor: '#E8F5E9', 
                                                    color: '#2E7D32',
                                                    '& .MuiChip-icon': { color: '#2E7D32' }
                                                }}
                                            />
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={3} align="center" sx={{ py: 6 }}>
                                            <Typography color="textSecondary">
                                                Nenhuma resposta registrada ainda
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            )}

            {/* Tab 2: Análise Detalhada */}
            {activeTab === 2 && (
                <Grid container spacing={3}>
                    {questions.map((question, index) => {
                        const stats = statistics[question.id] || { total: 0, distribution: {} };
                        const typeInfo = getQuestionTypeLabel(question.type);
                        
                        return (
                            <Grid item xs={12} key={question.id}>
                                <Card sx={{ ...styles.chartCard, p: 3 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                                        <Avatar sx={{ 
                                            backgroundColor: typeInfo.color, 
                                            width: 48, 
                                            height: 48,
                                            fontSize: 20,
                                            fontWeight: 'bold'
                                        }}>
                                            {index + 1}
                                        </Avatar>
                                        <Box sx={{ flex: 1 }}>
                                            <Typography variant="h6" fontWeight={600}>
                                                {question.text}
                                            </Typography>
                                            <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                                                <Chip 
                                                    label={typeInfo.label} 
                                                    size="small"
                                                    sx={{ backgroundColor: `${typeInfo.color}20`, color: typeInfo.color }}
                                                />
                                                <Chip 
                                                    label={`${stats.total} respostas`}
                                                    size="small"
                                                    variant="outlined"
                                                />
                                            </Box>
                                        </Box>
                                    </Box>

                                    <Divider sx={{ mb: 3 }} />

                                    {stats.total > 0 ? (
                                        <Grid container spacing={3}>
                                            <Grid item xs={12} md={6}>
                                                <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                                                    Distribuição das Respostas
                                                </Typography>
                                                {Object.entries(stats.distribution).map(([value, count]) => {
                                                    const percentage = ((count / stats.total) * 100).toFixed(1);
                                                    return (
                                                        <Box key={value} sx={{ mb: 2 }}>
                                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                                                 <Typography variant="body2" fontWeight={500}>
                                                                    {question.type === 'rating' ? renderStars(parseInt(value)) : value}
                                                                </Typography>
                                                                <Typography variant="body2" color="textSecondary">
                                                                    {count} ({percentage}%)
                                                                </Typography>
                                                            </Box>
                                                            <LinearProgress 
                                                                variant="determinate" 
                                                                value={parseFloat(percentage)}
                                                                sx={{
                                                                    height: 10,
                                                                    borderRadius: 5,
                                                                    backgroundColor: '#E8F5E9',
                                                                    '& .MuiLinearProgress-bar': {
                                                                        backgroundColor: typeInfo.color,
                                                                        borderRadius: 5
                                                                    }
                                                                }}
                                                            />
                                                        </Box>
                                                    );
                                                })}
                                            </Grid>
                                            <Grid item xs={12} md={6}>
                                                <Box sx={{ height: 250 }}>
                                                    <Doughnut 
                                                        data={getChartData(question, stats)} 
                                                        options={{
                                                            ...chartOptions,
                                                            cutout: '60%'
                                                        }} 
                                                    />
                                                </Box>
                                            </Grid>
                                        </Grid>
                                    ) : (
                                        <Box sx={{ 
                                            p: 4, 
                                            textAlign: 'center', 
                                            backgroundColor: '#F5F5F5',
                                            borderRadius: '12px'
                                        }}>
                                            <Typography color="textSecondary">
                                                Aguardando respostas para esta pergunta
                                            </Typography>
                                        </Box>
                                    )}
                                </Card>
                            </Grid>
                        );
                    })}
                </Grid>
            )}

            {/* Mensagem quando não há dados */}
            {totalResponses === 0 && questions.length > 0 && (
                <Paper sx={{ p: 6, textAlign: 'center', borderRadius: '16px', mt: 3 }}>
                    <Typography variant="h5" color="textSecondary" gutterBottom>
                        📭 Nenhuma resposta ainda
                    </Typography>
                    <Typography color="textSecondary">
                        Quando os usuários responderem o questionário, os dados aparecerão aqui com gráficos interativos.
                    </Typography>
                </Paper>
            )}
        </Box>
    );
}

export default ResponsesViewPage;
