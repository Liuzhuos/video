/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        runway: {
          black: '#000000',
          deep: '#030303',
          surface: '#1a1a1a',
          border: '#27272a',
          charcoal: '#404040',
          slate: '#767d88',
          'mid-slate': '#7d848e',
          muted: '#a7a7a7',
          silver: '#c9ccd1',
          'light-silver': '#d0d4d4',
          cloud: '#e9ecf2',
          white: '#ffffff',
          'near-white': '#fefefe',
        },
      },
      borderRadius: {
        sharp: '4px',
        subtle: '6px',
        comfortable: '8px',
        generous: '16px',
      },
      letterSpacing: {
        display: '-1.2px',
        heading: '-1px',
        subheading: '-0.9px',
        body: '-0.16px',
        label: '0.35px',
      },
    },
  },
  plugins: [],
};
