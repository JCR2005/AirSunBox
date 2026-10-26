import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Por defecto el backend en :3000; con Docker (sin puerto publicado) se
    // apunta al nginx local: VITE_PROXY_TARGET=http://localhost npm run dev
    proxy: {
      '/api': process.env.VITE_PROXY_TARGET || 'http://localhost:3000',
      '/ws': { target: (process.env.VITE_PROXY_TARGET || 'http://localhost:3000').replace(/^http/, 'ws'), ws: true }
    }
  }
})
