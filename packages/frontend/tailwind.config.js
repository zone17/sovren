/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx,mdx}', './src/**/*.stories.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Sora', 'Inter', 'system-ui', 'sans-serif'],
      },

      // CSS variable-based semantic colors (shadcn-compatible)
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },

        // Sovereign purple scale - Sovren's identity color, centered on #8B5CF6
        sovereign: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8B5CF6', // Primary - Sovren owns this purple
          600: '#7c3aed', // Hover state
          700: '#6d28d9', // Active state
          800: '#5b21b6',
          900: '#4c1d95',
          950: '#2e1065',
        },

        // Lightning Network - Bitcoin orange, bolt accents
        lightning: {
          50: '#fffef7',
          100: '#fffceb',
          200: '#fff8d1',
          300: '#fff1a6',
          400: '#ffe670',
          500: '#f7931a', // Primary bitcoin orange
          600: '#e8851a', // Hover state
          700: '#d97919', // Active state
          800: '#a85f14',
          900: '#7d4a10',
        },

        // Premium dark slate - elevation system
        premium: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },

        // Sats gold - Bitcoin value display
        sats: {
          50: '#fffdf2',
          100: '#fffae0',
          200: '#fff4c7',
          300: '#ffe89f',
          400: '#ffd760',
          500: '#f7c02a',
          600: '#e2a013',
          700: '#bc7f0f',
          800: '#986412',
          900: '#7a5111',
        },

        // Semantic tokens
        success: {
          DEFAULT: '#22c55e',
          foreground: '#ffffff',
        },
        warning: {
          DEFAULT: '#f59e0b',
          foreground: '#ffffff',
        },
        info: {
          DEFAULT: '#38bdf8',
          foreground: '#ffffff',
        },
      },

      // Mobile-first breakpoints (375px to 4K)
      screens: {
        xs: '375px',
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1536px',
        '3xl': '1920px',
        '4xl': '2560px',
        '5xl': '3840px',
      },

      // Typography system - creator platform optimized
      fontSize: {
        xs: ['11px', { lineHeight: '1.3', letterSpacing: '-0.008em' }],
        sm: ['13px', { lineHeight: '1.4', letterSpacing: '-0.006em' }],
        base: ['15px', { lineHeight: '1.5', letterSpacing: '-0.004em' }],
        lg: ['17px', { lineHeight: '1.5', letterSpacing: '-0.004em' }],
        xl: ['20px', { lineHeight: '1.4', letterSpacing: '-0.008em' }],
        '2xl': ['24px', { lineHeight: '1.3', letterSpacing: '-0.012em' }],
        '3xl': ['30px', { lineHeight: '1.2', letterSpacing: '-0.016em' }],
        '4xl': ['36px', { lineHeight: '1.1', letterSpacing: '-0.020em' }],
        '5xl': ['48px', { lineHeight: '1.0', letterSpacing: '-0.025em' }],
        '6xl': ['64px', { lineHeight: '1.0', letterSpacing: '-0.025em' }],
        '7xl': ['80px', { lineHeight: '0.95', letterSpacing: '-0.030em' }],
        '8xl': ['112px', { lineHeight: '0.9', letterSpacing: '-0.035em' }],
      },

      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },

      spacing: {
        18: '4.5rem',
        22: '5.5rem',
        26: '6.5rem',
        88: '22rem',
        128: '32rem',
        144: '36rem',
      },

      boxShadow: {
        // Glass morphism inner highlight
        glass: 'inset 0 1px 1px 0 rgba(255,255,255,0.05)',

        // Brand-specific glows
        lightning: '0 4px 20px rgba(247, 147, 26, 0.20)',
        sovereign: '0 4px 20px rgba(139, 92, 246, 0.25)',
        premium: '0 4px 20px rgba(15, 23, 42, 0.20)',
        sats: '0 4px 20px rgba(247, 192, 42, 0.20)',

        // Purple glow for primary actions
        'sovereign-lg': '0 8px 40px rgba(139, 92, 246, 0.35)',

        // Elevation system
        xs: '0 1px 2px rgba(0, 0, 0, 0.12)',
        sm: '0 1px 3px rgba(0, 0, 0, 0.16), 0 1px 2px rgba(0, 0, 0, 0.10)',
        DEFAULT: '0 1px 3px rgba(0, 0, 0, 0.20), 0 1px 2px rgba(0, 0, 0, 0.12)',
        md: '0 4px 6px rgba(0, 0, 0, 0.16), 0 2px 4px rgba(0, 0, 0, 0.10)',
        lg: '0 10px 15px rgba(0, 0, 0, 0.20), 0 4px 6px rgba(0, 0, 0, 0.12)',
        xl: '0 20px 25px rgba(0, 0, 0, 0.25), 0 10px 10px rgba(0, 0, 0, 0.10)',
        '2xl': '0 25px 50px rgba(0, 0, 0, 0.35), 0 12px 24px rgba(0, 0, 0, 0.16)',

        // Creator platform surfaces
        card: '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.08)',
        'card-hover': '0 8px 16px rgba(0, 0, 0, 0.20), 0 2px 4px rgba(0, 0, 0, 0.10)',
        modal: '0 20px 25px rgba(0, 0, 0, 0.40), 0 10px 10px rgba(0, 0, 0, 0.20)',
        hero: '0 25px 50px rgba(0, 0, 0, 0.30), 0 12px 24px rgba(0, 0, 0, 0.16)',
      },

      // Snappy 150ms micro-interactions for in-app feel
      transitionDuration: {
        DEFAULT: '150ms',
      },

      animation: {
        'fade-in': 'fadeIn 0.15s ease-out',
        'fade-in-up': 'fadeInUp 0.2s ease-out',
        'slide-in': 'slideIn 0.15s ease-out',
        'slide-up': 'slideUp 0.15s ease-out',
        'scale-in': 'scaleIn 0.15s ease-out',
        'bounce-subtle': 'bounceSubtle 0.6s ease-in-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        shimmer: 'shimmer 2s ease-in-out infinite',
        'reveal-up': 'revealUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both',
        float: 'float 6s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 3s ease-in-out infinite',
        'gradient-shift': 'gradientShift 8s ease infinite',
      },

      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        bounceSubtle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-2px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        revealUp: {
          '0%': { opacity: '0', transform: 'translateY(32px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },

      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        shimmer: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
