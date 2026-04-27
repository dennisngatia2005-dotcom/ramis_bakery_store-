import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: [
      'pediatric-alexander-ungrainable.ngrok-free.dev'
    ]
  }
})
// vite.config.js



