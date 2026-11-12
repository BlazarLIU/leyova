import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const port = Number(env.VITE_PORT || 5513)
  const apiTarget = env.VITE_API_TARGET || 'http://localhost:8788'
  const allowedHosts = (env.VITE_ALLOWED_HOSTS || '')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean)
  const resolvedAllowedHosts = allowedHosts.length ? allowedHosts : true
  const apiProxy = {
    '/api': {
      target: apiTarget,
      changeOrigin: true,
      rewrite: (path: string) => {
        // /api/v1/... → pass through (already correct)
        if (path.startsWith('/api/v1')) return path
        // /api/... → rewrite to /api/v1/...
        return '/api/v1' + path.slice(4)
      },
    },
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
    build: {
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return
            if (id.includes('/react-dom/') || id.includes('/react-router') || id.includes('/react/')) {
              return 'vendor-react'
            }
            if (id.includes('/recharts/') || id.includes('/d3-')) {
              return 'vendor-charts'
            }
            if (id.includes('/framer-motion/')) {
              return 'vendor-motion'
            }
            if (id.includes('/lucide-react/')) {
              return 'vendor-icons'
            }
            if (id.includes('/@tanstack/') || id.includes('/react-hook-form/') || id.includes('/zod/')) {
              return 'vendor-forms'
            }
          },
        },
      },
    },
    server: {
      port,
      strictPort: true,
      allowedHosts: resolvedAllowedHosts,
      proxy: apiProxy,
    },
    preview: {
      host: '0.0.0.0',
      port,
      strictPort: true,
      allowedHosts: resolvedAllowedHosts,
      proxy: apiProxy,
    },
  }
})
