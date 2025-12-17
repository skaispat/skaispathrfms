import colors from 'tailwindcss/colors';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Enforce the specific Red palette (#991B1B and #7F1D1D) across common color tokens
        // This ensures existing classes like 'text-indigo-600' or 'bg-blue-600' automatically adopt the new brand colors.

        primary: {
          DEFAULT: '#991B1B',
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#991B1B', // Primary user color
          700: '#7F1D1D', // Secondary/Darker user color
          800: '#7F1D1D', // Mapping darker shades to the requested dark red
          900: '#450a0a',
        },

        // Override 'indigo' effectively renaming it to our brand red
        indigo: {
          ...colors.red,
          500: '#ef4444',
          600: '#991B1B', // Main brand color
          700: '#7F1D1D', // Hover/Active state
          800: '#7F1D1D', // Darker state
          900: '#450a0a',
          DEFAULT: '#991B1B',
        },

        // Override 'blue' to also fallback to this palette to catch any stray blue buttons
        blue: {
          ...colors.red,
          500: '#ef4444',
          600: '#991B1B',
          700: '#7F1D1D',
          800: '#7F1D1D',
          DEFAULT: '#991B1B',
        },
      },
    },
  },
  plugins: [],
};