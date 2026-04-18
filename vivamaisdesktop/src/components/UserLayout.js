import React, { useState } from 'react';
import { Box, List, ListItem, ListItemIcon, ListItemText, Typography, Divider, Drawer, AppBar, Toolbar, IconButton, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { 
    Assignment as SurveyIcon, 
    ExitToApp as LogoutIcon,
    Menu as MenuIcon,
    Person as PersonIcon
} from '@mui/icons-material';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import logo from '../img/logo-sem-fundo.png';

const drawerWidth = 280;

function UserLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const [mobileOpen, setMobileOpen] = useState(false);

    const userStr = localStorage.getItem('user_data');
    const user = userStr ? JSON.parse(userStr) : { full_name: 'Usuário', role: 'user' };

    const handleDrawerToggle = () => {
        setMobileOpen(!mobileOpen);
    };

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
    };

    const menuItems = [
        { text: 'Minhas Pesquisas', icon: <SurveyIcon />, path: '/user-dashboard' },
    ];

    const isSelected = (path) => {
        return location.pathname === path;
    };

    const drawerContent = (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#fff' }}>
            <Box sx={{ p: 4, textAlign: 'center' }}>
                <img src={logo} alt="Vida Mais" style={{ width: '150px' }} />
                <Typography variant="caption" sx={{ display: 'block', color: '#1b5e20', fontWeight: 'bold', mt: 1 }}>PORTAL DO COLABORADOR</Typography>
            </Box>

            <Divider sx={{ mb: 2 }} />

            <Box sx={{ px: 3, mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ bgcolor: '#e8f5e9', p: 1, borderRadius: '50%', display: 'flex' }}>
                    <PersonIcon sx={{ color: '#1b5e20' }} />
                </Box>
                <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#333', lineHeight: 1.2 }}>
                        {user.full_name.split(' ')[0]}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#666' }}>ID: #{user.id?.substring(0, 5)}</Typography>
                </Box>
            </Box>

            <List sx={{ px: 2, flexGrow: 1 }}>
                <Typography variant="overline" sx={{ px: 2, color: '#999', fontWeight: 'bold' }}>MENU</Typography>
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
                    <ListItemText primary="SAIR" primaryTypographyProps={{ fontWeight: 'bold' }} />
                </ListItem>
            </List>
        </Box>
    );

    return (
        <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f4f6f8' }}>
            <AppBar position="fixed" sx={{ 
                zIndex: theme.zIndex.drawer + 1, 
                bgcolor: '#fff', 
                color: '#333',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                display: { md: 'none' } 
            }}>
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
                    <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center' }}>
                        <img src={logo} alt="Vida Mais" style={{ height: '35px' }} />
                    </Box>
                    <Box sx={{ width: 48 }} /> 
                </Toolbar>
            </AppBar>

            <Box
                component="nav"
                sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
            >
                <Drawer
                    variant={isMobile ? "temporary" : "permanent"}
                    open={isMobile ? mobileOpen : true}
                    onClose={handleDrawerToggle}
                    ModalProps={{ keepMounted: true }}
                    sx={{
                        '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth, borderRight: 'none', boxShadow: '2px 0 10px rgba(0,0,0,0.05)' },
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
                    pt: { xs: 10, md: 4 }, 
                    width: { md: `calc(100% - ${drawerWidth}px)` },
                    minHeight: '100vh',
                    boxSizing: 'border-box'
                }}
            >
                <Outlet />
            </Box>
        </Box>
    );
}

export default UserLayout;
