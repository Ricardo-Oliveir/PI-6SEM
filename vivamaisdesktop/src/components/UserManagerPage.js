import React, { useState, useEffect } from 'react';
import {
    Box, Button, TextField, Typography, Paper, Stack, Table, TableBody,
    TableCell, TableContainer, TableHead, TableRow, IconButton, Grid, CircularProgress,
    FormControl, InputLabel, Select, MenuItem, Tooltip
} from '@mui/material';
import { 
    Delete as DeleteIcon, Add as AddIcon, Edit as EditIcon, 
    Cancel as CancelIcon, Search as SearchIcon 
} from '@mui/icons-material';
import { InputAdornment } from '@mui/material';
import api from '../services/api';
import FaceCapture from '../components/FaceCapture';
import * as faceapi from '@vladmandic/face-api';
import { loadModels } from '../services/faceRecognition';

function UserManagerPage() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingUserId, setEditingUserId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState({
        username: '', full_name: '', email: '', password: '',
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
        setFormData({ username: '', full_name: '', email: '', password: '', phone: '', address: '', role: 'user' });
    };

    const handleEditClick = (u) => {
        setEditingUserId(u.id);
        setFormData({
            username: u.username || '',
            full_name: u.full_name || '',
            email: u.email || '',
            password: '',
            phone: u.phone || '',
            address: u.address || '',
            role: u.role || 'user'
        });
        setCapturedPhoto(u.face_photo || null);
        setCapturedDescriptor(u.face_descriptor || null);
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            // 1. Re-buscar usuários do servidor para garantir lista mais atualizada
            const res = await api.get('/users');
            const latestUsers = res.data;

            // 2. Validação Biométrica (DUPLICIDADE)
            if (!editingUserId && capturedDescriptor) {
                let matches = [];
                latestUsers.forEach(u => {
                    if (u.face_descriptor) {
                        try {
                            const savedDescriptor = Array.isArray(u.face_descriptor) 
                                ? u.face_descriptor 
                                : Object.values(u.face_descriptor);
                            
                            const distance = faceapi.euclideanDistance(capturedDescriptor, savedDescriptor);
                            
                            // Log de debug para o desenvolvedor
                            console.log(`📏 Distância para ${u.full_name}: ${distance.toFixed(4)}`);
                            
                            // Threshold de 0.45 para ser mais rigoroso na detecção de duplicata
                            if (distance < 0.45) {
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
        <Box sx={{ p: 4, bgcolor: '#f4f6f8', minHeight: '100vh' }}>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 4 }}>
                <Typography variant="h4" sx={{ fontWeight: 800, color: '#1b5e20' }}>Gestão de Colaboradores</Typography>
                <Button
                    variant="contained"
                    startIcon={showForm ? <CancelIcon /> : <AddIcon />}
                    onClick={() => showForm ? handleCancelForm() : setShowForm(true)}
                    sx={{ bgcolor: showForm ? '#d32f2f' : '#1b5e20' }}
                >
                    {showForm ? "Cancelar" : "Novo Usuário"}
                </Button>
            </Stack>

            {showForm && (
                <Paper sx={{ p: { xs: 2, md: 4 }, mb: 4, borderRadius: 6, boxShadow: '0 10px 30px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                    <Box sx={{ borderBottom: '1px solid #eee', pb: 2, mb: 3 }}>
                        <Typography variant="h5" sx={{ fontWeight: 800, color: '#1b5e20' }}>
                            {editingUserId ? "Editando Colaborador" : "Novo Cadastro Biométrico"}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">Preencha os dados e capture a biometria para finalizar.</Typography>
                    </Box>

                    <Grid container spacing={4}>
                        <Grid item xs={12} md={7}>
                            <Typography variant="overline" sx={{ fontWeight: 'bold', color: '#1b5e20' }}>DADOS PESSOAIS</Typography>
                            <Grid container spacing={2} sx={{ mt: 0.5 }}>
                                <Grid item xs={12}>
                                    <TextField label="Nome Completo" fullWidth value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })} variant="filled" />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField label="E-mail" fullWidth value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} disabled={!!editingUserId} variant="filled" />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField label="Login / Usuário" fullWidth value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} disabled={!!editingUserId} variant="filled" />
                                </Grid>

                                {!editingUserId && (
                                    <Grid item xs={12}>
                                        <TextField label="Senha de Acesso" type="password" fullWidth value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} variant="filled" />
                                    </Grid>
                                )}

                                <Grid item xs={12} md={6}>
                                    <FormControl fullWidth variant="filled">
                                        <InputLabel>Perfil de Acesso</InputLabel>
                                        <Select
                                            value={formData.role}
                                            label="Perfil de Acesso"
                                            onChange={e => setFormData({ ...formData, role: e.target.value })}
                                        >
                                            <MenuItem value="user">Respondente (Acesso Normal)</MenuItem>
                                            <MenuItem value="admin">Administrador (Gestor)</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>

                                <Grid item xs={12} md={6}>
                                    <TextField label="Telefone" fullWidth value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} variant="filled" />
                                </Grid>
                                <Grid item xs={12}>
                                    <TextField label="Endereço Completo" fullWidth value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} variant="filled" />
                                </Grid>
                            </Grid>
                        </Grid>

                        <Grid item xs={12} md={5}>
                            <Box sx={{ 
                                height: '100%', 
                                display: 'flex', 
                                flexDirection: 'column', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                bgcolor: '#f8fafc',
                                borderRadius: 4,
                                p: 3,
                                border: '2px dashed #e2e8f0'
                            }}>
                                <Typography variant="overline" sx={{ fontWeight: 'bold', mb: 2, color: '#1b5e20' }}>CAPTURA FACIAL OBRIGATÓRIA</Typography>
                                
                                <Box sx={{ width: '100%', maxWidth: 350 }}>
                                    <FaceCapture onCapture={(desc, photo) => { setCapturedDescriptor(desc); setCapturedPhoto(photo); }} />
                                </Box>

                                {capturedPhoto && (
                                    <Box sx={{ mt: 3, textAlign: 'center', animation: 'fadeIn 0.5s ease' }}>
                                        <Typography variant="caption" color="success.main" sx={{ fontWeight: 'bold', display: 'block', mb: 1 }}>✔ BIOMETRIA PRONTA</Typography>
                                        <Box sx={{ 
                                            width: 100, 
                                            height: 100, 
                                            borderRadius: '50%', 
                                            border: '4px solid #1b5e20', 
                                            p: 0.5,
                                            boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                                            margin: '0 auto'
                                        }}>
                                            <img src={capturedPhoto} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                                        </Box>
                                    </Box>
                                )}
                            </Box>
                        </Grid>
                    </Grid>

                    <Box sx={{ mt: 5, pt: 3, borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                        <Button variant="text" color="inherit" onClick={handleCancelForm} sx={{ fontWeight: 'bold' }}>CANCELAR</Button>
                        <Button 
                            variant="contained" 
                            onClick={handleSave} 
                            disabled={loading || (!capturedPhoto && !editingUserId)} 
                            sx={{ 
                                bgcolor: '#1b5e20', 
                                px: 6, 
                                py: 1.5, 
                                borderRadius: 2,
                                fontWeight: 'bold',
                                '&:hover': { bgcolor: '#144616' }
                            }}
                        >
                            {loading ? <CircularProgress size={24} color="inherit" /> : (editingUserId ? "SALVAR ALTERAÇÕES" : "FINALIZAR CADASTRO")}
                        </Button>
                    </Box>
                </Paper>
            )}

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
                                <SearchIcon sx={{ color: '#1b5e20' }} />
                            </InputAdornment>
                        ),
                        sx: { 
                            borderRadius: 4, 
                            bgcolor: '#fff',
                            '& fieldset': { borderColor: '#e2e8f0' },
                            '&:hover fieldset': { borderColor: '#1b5e20 !important' }
                        }
                    }}
                />
            </Box>

            <TableContainer component={Paper} sx={{ borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                <Table>
                    <TableHead sx={{ bgcolor: '#e8f5e9' }}>
                        <TableRow>
                            <TableCell>Foto</TableCell>
                            <TableCell>Nome / Login</TableCell>
                            <TableCell>Perfil</TableCell>
                            <TableCell>Contato</TableCell>
                            <TableCell align="right">Ações</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredUsers.length > 0 ? filteredUsers.map((u) => (
                            <TableRow key={u.id} hover>
                                <TableCell>
                                    <Box sx={{ width: 45, height: 45, borderRadius: '50%', overflow: 'hidden', bgcolor: '#ccc' }}>
                                        {u.face_photo && <img src={u.face_photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                    </Box>
                                </TableCell>
                                <TableCell>
                                    <Typography sx={{ fontWeight: 600 }}>{u.full_name}</Typography>
                                    <Typography variant="caption">@{u.username}</Typography>
                                </TableCell>
                                <TableCell>
                                    {u.role === 'admin' ?
                                        <Typography sx={{ fontWeight: 'bold', color: '#1b5e20' }}>Administrador</Typography> :
                                        <Typography sx={{ color: '#555' }}>Respondente</Typography>
                                    }
                                </TableCell>
                                <TableCell>{u.email}<br />{u.phone}</TableCell>
                                <TableCell align="right">
                                    <Tooltip title="Editar Usuário">
                                        <IconButton color="primary" onClick={() => handleEditClick(u)}>
                                            <EditIcon />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Excluir Usuário">
                                        <IconButton color="error" onClick={async () => { if (window.confirm("Excluir definitivamente?")) { await api.delete(`/users/${u.id}`); fetchUsers(); } }}>
                                            <DeleteIcon />
                                        </IconButton>
                                    </Tooltip>
                                </TableCell>
                            </TableRow>
                        )) : (
                            <TableRow>
                                <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                                    <Typography color="textSecondary">Nenhum colaborador encontrado.</Typography>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
}

export default UserManagerPage;