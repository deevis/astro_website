import typography from '@tailwindcss/typography'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          950: '#0a0a0f',
          900: '#111827',
          800: '#1f2937',
          700: '#374151',
        },
        primary: {
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
        },
        gray: {
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
        }
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: '65ch',
            fontSize: '0.875rem',
            lineHeight: '1.5',
            h1: {
              fontSize: '1.5rem',
              marginTop: '1.5rem',
              marginBottom: '1rem',
              lineHeight: '1.2',
            },
            h2: {
              fontSize: '1.25rem',
              marginTop: '1.5rem',
              marginBottom: '0.75rem',
              lineHeight: '1.2',
            },
            h3: {
              fontSize: '1.125rem',
              marginTop: '1.5rem',
              marginBottom: '0.75rem',
            },
            h4: {
              fontSize: '1rem',
              marginTop: '1.5rem',
              marginBottom: '0.75rem',
            },
            p: {
              fontSize: '0.875rem',
              marginTop: '0.75rem',
              marginBottom: '0.75rem',
            },
            li: {
              fontSize: '0.875rem',
              marginTop: '0.375rem',
              marginBottom: '0.375rem',
            },
            'code::before': {
              content: '""'
            },
            'code::after': {
              content: '""'
            },
            'blockquote p:first-of-type::before': {
              content: '""'
            },
            'blockquote p:last-of-type::after': {
              content: '""'
            },
          }
        }
      }
    },
  },
  plugins: [
    typography({
      className: 'prose',
      dark: true,
    })
  ],
}