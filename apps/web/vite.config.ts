import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const port = Number(env.VITE_PORT || 5174)
  const apiTarget = env.VITE_API_TARGET || 'http://localhost:8788'
  const allowedHosts = (env.VITE_ALLOWED_HOSTS || '')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean)

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
    server: {
      port,
      strictPort: true,
      allowedHosts: allowedHosts.length ? allowedHosts : true,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          rewrite: (path) => {
            // /api/v1/... → pass through (already correct)
            if (path.startsWith('/api/v1')) return path
            // /api/... → rewrite to /api/v1/...
            return '/api/v1' + path.slice(4)
          },
        },
      },
    },
  }
})
