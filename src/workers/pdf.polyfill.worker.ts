/**
 * PDF.js worker entry with Safari polyfills applied first.
 * Mobile Safari (especially < 18) lacks Promise.withResolvers; without this
 * wrapper the legacy worker still throws "undefined is not a function".
 */
import { installPolyfills } from '@/lib/polyfills'

installPolyfills()

import 'pdfjs-dist/legacy/build/pdf.worker.min.mjs'
