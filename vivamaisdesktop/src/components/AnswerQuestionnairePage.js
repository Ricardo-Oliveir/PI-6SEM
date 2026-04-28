import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Box, Typography, Card, CardContent, Button, CircularProgress,
    Radio, RadioGroup, FormControlLabel, FormControl,
    TextField, Rating, Stack, IconButton, Tooltip, Paper
} from '@mui/material';
import { 
    VolumeUp as SpeakIcon, 
    Mic as MicIcon, 
    MicOff as MicOffIcon,
    ArrowBack as BackIcon,
    TextIncrease as IncreaseIcon,
    TextDecrease as DecreaseIcon
} from '@mui/icons-material';
import api from '../services/api';

function AnswerQuestionnairePage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [questionnaire, setQuestionnaire] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [answers, setAnswers] = useState({});
    const [listening, setListening] = useState(null); // ID da pergunta atual sendo ouvida
    const [fontScale, setFontScale] = useState(1); // Escala de fonte: 1 = normal, 1.2, 1.4, etc.

    const userStr = localStorage.getItem('user_data');
    const user = userStr ? JSON.parse(userStr) : {};

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch questionnaire details and its questions
                const qRes = await api.get(`/api/questionnaires/${id}`);
                setQuestionnaire(qRes.data);

                const qsRes = await api.get(`/api/questionnaires/${id}/questions`);
                const questionsList = qsRes.data;
                setQuestions(questionsList);

                // NOVO: Verificar se o usuário já tem respostas anteriores para este questionário
                // Isso permite "reativar" o questionário caso novas perguntas tenham sido adicionadas
                try {
                    const checkAnswered = await api.get(`/api/users/${user.id}/questionnaires/${id}/answered`);
                    if (checkAnswered.data.answered) {
                        // Se já respondeu, buscar as respostas da última sessão para preencher o formulário
                        const responsesRes = await api.get(`/api/questionnaires/${id}/responses`);
                        // Filtrar apenas as respostas deste usuário (ou da última sessão dele)
                        const userResponses = responsesRes.data.filter(r => r.user_id === user.id);
                        
                        const loadedAnswers = {};
                        userResponses.forEach(r => {
                            loadedAnswers[r.question_id] = { 
                                value: r.value, 
                                numeric_value: r.numeric_value 
                            };
                        });
                        setAnswers(loadedAnswers);
                    }
                } catch (e) {
                    console.log("Usuário sem respostas prévias ou erro na checagem:", e);
                }

            } catch (err) {
                console.error("Erro ao carregar o questionário", err);
                alert("Erro ao carregar o questionário. Ele pode não existir mais.");
                navigate('/user-dashboard');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id, navigate, user.id]);

    const handleAnswer = (questionId, value, numericValue = null) => {
        setAnswers(prev => ({
            ...prev,
            [questionId]: { value, numeric_value: numericValue }
        }));

        // FEEDBACK DE VOZ PARA A ESCOLHA
        if (value === 'Sim' || value === 'Não') {
            handleSpeak(`Você selecionou: ${value}`);
        } else if (numericValue !== null) {
            handleSpeak(`Você deu nota: ${numericValue}`);
        } else if (typeof value === 'string' && value.length < 50) {
            handleSpeak(`Selecionado: ${value}`);
        }
    };

    const handleSubmit = async () => {
        // Validação simples
        const requiredIds = questions.filter(q => q.is_required).map(q => q.id);
        const answeredIds = Object.keys(answers);
        const allRequiredAnswered = requiredIds.every(reqId => answeredIds.includes(reqId) && answers[reqId].value !== '');

        if (!allRequiredAnswered) {
            alert('Por favor, responda todas as perguntas obrigatórias antes de enviar!');
            return;
        }

        setSubmitting(true);
        try {
            // 1. Criar Sessão anonimizada (nome secreto)
            const sessionRes = await api.post('/api/responses/session', {
                questionnaire_id: id,
                respondent_name: 'Colaborador Anônimo', // Sigilo garantido para relatórios
                user_id: user.id // Utilizado apenas via backend para fechar a pesquisa nas pendências
            });
            const sessionId = sessionRes.data.session_id;

            // 2. Prepara batch de respostas
            const batchResponses = Object.keys(answers).map(qId => ({
                question_id: qId,
                value: answers[qId].value,
                numeric_value: answers[qId].numeric_value || null
            }));

            // 3. Envia batch
            await api.post('/api/responses/batch', {
                session_id: sessionId,
                responses: batchResponses
            });

            alert('Muito obrigado! Suas respostas foram enviadas e computadas de forma anônima.');
            navigate('/user-dashboard');

        } catch (err) {
            console.error("Erro ao enviar respostas", err);
            alert('Não foi possível enviar suas respostas no momento. Tente novamente mais tarde.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSpeak = (text) => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'pt-BR';
            window.speechSynthesis.speak(utterance);
        }
    };

    const handleListen = (questionId) => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Seu navegador não suporta reconhecimento de voz.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'pt-BR';
        recognition.interimResults = false;

        recognition.onstart = () => setListening(questionId);
        recognition.onend = () => setListening(null);
        
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            handleAnswer(questionId, transcript);
        };

        recognition.start();
    };

    const renderQuestionInput = (q) => {
        const val = answers[q.id]?.value || '';

        switch (q.type) {
            case 'multiple_choice':
                return (
                    <FormControl component="fieldset" fullWidth>
                        <RadioGroup value={val} onChange={(e) => handleAnswer(q.id, e.target.value)}>
                            {q.options && q.options.map((opt, idx) => (
                                <FormControlLabel 
                                    key={idx} 
                                    value={opt} 
                                    control={<Radio color="success" size="large" />} 
                                    label={<Typography sx={{ fontSize: '1.3rem', fontWeight: 500 }}>{opt}</Typography>} 
                                    sx={{ mb: 1 }}
                                />
                            ))}
                        </RadioGroup>
                    </FormControl>
                );
            case 'yes_no':
                return (
                    <FormControl component="fieldset" fullWidth>
                        <RadioGroup row value={val} onChange={(e) => handleAnswer(q.id, e.target.value)}>
                            <FormControlLabel value="Sim" control={<Radio color="success" size="large" />} label={<Typography sx={{ fontSize: '1.4rem', fontWeight: 700, px: 2 }}>Sim</Typography>} />
                            <FormControlLabel value="Não" control={<Radio color="error" size="large" />} label={<Typography sx={{ fontSize: '1.4rem', fontWeight: 700, px: 2 }}>Não</Typography>} />
                        </RadioGroup>
                    </FormControl>
                );
            case 'rating':
                return (
                    <Box sx={{ mt: 1 }}>
                        <Rating
                            value={Number(val)}
                            onChange={(e, newVal) => handleAnswer(q.id, String(newVal), newVal)}
                            size="large"
                        />
                    </Box>
                );
            case 'text':
            default:
                return (
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <TextField
                            fullWidth
                            multiline
                            rows={3}
                            variant="outlined"
                            placeholder="Toque no microfone para falar ou digite aqui..."
                            value={val}
                            onChange={(e) => handleAnswer(q.id, e.target.value)}
                            InputProps={{
                                sx: { fontSize: '1.2rem', bgcolor: '#fff' }
                            }}
                        />
                        <Tooltip title="Responder falando">
                            <IconButton 
                                onClick={() => handleListen(q.id)} 
                                color={listening === q.id ? 'error' : 'primary'}
                                sx={{ 
                                    mt: 1, 
                                    bgcolor: listening === q.id ? 'rgba(211,47,47,0.1)' : 'rgba(25,118,210,0.1)',
                                    animation: listening === q.id ? 'pulse 1.5s infinite' : 'none'
                                }}
                            >
                                {listening === q.id ? <MicOffIcon fontSize="large" /> : <MicIcon fontSize="large" />}
                            </IconButton>
                        </Tooltip>
                    </Box>
                );
        }
    };

    if (loading) return <Box textAlign="center" mt={10}><CircularProgress color="success" /></Box>;

    return (
        <Box sx={{ 
            minHeight: '100vh', 
            bgcolor: '#f4f6f8', 
            py: 5, 
            px: 2,
            '& .MuiTypography-root': { transition: 'font-size 0.2s' } 
        }}>
                {/* TOOLBAR PADRÃO DE ACESSIBILIDADE */}
                <Paper sx={{ 
                    position: 'sticky', 
                    top: 10, 
                    zIndex: 1000, 
                    mb: 4, 
                    p: 2, 
                    borderRadius: 3, 
                    display: 'flex', 
                    justifyContent: 'center', 
                    gap: 3,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                    border: '2px solid #1b5e20'
                }}>
                    <Typography variant="body1" sx={{ alignSelf: 'center', fontWeight: 800, color: '#1b5e20' }}>CONTROLE DE TEXTO:</Typography>
                    <Button variant="outlined" startIcon={<DecreaseIcon />} onClick={() => setFontScale(p => Math.max(1, p - 0.2))} sx={{ fontWeight: 800, borderWidth: 2 }}>DIMINUIR</Button>
                    <Button variant="contained" startIcon={<IncreaseIcon />} onClick={() => setFontScale(p => Math.min(2, p + 0.2))} sx={{ bgcolor: '#1b5e20', fontWeight: 800 }}>AUMENTAR FONTE (A+)</Button>
                </Paper>

                <Card sx={{ 
                    mb: 4, 
                    borderRadius: 4, 
                    bgcolor: '#1b5e20', 
                    color: '#fff', 
                    boxShadow: '0 8px 32px rgba(27,94,32,0.15)' 
                }}>
                    <CardContent sx={{ p: { xs: 3, md: 4 }, textAlign: 'center' }}>
                        <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, fontSize: `${2.125 * fontScale}rem` }}>{questionnaire?.title}</Typography>
                        <Typography variant="body1" sx={{ opacity: 0.9, fontSize: `${1 * fontScale}rem` }}>
                            {questionnaire?.description}
                        </Typography>
                        <Typography variant="caption" sx={{ display: 'block', mt: 3, opacity: 0.7, fontSize: `${0.75 * fontScale}rem` }}>
                            * Suas respostas não estarão atreladas ao seu nome nos relatórios em respeito a sua privacidade.
                        </Typography>
                    </CardContent>
                </Card>

                {questions.map((q, index) => (
                    <Card key={q.id} sx={{ mb: 4, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' }}>
                        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                                <Typography variant="h5" sx={{ fontWeight: 800, color: '#333', fontSize: `${1.5 * fontScale}rem` }}>
                                    {index + 1}. {q.text}
                                    {q.is_required && <span style={{ color: '#d32f2f', marginLeft: 8 }}>*</span>}
                                </Typography>
                                <Tooltip title="Ouvir pergunta">
                                    <IconButton onClick={() => handleSpeak(q.text)} sx={{ bgcolor: 'rgba(27,94,32,0.1)', color: '#1b5e20' }}>
                                        <SpeakIcon fontSize="large" />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                            
                            {/* APLICANDO FONT SCALE NO RENDER INPUT */}
                            <Box sx={{ '& .MuiTypography-root': { fontSize: `${1 * fontScale}rem` } }}>
                                {renderQuestionInput(q)}
                            </Box>
                        </CardContent>
                    </Card>
                ))}

                <Stack direction="row" justifyContent="space-between" mt={4}>
                    <Button variant="text" color="inherit" disabled={submitting} onClick={() => navigate('/user-dashboard')}>
                        Voltar
                    </Button>
                    <Button
                        variant="contained"
                        color="success"
                        size="large"
                        sx={{ px: { xs: 2, md: 4 }, py: 1.5, borderRadius: 2, bgcolor: '#1b5e20', fontWeight: 800 }}
                        onClick={handleSubmit}
                        disabled={submitting || questions.length === 0}
                    >
                        {submitting ? <CircularProgress size={24} color="inherit" /> : 'ENVIAR RESPOSTAS'}
                    </Button>
                </Stack>
        </Box>
    );
}

export default AnswerQuestionnairePage;
