/** Regal Admin Panel — Tailwind config mapped 1:1 to the §2 design tokens.
 *  Colours resolve through CSS variables so dark mode is a variable swap. */

/** @param {string} v */
const rgb = (v) => `rgb(var(--${v}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    // §2.5 Breakpoints
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        brand: {
          50: rgb('brand-50'),
          100: rgb('brand-100'),
          300: rgb('brand-300'),
          500: rgb('brand-500'),
          600: rgb('brand-600'),
          700: rgb('brand-700'),
          900: rgb('brand-900'),
          DEFAULT: rgb('brand-500'),
        },
        secondary: { 500: rgb('secondary-500'), DEFAULT: rgb('secondary-500') },
        accent: { 500: rgb('accent-500'), DEFAULT: rgb('accent-500') },
        neutral: {
          0: rgb('neutral-0'),
          50: rgb('neutral-50'),
          100: rgb('neutral-100'),
          200: rgb('neutral-200'),
          300: rgb('neutral-300'),
          400: rgb('neutral-400'),
          500: rgb('neutral-500'),
          700: rgb('neutral-700'),
          900: rgb('neutral-900'),
        },
        ink: rgb('ink'),
        success: { 50: rgb('success-50'), 500: rgb('success-500'), DEFAULT: rgb('success-500') },
        warning: { 50: rgb('warning-50'), 500: rgb('warning-500'), DEFAULT: rgb('warning-500') },
        danger: { 50: rgb('danger-50'), 500: rgb('danger-500'), DEFAULT: rgb('danger-500') },
        info: { 50: rgb('info-50'), 500: rgb('info-500'), DEFAULT: rgb('info-500') },
        chart: {
          1: rgb('chart-1'),
          2: rgb('chart-2'),
          3: rgb('chart-3'),
          4: rgb('chart-4'),
          5: rgb('chart-5'),
          6: rgb('chart-6'),
          7: rgb('chart-7'),
        },
      },
      // §2.4 Spacing scale — 4/8/12/16/24/32/48/64. Nothing off-scale.
      spacing: {
        1: '4px',
        2: '8px',
        3: '12px',
        4: '16px',
        6: '24px',
        8: '32px',
        12: '48px',
        16: '64px',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        full: '9999px',
      },
      boxShadow: {
        e1: '0 1px 3px rgba(16,24,40,0.08)',
        e2: '0 8px 24px rgba(16,24,40,0.12)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      // §2.3 Typography roles
      fontSize: {
        'page-title': ['24px', { lineHeight: '32px', fontWeight: '600' }],
        'section-heading': ['18px', { lineHeight: '28px', fontWeight: '600' }],
        'card-title': ['14px', { lineHeight: '20px', fontWeight: '600' }],
        'kpi-value': ['30px', { lineHeight: '36px', fontWeight: '700' }],
        'kpi-label': ['13px', { lineHeight: '18px', fontWeight: '500' }],
        body: ['14px', { lineHeight: '20px' }],
        'table-header': ['12px', { lineHeight: '16px', fontWeight: '600', letterSpacing: '0.03em' }],
        caption: ['12px', { lineHeight: '16px' }],
        mono: ['13px', { lineHeight: '20px' }],
      },
      // §2.6 Motion
      transitionTimingFunction: { standard: 'cubic-bezier(0.2, 0, 0, 1)' },
      transitionDuration: { micro: '150ms', panel: '200ms', modal: '250ms' },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        'slide-up': {
          from: { transform: 'translateY(12px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 150ms cubic-bezier(0.2,0,0,1)',
        'slide-in-right': 'slide-in-right 200ms cubic-bezier(0.2,0,0,1)',
        'slide-up': 'slide-up 200ms cubic-bezier(0.2,0,0,1)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
