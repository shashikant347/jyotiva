import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:4000',
      // Live chat: Socket.IO needs the WebSocket upgrade to pass through the dev proxy.
      '/socket.io': { target: 'http://localhost:4000', ws: true },
    },
  },
})
