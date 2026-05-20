import React, { useState } from 'react';
import { Box, List, ListItem, ListItemIcon, ListItemText, Typography, Divider, Drawer, AppBar, Toolbar, IconButton, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { 
    Dashboard as DashIcon, 
    People as PeopleIcon, 
    Assignment as SurveyIcon, 
    AutoAwesome as IAIcon,
    ExitToApp as LogoutIcon,
    Menu as MenuIcon,
    Brightness4 as Brightness4Icon,
    Brightness7 as Brightness7Icon
} from '@mui/icons-material';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useColorMode } from '../context/ThemeContext';
import logo from '../img/logo-sem-fundo.png';

const drawerWidth = 280;

function AdminLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const theme = useTheme();
    const { mode, toggleColorMode } = useColorMode();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'lg'));
    const [mobileOpen, setMobileOpen] = useState(false);

    const handleDrawerToggle = () => {
        setMobileOpen(!mobileOpen);
    };

    const handleLogout = () => {
        localStorage.clear();
        navigate('/');
    };

    const menuItems = [
        { text: 'Dashboard', icon: <DashIcon />, path: '/dashboard' },
        { text: 'Questionários', icon: <SurveyIcon />, path: '/questionarios' },
        { text: 'Insights IA', icon: <IAIcon />, path: '/insights' },
        { text: 'Usuários', icon: <PeopleIcon />, path: '/usuarios' },
    ];

    const isSelected = (path) => {
        if (location.pathname === '/' && path === '/dashboard') return true;
        if (location.pathname === path) return true;
        if (location.pathname.startsWith(path) && path !== '/') return true;
        return false;
    };

    const drawerContent = (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'background.paper', color: 'text.primary' }}>
            <Box sx={{ p: 4, textAlign: 'center' }}>
                <img src={logo} alt="Vida Mais" style={{ width: '160px' }} />
                <Typography variant="caption" sx={{ display: 'block', color: 'primary.main', fontWeight: 'bold', mt: 1 }}>PORTAL ADMIN</Typography>
            </Box>

            <List sx={{ px: 2, flexGrow: 1 }}>
                <Typography variant="overline" sx={{ px: 2, color: 'text.secondary', fontWeight: 'bold' }}>MENU PRINCIPAL</Typography>
                {menuItems.map((item) => (
                    <ListItem 
                        button 
                        key={item.text} 
                        onClick={() => {
                            navigate(item.path);
                            if (isMobile || isTablet) setMobileOpen(false);
                        }}
                        selected={isSelected(item.path)}
                        sx={{ 
                            borderRadius: 2, 
                            mb: 1,
                            transition: 'all 0.2s',
                            '&.Mui-selected': {
                                bgcolor: '#0e3a14 !important', // Verde bem escuro e forte
                                color: '#fff', 
                                boxShadow: '0 8px 16px rgba(14,58,20,0.2)',
                                '& .MuiListItemIcon-root': { color: '#fff' },
                                '&:hover': { bgcolor: '#0a2a0e !important' }
                            },
                            '&:hover': {
                                bgcolor: mode === 'light' ? 'rgba(27, 94, 32, 0.08)' : 'rgba(255, 255, 255, 0.08)'
                            }
                        }}
                    >
                        <ListItemIcon sx={{ color: isSelected(item.path) ? '#fff' : 'primary.main' }}>{item.icon}</ListItemIcon>
                        <ListItemText primary={item.text} />
                    </ListItem>
                ))}
            </List>

            <Divider />
            <List sx={{ px: 2, py: 1 }}>
                <ListItem 
                    button 
                    onClick={toggleColorMode} 
                    sx={{ 
                        borderRadius: 2, 
                        mb: 1,
                        color: 'text.primary',
                        '&:hover': {
                            bgcolor: mode === 'light' ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.08)'
                        }
                    }}
                >
                    <ListItemIcon sx={{ color: 'primary.main' }}>
                        {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
                    </ListItemIcon>
                    <ListItemText 
                        primary={mode === 'dark' ? "MODO CLARO" : "MODO ESCURO"} 
                        primaryTypographyProps={{ fontWeight: 'bold' }} 
                    />
                </ListItem>
                <ListItem button onClick={handleLogout} sx={{ color: '#d32f2f', borderRadius: 2 }}>
                    <ListItemIcon><LogoutIcon sx={{ color: '#d32f2f' }} /></ListItemIcon>
                    <ListItemText primary="SAIR DO SISTEMA" primaryTypographyProps={{ fontWeight: 'bold' }} />
                </ListItem>
            </List>
        </Box>
    );

    return (
        <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default', color: 'text.primary' }}>
            {(isMobile || isTablet) && (
                <AppBar position="fixed" sx={{ zIndex: theme.zIndex.drawer + 1, bgcolor: 'background.paper', color: 'text.primary', borderBottom: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
                    <Toolbar>
                        <IconButton
                            color="inherit"
                            aria-label="open drawer"
                            edge="start"
                            onClick={handleDrawerToggle}
                            sx={{ mr: 2 }}
                        >
                            <MenuIcon />
                        </IconButton>
                        <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            <img src={logo} alt="Vida Mais" style={{ height: '35px', marginTop: '4px' }} />
                        </Box>
                        <IconButton onClick={toggleColorMode} color="inherit">
                            {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
                        </IconButton>
                    </Toolbar>
                </AppBar>
            )}

            <Box
                component="nav"
                sx={{ width: { lg: drawerWidth }, flexShrink: { lg: 0 } }}
            >
                <Drawer
                    variant={(isMobile || isTablet) ? "temporary" : "permanent"}
                    open={(isMobile || isTablet) ? mobileOpen : true}
                    onClose={handleDrawerToggle}
                    ModalProps={{
                        keepMounted: true, 
                    }}
                    sx={{
                        '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
                    }}
                >
                    {drawerContent}
                </Drawer>
            </Box>

            <Box 
                component="main" 
                sx={{ 
                    flexGrow: 1, 
                    p: { xs: 2, sm: 3, lg: 4 }, 
                    pt: { xs: 10, sm: 11, lg: 4 }, 
                    width: { lg: `calc(100% - ${drawerWidth}px)` },
                    overflowY: 'auto',
                    height: '100vh',
                    boxSizing: 'border-box',
                    bgcolor: 'background.default'
                }}
            >
                <Outlet />
            </Box>
        </Box>
    );
}

export default AdminLayout;