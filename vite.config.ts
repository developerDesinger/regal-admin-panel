import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const tunnel = env.VITE_API_TUNNEL;

  return {
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // Proxy the API so the browser makes a SAME-ORIGIN request. The session
    // cookie is SameSite=Strict (§01) and would never be sent cross-site to the
    // tunnel origin; proxying also sidesteps CORS preflights entirely.
    proxy: tunnel
      ? {
          '/api': {
            target: tunnel,
            changeOrigin: true,
            secure: true,
            // Dev tunnels serve an interstitial to unknown clients unless this
            // header is present; it is a no-op against a plain backend.
            headers: { 'X-Tunnel-Skip-AntiPhishing-Page': 'true' },
            configure(proxy) {
              proxy.on('error', (err, req) => {
                console.error(`[api-proxy] ${req.method} ${req.url} → ${err.message}`);
              });
              proxy.on('proxyRes', (res, req) => {
                if ((res.statusCode ?? 0) >= 500) {
                  console.warn(
                    `[api-proxy] ${req.method} ${req.url} → ${res.statusCode} ` +
                      `(is the backend listening behind ${tunnel}?)`,
                  );
                }
              });
            },
          },
        }
      : undefined,
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
  };
});
