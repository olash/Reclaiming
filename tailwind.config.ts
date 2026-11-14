import type { Config } from 'tailwindcss';

const c = (v: string) => `hsl(var(--${v}) / <alpha-value>)`;

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: { DEFAULT: '1.25rem', sm: '1.5rem', lg: '2.5rem' }, screens: { '2xl': '1240px' } },
    extend: {
      colors: {
        background: c('background'),
        surface: c('surface'),
        ink: c('ink'),
        muted: { DEFAULT: c('muted'), foreground: c('muted-foreground') },
        border: c('border'),
        input: c('input'),
        ring: c('ring'),
        primary: { DEFAULT: c('primary'), hover: c('primary-hover'), soft: c('primary-soft'), foreground: c('primary-foreground') },
        accent: { DEFAULT: c('accent'), soft: c('accent-soft') },
        success: { DEFAULT: c('success'), soft: c('success-soft') },
        warning: { DEFAULT: c('warning'), soft: c('warning-soft') },
        danger: { DEFAULT: c('danger'), soft: c('danger-soft') },
        info: { DEFAULT: c('info'), soft: c('info-soft') },
        // Brand names, for expressive moments
        cotton: c('cotton'),
        paper: c('paper'),
        indigo: { DEFAULT: c('indigo'), night: c('indigo-night') },
        saffron: c('saffron'),
        clay: c('clay'),
        leaf: c('leaf'),
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display-xl': ['clamp(3rem, 8.5vw, 6.75rem)', { lineHeight: '0.92', letterSpacing: '-0.045em' }],
        'display-lg': ['clamp(2.5rem, 6vw, 4.5rem)', { lineHeight: '0.98', letterSpacing: '-0.04em' }],
        'display-md': ['clamp(2rem, 4vw, 3rem)', { lineHeight: '1.04', letterSpacing: '-0.035em' }],
      },
      borderRadius: { xl: '1.75rem', lg: '1.25rem', md: '0.875rem', sm: '0.5rem' },
      boxShadow: {
        card: '0 1px 0 hsl(232 44% 16% / 0.04), 0 10px 30px -18px hsl(232 44% 16% / 0.22)',
        pop: '0 18px 50px -16px hsl(232 44% 16% / 0.35)',
        stamp: '0 3px 0 0 hsl(232 44% 16%)',
        'stamp-sm': '0 2px 0 0 hsl(232 44% 16%)',
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
        'fade-up': { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        draw: { from: { strokeDashoffset: '1' }, to: { strokeDashoffset: '0' } },
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        'float-slow': { '0%,100%': { transform: 'translateY(0) rotate(var(--r,0deg))' }, '50%': { transform: 'translateY(-6px) rotate(var(--r,0deg))' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-up': 'fade-up 0.45s cubic-bezier(.2,.7,.2,1) both',
        draw: 'draw 0.9s cubic-bezier(.6,0,.2,1) 0.3s both',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
