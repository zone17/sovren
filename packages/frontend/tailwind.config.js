/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx,mdx}', './src/**/*.stories.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // 🎨 **CSS VARIABLE BASED COLORS** - Match index.css variables
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

        // ⚡ **LIGHTNING NETWORK** (Bitcoin Orange) - YouTube-inspired
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

        // 🔵 **SOVEREIGN** (NOSTR Purple) - Twitch-inspired
        sovereign: {
          50: '#f0f0ff',
          100: '#e7e7ff',
          200: '#d2d2ff',
          300: '#b8b8ff',
          400: '#9b9bff',
          500: '#6366f1', // Primary NOSTR purple
          600: '#5b5fd1', // Hover state
          700: '#5350c1', // Active state
          800: '#4338ca',
          900: '#3730a3',
        },

        // ⚫ **PREMIUM** (Elite Black) - OnlyFans/Patreon-inspired
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

        // 💰 **SATS** (Bitcoin Gold) - Substack-inspired
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

        // 🎯 **SEMANTIC COLORS** - Industry best practices
        success: {
          DEFAULT: '#1a7f37',
          foreground: '#ffffff',
        },
        warning: {
          DEFAULT: '#bf8700',
          foreground: '#ffffff',
        },
        info: {
          DEFAULT: '#0969da',
          foreground: '#ffffff',
        },
      },

      // 📱 **MOBILE-FIRST BREAKPOINTS** - Industry Leading (375px → 4K)
      screens: {
        xs: '375px', // iPhone SE, small phones
        sm: '640px', // Large phones, small tablets
        md: '768px', // iPads, tablets
        lg: '1024px', // Small laptops, iPad Pro
        xl: '1280px', // Laptops, desktops
        '2xl': '1536px', // Large desktops
        '3xl': '1920px', // 1080p displays
        '4xl': '2560px', // 1440p displays
        '5xl': '3840px', // 4K displays
      },

      // 🎨 **TYPOGRAPHY SYSTEM** - Creator Platform Optimized
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

      // 🎨 **BORDER RADIUS** - Modern, consistent system
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },

      // 🏗️ **SPACING SYSTEM** - YouTube/Patreon/Creator-optimized
      spacing: {
        18: '4.5rem', // 72px - Card spacing
        22: '5.5rem', // 88px - Section spacing
        26: '6.5rem', // 104px - Hero spacing
        88: '22rem', // 352px - Large section
        128: '32rem', // 512px - Container max-width
        144: '36rem', // 576px - Content max-width
      },

      // ✨ **PREMIUM SHADOW SYSTEM** - Industry-grade elevation
      boxShadow: {
        // Brand-specific shadows
        lightning: '0 4px 20px rgba(247, 147, 26, 0.15)',
        sovereign: '0 4px 20px rgba(99, 102, 241, 0.15)',
        premium: '0 4px 20px rgba(15, 23, 42, 0.15)',
        sats: '0 4px 20px rgba(247, 192, 42, 0.15)',

        // Elevation system (Material Design 3 inspired)
        xs: '0 1px 2px rgba(0, 0, 0, 0.04)',
        sm: '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
        DEFAULT: '0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06)',
        md: '0 4px 6px rgba(0, 0, 0, 0.05), 0 2px 4px rgba(0, 0, 0, 0.04)',
        lg: '0 10px 15px rgba(0, 0, 0, 0.08), 0 4px 6px rgba(0, 0, 0, 0.05)',
        xl: '0 20px 25px rgba(0, 0, 0, 0.10), 0 10px 10px rgba(0, 0, 0, 0.04)',
        '2xl': '0 25px 50px rgba(0, 0, 0, 0.15), 0 12px 24px rgba(0, 0, 0, 0.08)',

        // Creator platform specific
        card: '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)',
        'card-hover': '0 4px 6px rgba(0, 0, 0, 0.05), 0 2px 4px rgba(0, 0, 0, 0.04)',
        modal: '0 20px 25px rgba(0, 0, 0, 0.08), 0 10px 10px rgba(0, 0, 0, 0.04)',
        hero: '0 25px 50px rgba(0, 0, 0, 0.12), 0 12px 24px rgba(0, 0, 0, 0.08)',
      },

      // 🎭 **ANIMATION SYSTEM** - Smooth, professional micro-interactions
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'fade-in-up': 'fadeInUp 0.4s ease-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'bounce-subtle': 'bounceSubtle 0.6s ease-in-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        shimmer: 'shimmer 2s ease-in-out infinite',
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
      },

      // 🎨 **GRADIENT SYSTEM** - Modern, creator-focused
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        shimmer: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
