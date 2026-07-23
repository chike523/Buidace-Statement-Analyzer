import { installPolyfills } from '@/lib/polyfills'

type PdfJsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs')

let pdfjsPromise: Promise<PdfJsModule> | null = null

/**
 * Load pdf.js in a Safari-safe way.
 *
 * Mobile Safari often fails when creating a module Worker for pdf.js (missing
 * Promise.withResolvers inside the worker, or broken worker bootstrap). pdf.js
 * supports a main-thread "fake worker" when `globalThis.pdfjsWorker` already
 * exposes `WorkerMessageHandler` — we preload the legacy worker module there so
 * getDocument never needs `new Worker(...)`.
 */
export function loadPdfJs(): Promise<PdfJsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      installPolyfills()

      const [pdfjsLib, pdfWorker] = await Promise.all([
        import('pdfjs-dist/legacy/build/pdf.mjs'),
        // Side effect: sets globalThis.pdfjsWorker so pdf.js uses a main-thread
        // fake worker (required on mobile Safari).
        import('pdfjs-dist/legacy/build/pdf.worker.mjs'),
      ])

      const g = globalThis as typeof globalThis & {
        pdfjsWorker?: { WorkerMessageHandler?: unknown }
      }
      // Prefer the module namespace if the side-effect global was stripped by the bundler.
      g.pdfjsWorker = g.pdfjsWorker ?? pdfWorker

      const workerUrl = (await import('pdfjs-dist/legacy/build/pdf.worker.mjs?url')).default
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

      return pdfjsLib
    })()
  }
  return pdfjsPromise
}
