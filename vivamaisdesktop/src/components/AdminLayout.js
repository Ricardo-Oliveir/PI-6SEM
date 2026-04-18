import React, { useState } from 'react';
import { Box, List, ListItem, ListItemIcon, ListItemText, Typography, Divider, Drawer, AppBar, Toolbar, IconButton, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { 
    Dashboard as DashIcon, 
    People as PeopleIcon, 
    Assignment as SurveyIcon, 
    AutoAwesome as IAIcon,
    ExitToApp as LogoutIcon,
    Menu as MenuIcon
} from '@mui/icons-material';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import logo from '../img/logo-sem-fundo.png';

const drawerWidth = 280;

function AdminLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
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
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#fff' }}>
            <Box sx={{ p: 4, textAlign: 'center' }}>
                <img src={logo} alt="Vida Mais" style={{ width: '160px' }} />
                <Typography variant="caption" sx={{ display: 'block', color: '#1b5e20', fontWeight: 'bold', mt: 1 }}>PORTAL ADMIN</Typography>
            </Box>

            <List sx={{ px: 2, flexGrow: 1 }}>
                <Typography variant="overline" sx={{ px: 2, color: '#999', fontWeight: 'bold' }}>MENU PRINCIPAL</Typography>
                {menuItems.map((item) => (
                    <ListItem 
                        button 
                        key={item.text} 
                        onClick={() => {
                            navigate(item.path);
                            if (isMobile) setMobileOpen(false);
                        }}
                        selected={isSelected(item.path)}
                        sx={{ 
                            borderRadius: 2, mb: 1,
                            ...(isSelected(item.path) && {
                                bgcolor: '#1b5e20', 
                                color: '#fff', 
                                '& .MuiListItemIcon-root': { color: '#fff' },
                                '&:hover': { bgcolor: '#144616' }
                            })
                        }}
                    >
                        <ListItemIcon sx={{ color: isSelected(item.path) ? '#fff' : '#1b5e20' }}>{item.icon}</ListItemIcon>
                        <ListItemText primary={item.text} />
                    </ListItem>
                ))}
            </List>

            <Divider />
            <List sx={{ px: 2, py: 2 }}>
                <ListItem button onClick={handleLogout} sx={{ color: '#d32f2f', borderRadius: 2 }}>
                    <ListItemIcon><LogoutIcon sx={{ color: '#d32f2f' }} /></ListItemIcon>
                    <ListItemText primary="SAIR DO SISTEMA" primaryTypographyProps={{ fontWeight: 'bold' }} />
                </ListItem>
            </List>
        </Box>
    );

    return (
        <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f4f6f8' }}>
            {isMobile && (
                <AppBar position="fixed" sx={{ zIndex: theme.zIndex.drawer + 1, bgcolor: '#fff', color: '#333' }}>
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
                        {/* Placeholder box for spacing right to center image */}
                        <Box sx={{ width: 48 }} /> 
                    </Toolbar>
                </AppBar>
            )}

            <Box
                component="nav"
                sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
            >
                <Drawer
                    variant={isMobile ? "temporary" : "permanent"}
                    open={isMobile ? mobileOpen : true}
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
                    p: { xs: 2, sm: 3, md: 4 }, 
                    pt: { xs: 12, md: 4 }, 
                    width: { md: `calc(100% - ${drawerWidth}px)` },
                    overflowY: 'auto',
                    height: '100vh',
                    boxSizing: 'border-box'
                }}
            >
                <Outlet />
            </Box>
        </Box>
    );
}

export default AdminLayout;