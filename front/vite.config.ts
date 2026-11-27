import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: { port: 3000, strictPort: true, proxy: { '/api/v1': { target: 'http://localhost:4000', changeOrigin: true } } },
  build: { rollupOptions: { output: { manualChunks(id) {
    if (id.includes('/node_modules/recharts/') || /\/node_modules\/(d3-[^/]+|victory-vendor)\//.test(id)) return 'charts';
    if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/') || id.includes('/node_modules/scheduler/')) return 'react-vendor';
    if (id.includes('/node_modules/lucide-react/')) return 'icons';
    return undefined;
  } } } },
});
