import typography from '@tailwindcss/typography'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },
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