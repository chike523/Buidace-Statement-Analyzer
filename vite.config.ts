import path from 'path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Content-Security-Policy for the production build. Injected only at build time
 * so it doesn't interfere with Vite's dev server (HMR/React refresh rely on
 * inline scripts and a websocket connection).
 *
 * - script-src omits 'unsafe-inline'/'unsafe-eval' so injected inline scripts
 *   can't run; 'wasm-unsafe-eval' still permits WebAssembly (DuckDB, Tesseract).
 * - cdn.jsdelivr.net is required by tesseract.js, which fetches its worker,
 *   WASM core and language data from that CDN at runtime.
 * - blob: covers Web Workers created from blob URLs (Tesseract).
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval' blob: https://cdn.jsdelivr.net",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self' data: blob: https://cdn.jsdelivr.net",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

function cspPlugin(): Plugin {
  return {
    name: 'inject-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '</title>',
        `</title>\n    <meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />`,
      )
    },
  }
}

export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react(), tailwindcss(), cspPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    // Keep DuckDB and pdf.js out of Vite's prebundle so their WASM/worker and
    // legacy Safari polyfills are not rewritten incorrectly.
    exclude: ['@duckdb/duckdb-wasm', 'pdfjs-dist'],
  },
})
