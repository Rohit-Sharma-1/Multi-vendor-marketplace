/** @type {import('tailwindcss').Config} */
export default { darkMode: 'class', content: ['./index.html', './src/**/*.{ts,tsx}'], theme: { extend: { fontFamily: { sans: ['DM Sans', 'sans-serif'], display: ['Manrope', 'sans-serif'] }, colors: { ink: '#17211d', leaf: '#335f4b', lime: '#d9ed8b', canvas: '#f7f7f4' }, boxShadow: { soft: '0 12px 35px rgba(20,34,27,.07)' } } }, plugins: [] };
