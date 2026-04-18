export const brand = {
    primary: '#1B5E20',
    primaryDark: '#0F3A13',
    primaryLight: '#2E7D32',
    secondary: '#455A64',
    secondarySoft: '#607D8B',
    accent: '#2E7D32',
    info: '#607D8B',
    success: '#2E7D32',
    warning: '#7A8F3B',
    danger: '#C62828',
    ink: '#243238',
    inkSoft: '#5F6F77',
    line: 'rgba(69, 90, 100, 0.14)',
    surface: 'rgba(255, 255, 255, 0.76)',
    surfaceStrong: '#ffffff',
    background: '#F8F9FA',
    backgroundDeep: '#EEF2F1',
    nav: '#15252D'
};

export const gradients = {
    hero: 'linear-gradient(135deg, #0F3A13 0%, #1B5E20 38%, #2E7D32 68%, #455A64 100%)',
    panel: 'linear-gradient(135deg, rgba(27, 94, 32, 0.12) 0%, rgba(69, 90, 100, 0.1) 100%)',
    warm: 'linear-gradient(135deg, #2E7D32 0%, #4B6A51 100%)',
    cool: 'linear-gradient(135deg, #455A64 0%, #607D8B 100%)',
    mint: 'linear-gradient(135deg, #1B5E20 0%, #2E7D32 100%)',
    violet: 'linear-gradient(135deg, #455A64 0%, #2E7D32 100%)',
    metallic: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(236,240,239,0.74) 42%, rgba(215,223,220,0.86) 100%)'
};

export const shadows = {
    soft: '0 24px 54px rgba(27, 45, 34, 0.08)',
    medium: '0 26px 65px rgba(27, 45, 34, 0.14)',
    glow: '0 18px 60px rgba(27, 94, 32, 0.22)',
    edge: 'inset 0 1px 0 rgba(255,255,255,0.7)'
};

export const glassPanel = {
    background: 'linear-gradient(180deg, rgba(255,255,255,0.86) 0%, rgba(255,255,255,0.72) 100%)',
    backdropFilter: 'blur(22px)',
    border: `1px solid ${brand.line}`,
    boxShadow: `${shadows.soft}, ${shadows.edge}`
};

export const pageShell = {
    position: 'relative',
    overflow: 'hidden',
    minHeight: '100%',
    '&::before': {
        content: '""',
        position: 'absolute',
        inset: '-18% auto auto -12%',
        width: 320,
        height: 320,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(46, 125, 50, 0.18) 0%, rgba(46, 125, 50, 0) 72%)',
        pointerEvents: 'none'
    },
    '&::after': {
        content: '""',
        position: 'absolute',
        inset: 'auto -10% -16% auto',
        width: 360,
        height: 360,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(69, 90, 100, 0.18) 0%, rgba(69, 90, 100, 0) 72%)',
        pointerEvents: 'none'
    }
};

export const fadeUp = (delay = 0) => ({
    animation: `fadeUp 720ms ${delay}ms cubic-bezier(0.22, 1, 0.36, 1) both`
});

export const premiumBorder = `linear-gradient(135deg, rgba(255,255,255,0.7), rgba(69,90,100,0.14), rgba(46,125,50,0.18))`;
