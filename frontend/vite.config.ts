import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// robots.txt is written at promotion time (see .github/workflows/promote.yml)
// since it now differs by deployed environment, not by build. public/robots.txt
// ships a safe "disallow all" default for any build that skips promotion.

export default defineConfig({
  envDir: '../docs',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5002',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api')
      }
    }
  }
})
