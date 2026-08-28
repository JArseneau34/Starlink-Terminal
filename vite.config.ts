import type { Connect, Plugin } from 'vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import {
  parseYoutubeFrameQuery,
  youtubeFrameHtml,
} from './server/embed/youtubeFrame.ts'
import { resolveYoutubeChannelLive } from './server/embed/youtubeLiveResolve.ts'
import { fetchYoutubeThumb, isYoutubeVideoId } from './server/embed/youtubeThumb.ts'
import { documentIsolationHeaders } from './server/embed/orionFrame.ts'

/** Dev mounts at /mesh so Orion's same-origin proxy can iframe without colliding with Orion /api. */
function resolveViteBase(command: 'build' | 'serve'): string {
  const fromEnv = process.env.SAT_STATS_VITE_BASE
  if (fromEnv != null && fromEnv !== '') {
    return fromEnv.endsWith('/') ? fromEnv : `${fromEnv}/`
  }
  return command === 'serve' ? '/mesh/' : '/'
}

function stripMeshPrefix(raw: string): string {
  if (raw.startsWith('/mesh/')) return raw.slice(5)
  if (raw === '/mesh') return '/'
  if (raw.startsWith('/mesh?')) return `/${raw.slice(5)}`
  return raw
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

/**
 * YouTube embed helpers for Cam loop (mirrors Express /embed/youtube*).
 * Primary player path uses iframe credentialless against www.youtube.com;
 * these routes cover live resolve, thumbnails, and the no-credentialless shell.
 */
function youtubeEmbedFramePlugin(): Plugin {
  const handle: Connect.NextHandleFunction = (req, res, next) => {
    const raw = stripMeshPrefix(req.url ?? '')
    if (raw.startsWith('/embed/youtube/live')) {
      void (async () => {
        try {
          const url = new URL(raw, 'http://vite.local')
          const channel = url.searchParams.get('channel')?.trim() ?? ''
          if (!channel) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ error: 'channel required' }))
            return
          }
          const result = await resolveYoutubeChannelLive(channel)
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.setHeader('Cache-Control', 'public, max-age=30')
          res.removeHeader('Cross-Origin-Embedder-Policy')
          res.removeHeader('Cross-Origin-Opener-Policy')
          res.end(JSON.stringify(result))
        } catch (err) {
          res.statusCode = 502
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(
            JSON.stringify({
              error: 'resolve_failed',
              message: err instanceof Error ? err.message : String(err),
            })
          )
        }
      })()
      return
    }
    if (raw.startsWith('/embed/youtube/thumb')) {
      void (async () => {
        try {
          const url = new URL(raw, 'http://vite.local')
          const v = url.searchParams.get('v')?.trim() ?? ''
          if (!isYoutubeVideoId(v)) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'text/plain; charset=utf-8')
            res.end('Invalid video id')
            return
          }
          const img = await fetchYoutubeThumb(v)
          if (!img) {
            res.statusCode = 404
            res.setHeader('Content-Type', 'text/plain; charset=utf-8')
            res.end('Thumbnail unavailable')
            return
          }
          res.statusCode = 200
          res.setHeader('Content-Type', img.contentType)
          res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
          res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
          res.end(img.body)
        } catch {
          res.statusCode = 502
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
          res.end('Thumbnail proxy failed')
        }
      })()
      return
    }
    if (!raw.startsWith('/embed/youtube')) {
      next()
      return
    }
    let url: URL
    try {
      url = new URL(raw, 'http://vite.local')
    } catch {
      res.statusCode = 400
      res.end('Bad request')
      return
    }
    const params = parseYoutubeFrameQuery(Object.fromEntries(url.searchParams))
    if (!params) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end('Invalid YouTube embed params')
      return
    }
    res.statusCode = 200
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=300')
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
    res.removeHeader('Cross-Origin-Embedder-Policy')
    res.removeHeader('Cross-Origin-Opener-Policy')
    res.end(youtubeFrameHtml(params))
  }

  return {
    name: 'youtube-embed-frame',
    configureServer(server) {
      server.middlewares.use(handle)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handle)
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
      youtubeEmbedFramePlugin(),
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
