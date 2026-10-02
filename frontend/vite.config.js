import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '127.0.0.1',      // ✅ Force IPv4 instead of IPv6
    strictPort: false,       // ✅ Allow fallback to next available port
    open: true,              // ✅ Auto-open browser
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',   // ✅ Use IPv4 for backend too
        changeOrigin: true,
        secure: false,
      },
      '/media': {
        target: 'http://127.0.0.1:8000',   // ✅ For media files
        changeOrigin: true,
        secure: false,
      },
      '/static': {
        target: 'http://127.0.0.1:8000',   // ✅ For static files
        changeOrigin: true,
        secure: false,
      },
    },
    hmr: {
      overlay: true,
      host: '127.0.0.1',    // ✅ Force HMR to use IPv4
    },
  },
  resolve: {
    extensions: ['.js', '.jsx', '.json'],
  },
  // ✅ Additional optimizations
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'axios'],
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})