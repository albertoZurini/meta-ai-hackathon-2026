import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const BACKEND = process.env.BACKEND_URL ?? 'http://127.0.0.1:8000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    strictPort: true,
    host: true,
    allowedHosts: true,
    proxy: {
      '/api': { target: BACKEND, changeOrigin: true, ws: true },
    },
  },
})
