import React, { useRef, useState, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Box, Typography, Paper, CircularProgress, Fade } from '@mui/material';
import { getFaceDescriptor, isModelsLoaded, loadModels } from '../services/faceRecognition';
import * as faceapi from '@vladmandic/face-api';

const FaceCapture = ({ onCapture }) => {
    const webcamRef = useRef(null);
    const [processing, setProcessing] = useState(false);
    const [status, setStatus] = useState('Iniciando biometria...');
    const [modelsReady, setModelsReady] = useState(isModelsLoaded());
    const [captured, setCaptured] = useState(false);
    const [detectionProgress, setDetectionProgress] = useState(0);
    const [countdown, setCountdown] = useState(null);

    // Carregamento e Monitoramento dos modelos
    useEffect(() => {
        if (modelsReady) return;
        
        // Disparar carregamento se ainda não iniciado
        loadModels();

        const interval = setInterval(() => {
            if (isModelsLoaded()) {
                setModelsReady(true);
                setStatus('Centralize o rosto...');
                clearInterval(interval);
            }
        }, 500);
        return () => clearInterval(interval);
    }, [modelsReady]);

    const handleCapture = useCallback(async (canvas, optimizedImage) => {
        setProcessing(true);
        setStatus('📸 Processando...');
        try {
            const descriptor = await getFaceDescriptor(canvas);
            if (descriptor) {
                setCaptured(true);
                setStatus('✅ Identificado!');
                onCapture(descriptor, optimizedImage);
            } else {
                setCountdown(null);
                setDetectionProgress(0);
                setStatus('❌ Rosto instável. Tente novamente.');
                setTimeout(() => !captured && setStatus('Centralize o rosto...'), 2000);
            }
        } catch (error) {
            console.error("Erro no processamento:", error);
            setStatus('❌ Erro na biometria');
        } finally {
            setProcessing(false);
        }
    }, [onCapture, captured]);

    // Loop de Detecção Automática
    useEffect(() => {
        if (!modelsReady || captured || processing) return;

        let frameId;
        let countdownTimer;

        const detectFrame = async () => {
            if (!webcamRef.current) return;
            
            const video = webcamRef.current.video;
            if (!video || video.readyState !== 4) {
                frameId = requestAnimationFrame(detectFrame);
                return;
            }

            try {
                // Detecção ultra rápida
                const detection = await faceapi.detectSingleFace(video);
                
                if (detection && detection.score > 0.8) {
                    setDetectionProgress(prev => Math.min(100, prev + 15));
                    
                    // Iniciar contagem regressiva se estiver estável
                    if (detectionProgress >= 100 && countdown === null) {
                        setCountdown(3);
                    }
                } else {
                    setDetectionProgress(prev => Math.max(0, prev - 10));
                    if (countdown !== null) setCountdown(null); // Reseta se o rosto sumir
                    if (detectionProgress === 0) setStatus('Centralize o rosto...');
                }
            } catch (err) {
                console.warn("Detection error:", err);
            }

            frameId = requestAnimationFrame(detectFrame);
        };

        // Gerenciar o timer da contagem regressiva
        if (countdown !== null && countdown > 0) {
            setStatus('Mantenha-se parado...');
            countdownTimer = setTimeout(() => {
                setCountdown(prev => prev - 1);
            }, 1000);
        } else if (countdown === 0) {
            // Fim da contagem: Dispara captura
            setStatus('📸 Capturando...');
            const imageSrc = webcamRef.current.getScreenshot();
            if (imageSrc) {
                const img = new Image();
                img.src = imageSrc;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const size = 500; // Aumentado para melhor qualidade
                    canvas.width = size;
                    canvas.height = size;
                    const ctx = canvas.getContext('2d');
                    const minDim = Math.min(img.width, img.height);
                    const sx = (img.width - minDim) / 2;
                    const sy = (img.height - minDim) / 2;
                    ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
                    const optimizedImage = canvas.toDataURL('image/jpeg', 0.85);
                    handleCapture(canvas, optimizedImage);
                };
            }
            setCountdown(null); // Finaliza o fluxo
            return; 
        }

        frameId = requestAnimationFrame(detectFrame);
        return () => {
            cancelAnimationFrame(frameId);
            if (countdownTimer) clearTimeout(countdownTimer);
        };
    }, [modelsReady, captured, processing, detectionProgress, countdown, handleCapture]);

    return (
        <Paper variant="outlined" sx={{ 
            p: 3, 
            textAlign: 'center', 
            bgcolor: '#ffffff', 
            borderRadius: 6,
            boxShadow: '0 12px 40px rgba(0,0,0,0.06)',
            border: '1px solid #eee',
            position: 'relative',
            overflow: 'hidden'
        }}>
            <Box sx={{ position: 'relative', display: 'inline-block', lineHeight: 0, mb: 2 }}>
                <Webcam
                    audio={false}
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    videoConstraints={{ width: 640, height: 480, facingMode: "user" }}
                    style={{ 
                        borderRadius: '24px', 
                        width: '100%', 
                        maxWidth: '320px',
                        transform: 'scaleX(-1)', // Mirror effect
                        border: captured ? '4px solid #4caf50' : '4px solid #f0f0f0',
                        transition: 'border 0.3s ease'
                    }}
                />
                
                {/* Overlay de Progresso circular */}
                {!captured && (
                    <Box sx={{ 
                        position: 'absolute', 
                        top: '50%', 
                        left: '50%', 
                        transform: 'translate(-50%, -50%)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        pointerEvents: 'none',
                        zIndex: 10
                    }}>
                        <CircularProgress
                            variant="determinate"
                            value={detectionProgress}
                            size={200}
                            thickness={2}
                            sx={{ color: '#4caf50', opacity: 0.4 }}
                        />
                        
                        {/* Contagem Regressiva Visual */}
                        {countdown !== null && (
                            <Typography 
                                variant="h1" 
                                sx={{ 
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    fontWeight: 900,
                                    color: '#fff',
                                    textShadow: '0 4px 20px rgba(0,0,0,0.4)',
                                    animation: 'pulse 1s infinite'
                                }}
                            >
                                {countdown > 0 ? countdown : '📸'}
                            </Typography>
                        )}
                    </Box>
                )}
                
                {processing && (
                    <Box sx={{ 
                        position: 'absolute', 
                        inset: 0, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        bgcolor: 'rgba(255,255,255,0.6)',
                        borderRadius: '24px',
                        zIndex: 20
                    }}>
                        <CircularProgress size={50} color="success" />
                    </Box>
                )}
            </Box>

            <Fade in={true}>
                <Box>
                    <Typography 
                        variant="h6" 
                        sx={{ 
                            fontWeight: 800, 
                            color: captured ? '#1b5e20' : '#444',
                            fontSize: '0.9rem',
                            mb: 0.5
                        }}
                    >
                        {status}
                    </Typography>
                    
                    {!captured && (
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', px: 2 }}>
                            Posicione seu rosto dentro do círculo e aguarde a captura automática.
                        </Typography>
                    )}
                </Box>
            </Fade>

            {captured && (
                <Typography 
                    onClick={() => { setCaptured(false); setDetectionProgress(0); setStatus('Centralize o rosto...'); }} 
                    sx={{ mt: 2, cursor: 'pointer', color: '#1b5e20', fontWeight: 700, fontSize: '0.75rem', textDecoration: 'underline' }}
                >
                    Recapturar foto
                </Typography>
            )}
        </Paper>
    );
};

export default FaceCapture;