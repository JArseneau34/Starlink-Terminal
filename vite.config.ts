import type { Connect, Plugin } from 'vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { documentIsolationHeaders } from './server/embed/orionFrame.ts'

/** Dev mounts at /mesh so Orion's same-origin proxy can iframe without colliding with Orion /api. */
function resolveViteBase(command: 'build' | 'serve'): string {
  const fromEnv = process.env.SAT_STATS_VITE_BASE
  if (fromEnv != null && fromEnv !== '') {
    return fromEnv.endsWith('/') ? fromEnv : `${fromEnv}/`
  }
  return command === 'serve' ? '/mesh/' : '/'
}

function applyIsolationHeaders(req: Connect.IncomingMessage, res: { setHeader: (k: string, v: string) => void; removeHeader: (k: string) => void }) {
  const headers = documentIsolationHeaders({
    url: req.url ?? '',
    headers: req.headers as { [key: string]: unknown },
  })
  res.removeHeader('Cross-Origin-Opener-Policy')
  res.removeHeader('Cross-Origin-Embedder-Policy')
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value)
  }
}

function isolationHeadersPlugin(): Plugin {
  const handle: Connect.NextHandleFunction = (req, res, next) => {
    applyIsolationHeaders(req, res)
    next()
  }
  return {
    name: 'orion-isolation-headers',
    configureServer(server) {
      server.middlewares.use(handle)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handle)
    },
  }
}

/** `/` → `/mesh/` so bookmarks to :5173 still open Orbital Ops. */
function meshBaseRedirectPlugin(base: string): Plugin {
  return {
    name: 'mesh-base-redirect',
    configureServer(server) {
      if (base !== '/mesh/') return
      server.middlewares.use((req, res, next) => {
        const raw = req.url ?? ''
        if (raw === '/' || raw.startsWith('/?')) {
          res.statusCode = 302
          res.setHeader('Location', `/mesh/${raw.startsWith('/?') ? raw.slice(1) : ''}`)
          res.end()
          return
        }
        next()
      })
    },
  }
}

const apiProxy = {
  '/api': {
    target: 'http://localhost:3002',
    changeOrigin: true,
    timeout: 60_000,
  },
  '/mesh/api': {
    target: 'http://localhost:3002',
    changeOrigin: true,
    timeout: 60_000,
    rewrite: (path: string) => path.replace(/^\/mesh/, ''),
  },
}

export default defineConfig(({ command }) => {
  const base = resolveViteBase(command)
  return {
    base,
    plugins: [
      meshBaseRedirectPlugin(base),
      isolationHeadersPlugin(),
      react(),
      tailwindcss(),
    ],
    server: {
      hmr: { clientPort: 5173 },
      proxy: apiProxy,
      watch: {
        ignored: [
          '**/.cache/**',
          '**/public/sat-stats/**',
          '**/public/orbital/walker-fit.json',
          '**/backups/**',
        ],
      },
    },
    preview: {
      proxy: apiProxy,
    },
  }
})
