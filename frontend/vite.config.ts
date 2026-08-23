import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const robotsByEnvironment = {
  dev: `User-agent: *
Disallow: /
`,
  test: `User-agent: *
Disallow: /
`,
  prod: `User-agent: *
Allow: /
Disallow: /dashboard
Disallow: /analyze
Disallow: /reply
Disallow: /compare
Disallow: /profile
Disallow: /opportunities
Disallow: /gmail/
Disallow: /auth/

Sitemap: https://recruiterreply.com/sitemap.xml
`,
} as const

const robotsPlugin = {
  name: 'environment-robots',
  generateBundle() {
    const environment = process.env.DEPLOY_ENV === 'test' ? 'test' : process.env.DEPLOY_ENV === 'dev' ? 'dev' : 'prod'

    this.emitFile({
      type: 'asset',
      fileName: 'robots.txt',
      source: robotsByEnvironment[environment],
    })
  },
}

export default defineConfig({
  envDir: '../docs',
  plugins: [react(), robotsPlugin],
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
