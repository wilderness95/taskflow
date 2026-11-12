import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// A fejlesztői szerver az /api kéréseket a backendre proxyzza (alapértelmezés: http://localhost:3001).
const apiTarget = process.env.API_URL ?? 'http://localhost:3001'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // ws: a hangasszisztens WebSocketje is megy a backendre.
    proxy: { '/api': { target: apiTarget, changeOrigin: true, ws: true } },
  },
})
