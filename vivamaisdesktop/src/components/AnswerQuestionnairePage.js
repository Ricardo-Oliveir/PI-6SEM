import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Box, Typography, Card, CardContent, Button, CircularProgress,
    Radio, RadioGroup, FormControlLabel, FormControl,
    TextField, Rating, Stack
} from '@mui/material';
import api from '../services/api';

function AnswerQuestionnairePage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [questionnaire, setQuestionnaire] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [answers, setAnswers] = useState({});

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

    const renderQuestionInput = (q) => {
        const val = answers[q.id]?.value || '';

        switch (q.type) {
            case 'multiple_choice':
                return (
                    <FormControl component="fieldset" fullWidth>
                        <RadioGroup value={val} onChange={(e) => handleAnswer(q.id, e.target.value)}>
                            {q.options && q.options.map((opt, idx) => (
                                <FormControlLabel key={idx} value={opt} control={<Radio color="success" />} label={opt} />
                            ))}
                        </RadioGroup>
                    </FormControl>
                );
            case 'yes_no':
                return (
                    <FormControl component="fieldset" fullWidth>
                        <RadioGroup row value={val} onChange={(e) => handleAnswer(q.id, e.target.value)}>
                            <FormControlLabel value="Sim" control={<Radio color="success" />} label="Sim" />
                            <FormControlLabel value="Não" control={<Radio color="error" />} label="Não" />
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
                    <TextField
                        fullWidth
                        multiline
                        rows={3}
                        variant="outlined"
                        placeholder="Sua resposta..."
                        value={val}
                        onChange={(e) => handleAnswer(q.id, e.target.value)}
                    />
                );
        }
    };

    if (loading) return <Box textAlign="center" mt={10}><CircularProgress color="success" /></Box>;

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: '#f4f6f8', py: 5, px: 2 }}>
            <Box sx={{ maxWidth: 700, margin: '0 auto' }}>
                <Card sx={{ mb: 4, borderRadius: 4, bgcolor: '#1b5e20', color: '#fff' }}>
                    <CardContent sx={{ p: 4, textAlign: 'center' }}>
                        <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>{questionnaire?.title}</Typography>
                        <Typography variant="body1" sx={{ opacity: 0.9 }}>
                            {questionnaire?.description}
                        </Typography>
                        <Typography variant="caption" sx={{ display: 'block', mt: 3, opacity: 0.7 }}>
                            * Suas respostas não estarão atreladas ao seu nome nos relatórios em respeito a sua privacidade.
                        </Typography>
                    </CardContent>
                </Card>

                {questions.map((q, index) => (
                    <Card key={q.id} sx={{ mb: 3, borderRadius: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                        <CardContent sx={{ p: 3 }}>
                            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                                {index + 1}. {q.text}
                                {q.is_required && <span style={{ color: '#d32f2f', marginLeft: 4 }}>*</span>}
                            </Typography>
                            {renderQuestionInput(q)}
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
                        sx={{ px: 4, py: 1.5, borderRadius: 2, bgcolor: '#1b5e20' }}
                        onClick={handleSubmit}
                        disabled={submitting || questions.length === 0}
                    >
                        {submitting ? <CircularProgress size={24} color="inherit" /> : 'ENVIAR RESPOSTAS'}
                    </Button>
                </Stack>
            </Box>
        </Box>
    );
}

export default AnswerQuestionnairePage;
