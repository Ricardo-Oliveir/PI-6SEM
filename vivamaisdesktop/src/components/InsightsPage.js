import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Grid, Card, CardContent, Button,
    Select, MenuItem, FormControl, InputLabel, CircularProgress,
    Divider, Alert, Chip, Accordion, AccordionSummary,
    AccordionDetails, Paper, List, ListItem, ListItemIcon, ListItemText
} from '@mui/material';
import {
    AutoAwesome as AiIcon,
    ThumbUp as StrongIcon,
    TrendingDown as WeakIcon,
    Lightbulb as IdeaIcon,
    ExpandMore as ExpandMoreIcon,
    Assessment as AssessmentIcon,
    TrendingUp as TrendingIcon,
    People as PeopleIcon,
    CheckCircle as CheckIcon,
    Warning as WarningIcon,
    Info as InfoIcon,
    Speed as SpeedIcon
} from '@mui/icons-material';
import api from '../services/api';
import { brand, fadeUp, gradients } from '../styles/designSystem';

function InsightsPage() {
    const [questionnaires, setQuestionnaires] = useState([]);
    const [selectedQ, setSelectedQ] = useState('');
    const [loading, setLoading] = useState(false);
    const [insights, setInsights] = useState(null);
    const [detailedAnalysis, setDetailedAnalysis] = useState(null);
    const [stats, setStats] = useState(null);
    const [source, setSource] = useState(null);

    useEffect(() => {
        api.get('/questionnaires').then((res) => setQuestionnaires(res.data));
    }, []);

    const generateInsights = async () => {
        if (!selectedQ) return;
        setLoading(true);
        setInsights(null);
        setDetailedAnalysis(null);
        setStats(null);
        setSource(null);

        try {
            const response = await api.post('/generate-insights', { questionnaireId: selectedQ });
            setTimeout(() => {
                setInsights(response.data.analysis);
                setDetailedAnalysis(response.data.detailed);
                setStats(response.data.stats);
                setSource(response.data.source);
                setLoading(false);
            }, 500);
        } catch (error) {
            console.error(error);
            setLoading(false);
        }
    };

    const getPriorityColor = (priority) => {
        if (priority <= 2) return '#f44336';
        if (priority <= 4) return '#ff9800';
        return '#4caf50';
    };

    const getPrazoLabel = (prazo) => ({
        imediato: 'Imediato',
        curto_prazo: 'Curto prazo',
        medio_prazo: 'Médio prazo',
        longo_prazo: 'Longo prazo'
    }[prazo] || prazo);

    const topStats = stats ? [
        { label: 'Respondentes', value: stats.totalRespondents, icon: <PeopleIcon />, gradient: gradients.mint },
        { label: 'Respostas totais', value: stats.totalResponses, icon: <AssessmentIcon />, gradient: gradients.violet },
        { label: 'Média geral', value: stats.overallAverage || detailedAnalysis?.metricas_chave?.satisfacao_geral || 'N/A', icon: <SpeedIcon />, gradient: gradients.cool }
    ] : [];

    return (
        <Box>
            <Card sx={{ p: { xs: 3, md: 4 }, mb: 3, background: gradients.hero, color: 'white', ...fadeUp(0) }}>
                <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <AiIcon fontSize="large" /> Análise Inteligente
                </Typography>
                <Typography sx={{ maxWidth: 700, opacity: 0.88 }}>
                    O módulo de IA agora aparece com mais destaque visual e melhor leitura para os resultados estratégicos.
                </Typography>
            </Card>

            <Card sx={{ p: 3, mb: 4, ...fadeUp(100) }}>
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={8}>
                        <FormControl fullWidth>
                            <InputLabel>Selecione o questionário para analisar</InputLabel>
                            <Select value={selectedQ} label="Selecione o questionário para analisar" onChange={(e) => setSelectedQ(e.target.value)}>
                                {questionnaires.map((q) => (
                                    <MenuItem key={q.id} value={q.id}>{q.title}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <Button fullWidth variant="contained" startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <AiIcon />} onClick={generateInsights} disabled={!selectedQ || loading}>
                            {loading ? 'Analisando...' : 'Gerar insights'}
                        </Button>
                    </Grid>
                </Grid>
            </Card>

            {topStats.length > 0 && (
                <Grid container spacing={2} sx={{ mb: 3 }}>
                    {topStats.map((item, index) => (
                        <Grid item xs={12} md={4} key={item.label}>
                            <Paper sx={{ p: 3, color: 'white', background: item.gradient, borderRadius: 6, ...fadeUp(160 + index * 60) }}>
                                <Box sx={{ mb: 2 }}>{item.icon}</Box>
                                <Typography variant="h4" fontWeight="bold">{item.value}</Typography>
                                <Typography variant="body2" sx={{ opacity: 0.84 }}>{item.label}</Typography>
                            </Paper>
                        </Grid>
                    ))}
                </Grid>
            )}

            {source && (
                <Box sx={{ mb: 2 }}>
                    <Chip
                        icon={source === 'gemini-ai' ? <AiIcon /> : <AssessmentIcon />}
                        label={source === 'gemini-ai' ? 'Análise por Gemini AI' : 'Análise estatística'}
                        sx={{
                            fontWeight: 800,
                            backgroundColor: source === 'gemini-ai' ? 'rgba(15,122,90,0.08)' : 'rgba(47,111,237,0.08)',
                            color: source === 'gemini-ai' ? brand.primary : brand.secondary
                        }}
                    />
                </Box>
            )}

            {detailedAnalysis?.resumo_executivo && (
                <Card sx={{ p: 3, mb: 3, ...fadeUp(220) }}>
                    <Typography variant="h6" sx={{ fontWeight: 800, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <InfoIcon color="primary" /> Resumo executivo
                    </Typography>
                    <Typography sx={{ color: 'text.secondary', lineHeight: 1.8 }}>
                        {detailedAnalysis.resumo_executivo}
                    </Typography>
                </Card>
            )}

            {insights && (
                <Grid container spacing={3} sx={{ mb: 4 }}>
                    <Grid item xs={12} md={4}>
                        <Card sx={{ height: '100%', borderTop: '4px solid #4CAF50' }}>
                            <CardContent>
                                <Typography variant="h6" sx={{ color: '#2E7D32', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <StrongIcon /> Pontos fortes
                                </Typography>
                                <Divider sx={{ my: 2 }} />
                                {insights.strengths.map((text, i) => (
                                    <Alert severity="success" icon={<CheckIcon />} sx={{ mb: 1, borderRadius: '12px' }} key={i}>
                                        {text}
                                    </Alert>
                                ))}
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid item xs={12} md={4}>
                        <Card sx={{ height: '100%', borderTop: '4px solid #F44336' }}>
                            <CardContent>
                                <Typography variant="h6" sx={{ color: '#C62828', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <WeakIcon /> Atenção necessária
                                </Typography>
                                <Divider sx={{ my: 2 }} />
                                {insights.improvements.length > 0 ? (
                                    insights.improvements.map((text, i) => (
                                        <Alert severity="error" icon={<WarningIcon />} sx={{ mb: 1, borderRadius: '12px' }} key={i}>
                                            {text}
                                        </Alert>
                                    ))
                                ) : (
                                    <Typography color="text.secondary">Nenhum ponto crítico detectado.</Typography>
                                )}
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid item xs={12} md={4}>
                        <Card sx={{ height: '100%', borderTop: '4px solid #2196F3' }}>
                            <CardContent>
                                <Typography variant="h6" sx={{ color: '#1565C0', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <IdeaIcon /> Plano de ação
                                </Typography>
                                <Divider sx={{ my: 2 }} />
                                {insights.action_plan.map((text, i) => (
                                    <Alert severity="info" icon={<IdeaIcon />} sx={{ mb: 1, borderRadius: '12px' }} key={i}>
                                        {text}
                                    </Alert>
                                ))}
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            )}

            {detailedAnalysis?.insights_detalhados && detailedAnalysis.insights_detalhados.length > 0 && (
                <Card sx={{ mb: 4 }}>
                    <CardContent>
                        <Typography variant="h6" sx={{ fontWeight: 800, mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <TrendingIcon color="primary" /> Insights detalhados
                        </Typography>
                        {detailedAnalysis.insights_detalhados.map((insight, i) => (
                            <Accordion key={i} sx={{ mb: 2, borderRadius: '16px !important', '&:before': { display: 'none' } }}>
                                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                                        <Typography fontWeight="bold">{insight.titulo}</Typography>
                                        <Chip label={insight.impacto?.toUpperCase()} size="small" sx={{ backgroundColor: `${getPriorityColor(insight.prioridade || 3)}20`, color: getPriorityColor(insight.prioridade || 3) }} />
                                    </Box>
                                </AccordionSummary>
                                <AccordionDetails>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                        {insight.descricao}
                                    </Typography>
                                    <Alert severity="info" sx={{ borderRadius: '12px' }}>
                                        <strong>Recomendação:</strong> {insight.recomendacao}
                                    </Alert>
                                </AccordionDetails>
                            </Accordion>
                        ))}
                    </CardContent>
                </Card>
            )}

            {detailedAnalysis?.plano_acao && detailedAnalysis.plano_acao.length > 0 && (
                <Card sx={{ mb: 4 }}>
                    <CardContent>
                        <Typography variant="h6" sx={{ fontWeight: 800, mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <IdeaIcon color="primary" /> Plano de ação detalhado
                        </Typography>
                        <List>
                            {detailedAnalysis.plano_acao.map((acao, i) => (
                                <ListItem key={i} sx={{ mb: 1.5, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.7)' }}>
                                    <ListItemIcon>
                                        <Box sx={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: getPriorityColor(acao.prioridade), color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                            {acao.prioridade}
                                        </Box>
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                                                <Typography fontWeight="bold">{acao.acao}</Typography>
                                                <Chip label={getPrazoLabel(acao.prazo_sugerido)} size="small" variant="outlined" color="primary" />
                                            </Box>
                                        }
                                        secondary={acao.justificativa}
                                    />
                                </ListItem>
                            ))}
                        </List>
                    </CardContent>
                </Card>
            )}

            {detailedAnalysis?.tendencias && detailedAnalysis.tendencias.length > 0 && (
                <Card>
                    <CardContent>
                        <Typography variant="h6" sx={{ fontWeight: 800, mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <TrendingIcon color="primary" /> Tendências identificadas
                        </Typography>
                        {detailedAnalysis.tendencias.map((tendencia, i) => (
                            <Alert key={i} severity="info" icon={<TrendingIcon />} sx={{ mb: 1, borderRadius: '12px' }}>
                                {tendencia}
                            </Alert>
                        ))}
                    </CardContent>
                </Card>
            )}
        </Box>
    );
}

export default InsightsPage;
