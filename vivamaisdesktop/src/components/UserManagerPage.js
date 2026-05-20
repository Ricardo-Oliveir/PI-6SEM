import React, { useState, useEffect } from 'react';
import {
    Box, Button, TextField, Typography, Paper, Stack, Table, TableBody,
    TableCell, TableContainer, TableHead, TableRow, IconButton, Grid, CircularProgress,
    FormControl, InputLabel, Select, MenuItem, Tooltip, Chip, Divider,
    Dialog, DialogTitle, DialogContent, DialogActions, Zoom, Fade
} from '@mui/material';
import { 
    Delete as DeleteIcon, Add as AddIcon, Edit as EditIcon, 
    Cancel as CancelIcon, Search as SearchIcon, People as PeopleIcon,
    Close as CloseIcon
} from '@mui/icons-material';
import { InputAdornment } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import api from '../services/api';
import FaceCapture from '../components/FaceCapture';
import * as faceapi from '@vladmandic/face-api';
import { loadModels } from '../services/faceRecognition';

function UserManagerPage() {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingUserId, setEditingUserId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState({
        username: '', full_name: '', first_name: '', last_name: '', email: '', password: '', confirm_password: '',
        phone: '', address: '', role: 'user'
    });
    const [capturedPhoto, setCapturedPhoto] = useState(null);
    const [capturedDescriptor, setCapturedDescriptor] = useState(null);

    const fetchUsers = async () => {
        try {
            const res = await api.get('/users');
            if (Array.isArray(res.data)) {
                setUsers(res.data);
            }
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => { 
        fetchUsers(); 
        loadModels(); // Pré-carregar modelos ao abrir a página de gestão
    }, []);

    const handleCancelForm = () => {
        setShowForm(false);
        setEditingUserId(null);
        setCapturedPhoto(null);
        setCapturedDescriptor(null);
        setFormData({ username: '', full_name: '', first_name: '', last_name: '', email: '', password: '', confirm_password: '', phone: '', address: '', role: 'user' });
    };

    const handleEditClick = (u) => {
        // Tentar separar o nome completo em primeiro e último
        const nameParts = (u.full_name || '').split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        setEditingUserId(u.id);
        setFormData({
            username: u.username || '',
            full_name: u.full_name || '',
            first_name: firstName,
            last_name: lastName,
            email: u.email || '',
            password: '',
            confirm_password: '',
            phone: u.phone || '',
            address: u.address || '',
            role: u.role || 'user'
        });
        setCapturedPhoto(u.face_photo || null);
        setCapturedDescriptor(u.face_descriptor || null);
        setShowForm(true);
    };

    // Função para gerar username único e nome completo
    const handleNameChange = (field, value) => {
        const newFormData = { ...formData, [field]: value };
        
        const first = newFormData.first_name || '';
        const last = newFormData.last_name || '';
        
        // Normalizar: remover acentos, espaços e para minúsculo
        const base = (first + last)
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, '');
            
        let finalUsername = base;
        let counter = 1;
        
        // Verificar duplicidade na lista local de usuários
        // Ignora o usuário atual se estiver editando
        if (base) {
            while (users.some(u => u.username === finalUsername && u.id !== editingUserId)) {
                finalUsername = `${base}${counter.toString().padStart(2, '0')}`;
                counter++;
            }
        }
        
        setFormData({
            ...newFormData,
            username: finalUsername,
            full_name: `${first} ${last}`.trim()
        });
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            // 1. Validação básica
            if (!formData.full_name || !formData.username) {
                alert("Nome e Usuário são obrigatórios.");
                setLoading(false);
                return;
            }

            if (!editingUserId && (!formData.password || formData.password.length < 6)) {
                alert("A senha deve ter pelo menos 6 caracteres.");
                setLoading(false);
                return;
            }

            if (formData.password && formData.password.length < 6) {
                alert("A nova senha deve ter pelo menos 6 caracteres.");
                setLoading(false);
                return;
            }

            if (formData.password && formData.password !== formData.confirm_password) {
                alert("As senhas não coincidem.");
                setLoading(false);
                return;
            }

            // 2. Re-buscar usuários do servidor para garantir lista mais atualizada
            const res = await api.get('/users');
            const latestUsers = res.data;

            // 3. Validação Biométrica (DUPLICIDADE)
            if (capturedDescriptor) {
                let matches = [];
                latestUsers.forEach(u => {
                    // Ignorar o próprio usuário se estiver editando
                    if (editingUserId && u.id === editingUserId) return;

                    if (u.face_descriptor) {
                        try {
                            const savedDescriptor = Array.isArray(u.face_descriptor) 
                                ? u.face_descriptor 
                                : Object.values(u.face_descriptor);
                            
                            const distance = faceapi.euclideanDistance(capturedDescriptor, savedDescriptor);
                            
                            // Log de debug para o desenvolvedor
                            console.log(`📏 Distância para ${u.full_name}: ${distance.toFixed(4)}`);
                            
                            // Threshold de 0.55 para ser mais rigoroso na detecção de duplicata (antes 0.45)
                            if (distance < 0.55) {
                                matches.push(u.full_name);
                            }
                        } catch (err) {
                            console.error("Erro ao comparar biometria de", u.full_name, err);
                        }
                    }
                });

                if (matches.length > 0) {
                    alert(`⚠️ BLOQUEIO BIOMÉTRICO: Esta biometria já foi cadastrada para: ${matches.join(', ')}. Não é permitido registrar a mesma pessoa em múltiplos usuários.`);
                    setLoading(false);
                    return;
                }
            }

            if (editingUserId) {
                // Atualizar usuário
                const payload = {
                    ...formData,
                    face_photo: capturedPhoto,
                    face_descriptor: capturedDescriptor
                };
                await api.put(`/users/${editingUserId}`, payload);
                alert("Usuário atualizado com sucesso!");
            } else {
                // Criar novo usuário
                await api.post('/auth/register', {
                    ...formData,
                    face_photo: capturedPhoto,
                    face_descriptor: capturedDescriptor
                });
                alert("Usuário cadastrado com sucesso!");
            }
            handleCancelForm();
            fetchUsers();
        } catch (e) {
            console.error(e);
            alert(`Erro ao salvar: ${e.response?.data?.error || e.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Filtro de Busca
    const filteredUsers = users.filter(u => 
        u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.username?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <Box sx={{ p: 4, bgcolor: 'background.default', color: 'text.primary', minHeight: '100vh' }}>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 4 }}>
                <Typography variant="h4" sx={{ fontWeight: 800, color: isDark ? 'primary.light' : '#1b5e20' }}>Gestão de Colaboradores</Typography>
                <Button
                    variant="contained"
                    startIcon={showForm ? <CancelIcon /> : <AddIcon />}
                    onClick={() => showForm ? handleCancelForm() : setShowForm(true)}
                    sx={{ 
                        bgcolor: showForm ? '#d32f2f' : 'primary.main',
                        '&:hover': { bgcolor: showForm ? '#b71c1c' : 'primary.dark' }
                    }}
                >
                    {showForm ? "Cancelar" : "Novo Usuário"}
                </Button>
            </Stack>

            <Dialog 
                open={showForm} 
                onClose={handleCancelForm}
                maxWidth="lg"
                fullWidth
                TransitionComponent={Fade}
                PaperProps={{
                    sx: { 
                        borderRadius: 5, 
                        overflow: 'hidden', 
                        boxShadow: isDark ? 'none' : '0 20px 60px rgba(0,0,0,0.15)',
                        border: isDark ? '1px solid rgba(255,255,255,0.08)' : 'none'
                    }
                }}
            >
                <DialogTitle sx={{ 
                    bgcolor: 'background.paper', 
                    borderBottom: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #edf2f7',
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    py: 3
                }}>
                    <Box>
                        <Typography variant="h5" sx={{ fontWeight: 900, color: isDark ? 'primary.light' : '#1b5e20' }}>
                            {editingUserId ? "Editar Colaborador" : "Novo Cadastro"}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Complete as informações do perfil abaixo.
                        </Typography>
                    </Box>
                    <IconButton onClick={handleCancelForm} size="small" sx={{ color: 'text.secondary' }}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>

                <DialogContent sx={{ p: { xs: 2, md: 4 }, mt: 2 }}>
                    <Grid container spacing={4}>
                        <Grid item xs={12} md={7}>
                            <Typography variant="overline" sx={{ fontWeight: 800, color: isDark ? 'primary.light' : '#1b5e20', letterSpacing: 1.2 }}>DADOS PESSOAIS</Typography>
                            <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
                                <Grid item xs={12} md={6}>
                                    <TextField label="Primeiro Nome" placeholder="Ex: João" fullWidth value={formData.first_name} onChange={e => handleNameChange('first_name', e.target.value)} variant="outlined" sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }} />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField label="Último Nome" placeholder="Ex: Silva" fullWidth value={formData.last_name} onChange={e => handleNameChange('last_name', e.target.value)} variant="outlined" sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }} />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField label="E-mail" placeholder="contato@exemplo.com" fullWidth value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} variant="outlined" sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }} />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField 
                                        label="Login / Usuário" 
                                        placeholder="username123" 
                                        fullWidth 
                                        value={formData.username} 
                                        onChange={e => setFormData({ ...formData, username: e.target.value.toLowerCase() })} 
                                        variant="outlined" 
                                        helperText="Será salvo sem espaços e em minúsculo"
                                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }} 
                                    />
                                </Grid>

                                <Grid item xs={12} md={6}>
                                    <TextField 
                                        label={editingUserId ? "Nova Senha (opcional)" : "Senha de Acesso"} 
                                        type="password" 
                                        fullWidth 
                                        value={formData.password} 
                                        onChange={e => setFormData({ ...formData, password: e.target.value })} 
                                        variant="outlined"
                                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField 
                                        label="Confirmar Senha" 
                                        type="password" 
                                        fullWidth 
                                        value={formData.confirm_password} 
                                        onChange={e => setFormData({ ...formData, confirm_password: e.target.value })} 
                                        variant="outlined"
                                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                                    />
                                </Grid>

                                <Grid item xs={12} md={6}>
                                    <FormControl fullWidth variant="outlined">
                                        <InputLabel>Perfil de Acesso</InputLabel>
                                        <Select
                                            value={formData.role}
                                            label="Perfil de Acesso"
                                            onChange={e => setFormData({ ...formData, role: e.target.value })}
                                            sx={{ borderRadius: 3 }}
                                        >
                                            <MenuItem value="user">Respondente (Colaborador)</MenuItem>
                                            <MenuItem value="admin">Administrador (Gestor)</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>

                                <Grid item xs={12} md={6}>
                                    <TextField label="Telefone" placeholder="(00) 00000-0000" fullWidth value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} variant="outlined" sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }} />
                                </Grid>
                                <Grid item xs={12}>
                                    <TextField label="Endereço Completo" multiline rows={2} fullWidth value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} variant="outlined" sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }} />
                                </Grid>
                            </Grid>
                        </Grid>

                        <Grid item xs={12} md={5}>
                            <Box sx={{ 
                                height: '100%', 
                                minHeight: 350,
                                display: 'flex', 
                                flexDirection: 'column', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                bgcolor: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
                                borderRadius: 5,
                                p: 3,
                                border: isDark ? '2px dashed rgba(255,255,255,0.15)' : '2px dashed #cbd5e1'
                            }}>
                                <Typography variant="overline" sx={{ fontWeight: 800, mb: 2, color: isDark ? 'primary.light' : '#1b5e20', letterSpacing: 1 }}>CAPTURA FACIAL</Typography>
                                
                                <Box sx={{ width: '100%', maxWidth: 300, position: 'relative' }}>
                                    <FaceCapture 
                                        autoStart={false} 
                                        autoCapture={false} 
                                        onCapture={(desc, photo) => { setCapturedDescriptor(desc); setCapturedPhoto(photo); }} 
                                    />
                                </Box>

                                {capturedPhoto && (
                                    <Box sx={{ mt: 3, textAlign: 'center', animation: 'fadeIn 0.5s ease' }}>
                                        <Typography variant="caption" sx={{ bgcolor: isDark ? 'rgba(46,125,50,0.2)' : '#e8f5e9', color: isDark ? '#81c784' : '#2e7d32', px: 2, py: 0.5, borderRadius: 10, fontWeight: 900, display: 'inline-block', mb: 1.5 }}>
                                            ✔ BIOMETRIA IDENTIFICADA
                                        </Typography>
                                        <Box sx={{ 
                                            width: 110, 
                                            height: 110, 
                                            borderRadius: '50%', 
                                            border: isDark ? '4px solid #4caf50' : '4px solid #1b5e20', 
                                            p: 0.5,
                                            boxShadow: isDark ? 'none' : '0 8px 25px rgba(27,94,32,0.2)',
                                            margin: '0 auto'
                                        }}>
                                            <img src={capturedPhoto} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                                        </Box>
                                    </Box>
                                )}
                            </Box>
                        </Grid>
                    </Grid>
                </DialogContent>

                <DialogActions sx={{ p: 4, bgcolor: 'background.paper', borderTop: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #edf2f7' }}>
                    <Button variant="text" color="inherit" onClick={handleCancelForm} sx={{ fontWeight: 800, px: 3 }}>CANCELAR</Button>
                    <Button 
                        variant="contained" 
                        onClick={handleSave} 
                        disabled={loading} 
                        sx={{ 
                            bgcolor: 'primary.main', 
                            px: 6, 
                            py: 1.5, 
                            borderRadius: 3,
                            fontWeight: 900,
                            boxShadow: isDark ? 'none' : '0 8px 20px rgba(27,94,32,0.3)',
                            '&:hover': { bgcolor: 'primary.dark', boxShadow: isDark ? 'none' : '0 10px 25px rgba(27,94,32,0.4)' }
                        }}
                    >
                        {loading ? <CircularProgress size={24} color="inherit" /> : (editingUserId ? "SALVAR ALTERAÇÕES" : "FINALIZAR CADASTRO")}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Barra de Busca para Filtrar Usuários */}
            <Box sx={{ mb: 3 }}>
                <TextField
                    fullWidth
                    variant="outlined"
                    placeholder="Buscar por nome, e-mail ou nome de usuário..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon sx={{ color: isDark ? 'primary.light' : '#1b5e20' }} />
                            </InputAdornment>
                        ),
                        sx: { 
                            borderRadius: 4, 
                            bgcolor: 'background.paper',
                            color: 'text.primary',
                            '& fieldset': { borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0' },
                            '&:hover fieldset': { borderColor: 'primary.main !important' }
                        }
                    }}
                />
            </Box>

            {/* Lista de Usuários Responsiva */}
            <Box sx={{ mt: 2 }}>
                {/* Versão Desktop (Tabela Única para Alinhamento Perfeito) */}
                <Paper sx={{ 
                    display: { xs: 'none', md: 'block' }, 
                    borderRadius: 4, 
                    overflow: 'hidden', 
                    boxShadow: isDark ? 'none' : '0 4px 20px rgba(0,0,0,0.05)',
                    border: isDark ? '1px solid rgba(255,255,255,0.08)' : 'none',
                    bgcolor: 'background.paper'
                }}>
                    <Table>
                        <TableHead sx={{ bgcolor: isDark ? 'rgba(76, 175, 80, 0.15)' : '#e8f5e9' }}>
                            <TableRow>
                                <TableCell sx={{ width: 100, fontWeight: 800, color: isDark ? 'primary.light' : '#1b5e20' }}>Foto</TableCell>
                                <TableCell sx={{ width: '30%', fontWeight: 800, color: isDark ? 'primary.light' : '#1b5e20' }}>Nome / Login</TableCell>
                                <TableCell sx={{ width: '20%', fontWeight: 800, color: isDark ? 'primary.light' : '#1b5e20' }}>Perfil</TableCell>
                                <TableCell sx={{ width: '30%', fontWeight: 800, color: isDark ? 'primary.light' : '#1b5e20' }}>Contato</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 800, color: isDark ? 'primary.light' : '#1b5e20' }}>Ações</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredUsers.length > 0 ? filteredUsers.map((u) => (
                                <TableRow 
                                    key={u.id} 
                                    hover 
                                    sx={{ 
                                        '& .MuiTableCell-root': { py: 2, verticalAlign: 'middle', borderBottom: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #f1f5f9' },
                                        transition: '0.2s',
                                        '&:hover': { bgcolor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(232, 245, 233, 0.4)' }
                                    }}
                                >
                                    <TableCell>
                                        <Box sx={{ 
                                            width: 48, 
                                            height: 48, 
                                            borderRadius: '50%', 
                                            overflow: 'hidden', 
                                            bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9', 
                                            border: isDark ? '2px solid rgba(255,255,255,0.1)' : '2px solid #e2e8f0',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                                        }}>
                                            {u.face_photo ? (
                                                <img src={u.face_photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (
                                                <PeopleIcon sx={{ color: '#94a3b8', fontSize: 24 }} />
                                            )}
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        <Typography sx={{ fontWeight: 700, color: 'text.primary', lineHeight: 1.2 }}>{u.full_name || 'Usuário Sem Nome'}</Typography>
                                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>@{u.username || 'user'}</Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Chip 
                                            label={u.role === 'admin' ? 'Administrador' : 'Respondente'} 
                                            size="small"
                                            sx={{ 
                                                bgcolor: u.role === 'admin' ? (isDark ? 'rgba(76, 175, 80, 0.2)' : 'rgba(27,94,32,0.1)') : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
                                                color: u.role === 'admin' ? (isDark ? '#81c784' : '#1b5e20') : 'text.secondary',
                                                fontWeight: 700,
                                                minWidth: 110
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary' }}>{u.email || 'Email não cadastrado'}</Typography>
                                        {u.phone && <Typography variant="caption" color="text.secondary">{u.phone}</Typography>}
                                    </TableCell>
                                    <TableCell align="right">
                                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                                            <Tooltip title="Editar">
                                                <IconButton color="primary" onClick={() => handleEditClick(u)} size="small" sx={{ bgcolor: isDark ? 'rgba(25,118,210,0.15)' : 'rgba(25,118,210,0.05)' }}>
                                                    <EditIcon sx={{ color: isDark ? '#90caf9' : 'primary.main' }} />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Excluir">
                                                <IconButton color="error" onClick={async () => { if (window.confirm("Excluir definitivamente?")) { await api.delete(`/users/${u.id}`); fetchUsers(); } }} size="small" sx={{ bgcolor: isDark ? 'rgba(211,47,47,0.15)' : 'rgba(211,47,47,0.05)' }}>
                                                    <DeleteIcon sx={{ color: isDark ? '#ef9a9a' : 'error.main' }} />
                                                </IconButton>
                                            </Tooltip>
                                        </Stack>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={5} align="center" sx={{ py: 5 }}>
                                        <Typography color="textSecondary">Nenhum colaborador encontrado.</Typography>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </Paper>

                {/* Versão Mobile (Cards - Mantida para Responsividade) */}
                <Stack spacing={2} sx={{ display: { xs: 'flex', md: 'none' } }}>
                    {filteredUsers.length > 0 && filteredUsers.map((u) => (
                        <Paper 
                            key={u.id} 
                            sx={{ 
                                p: 2, 
                                borderRadius: 4, 
                                boxShadow: isDark ? 'none' : '0 4px 20px rgba(0,0,0,0.05)',
                                border: isDark ? '1px solid rgba(255,255,255,0.08)' : 'none',
                                bgcolor: 'background.paper',
                                color: 'text.primary',
                                overflow: 'hidden'
                            }}
                        >
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <Box sx={{ 
                                        width: 64, 
                                        height: 64, 
                                        borderRadius: '50%', 
                                        overflow: 'hidden', 
                                        bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9', 
                                        border: isDark ? '3px solid #4caf50' : '3px solid #1b5e20',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                                    }}>
                                        {u.face_photo ? (
                                            <img src={u.face_photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <PeopleIcon sx={{ color: '#94a3b8', fontSize: 32 }} />
                                        )}
                                    </Box>
                                    <Box sx={{ flexGrow: 1 }}>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'text.primary' }}>{u.full_name}</Typography>
                                        <Typography variant="body2" color="text.secondary">@{u.username}</Typography>
                                        <Chip 
                                            label={u.role === 'admin' ? 'Administrador' : 'Respondente'} 
                                            size="small"
                                            sx={{ 
                                                mt: 0.5, 
                                                height: 20, 
                                                fontSize: '0.65rem', 
                                                fontWeight: 800,
                                                bgcolor: u.role === 'admin' ? (isDark ? 'rgba(76, 175, 80, 0.2)' : 'rgba(27,94,32,0.1)') : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
                                                color: u.role === 'admin' ? (isDark ? '#81c784' : '#1b5e20') : 'text.secondary'
                                            }}
                                        />
                                    </Box>
                                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                        <IconButton color="primary" onClick={() => handleEditClick(u)}><EditIcon sx={{ color: isDark ? '#90caf9' : 'primary.main' }} /></IconButton>
                                        <IconButton color="error" onClick={async () => { if (window.confirm("Excluir definitivamente?")) { await api.delete(`/users/${u.id}`); fetchUsers(); } }}><DeleteIcon sx={{ color: isDark ? '#ef9a9a' : 'error.main' }} /></IconButton>
                                    </Box>
                                </Box>
                                <Divider sx={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }} />
                                <Box>
                                    <Typography variant="caption" display="block" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>CONTATO:</Typography>
                                    <Typography variant="body2" sx={{ color: 'text.primary' }}>{u.email}</Typography>
                                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>{u.phone}</Typography>
                                </Box>
                            </Box>
                        </Paper>
                    ))}
                </Stack>

            </Box>
        </Box>
    );
}

export default UserManagerPage;