import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Keep the dashboard's first paint small — the charting library and the
    // Radix primitives are the two heavy chunks and neither blocks LCP (§21).
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('recharts') || id.includes('d3-')) return 'charts';
          if (id.includes('@radix-ui')) return 'radix';
          if (id.includes('react-router')) return 'router';
          if (id.includes('react-dom') || id.includes('/react/')) return 'react';
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
});
