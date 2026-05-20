import React, { createContext, useState, useMemo, useContext } from 'react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

const ColorModeContext = createContext({
    mode: 'light',
    toggleColorMode: () => {}
});

export const useColorMode = () => useContext(ColorModeContext);

export function ThemeContextProvider({ children }) {
    const [mode, setMode] = useState(() => {
        return localStorage.getItem('theme_mode') || 'light';
    });

    const colorMode = useMemo(() => ({
        mode,
        toggleColorMode: () => {
            setMode((prevMode) => {
                const nextMode = prevMode === 'light' ? 'dark' : 'light';
                localStorage.setItem('theme_mode', nextMode);
                return nextMode;
            });
        }
    }), [mode]);

    const theme = useMemo(() => createTheme({
        palette: {
            mode,
            primary: {
                main: '#1B5E20', // Green
                dark: '#0F3A13',
                light: '#2E7D32',
            },
            background: {
                default: mode === 'light' ? '#f4f6f8' : '#0a0f0d',
                paper: mode === 'light' ? '#ffffff' : '#111814',
            },
            text: {
                primary: mode === 'light' ? '#1e293b' : '#f8fafc',
                secondary: mode === 'light' ? '#64748b' : '#94a3b8',
            },
            divider: mode === 'light' ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.08)',
        },
        typography: {
            fontFamily: '"Open Sans", sans-serif',
        },
        components: {
            MuiPaper: {
                styleOverrides: {
                    root: {
                        transition: 'background-color 0.3s ease, color 0.3s ease, box-shadow 0.3s ease',
                    }
                }
            },
            MuiBox: {
                styleOverrides: {
                    root: {
                        transition: 'background-color 0.3s ease, color 0.3s ease',
                    }
                }
            }
        }
    }), [mode]);

    return (
        <ColorModeContext.Provider value={colorMode}>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                {children}
            </ThemeProvider>
        </ColorModeContext.Provider>
    );
}
