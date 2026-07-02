import '@/lib/polyfills'
import type { ParsedRow } from '@/types/transaction'
import { parseGenericText } from '@/lib/parsers/opay'
import { rowsToTransactions } from '@/lib/parsers/shared'

export type PdfParseOutput = {
  rows: ParsedRow[]
  page_count: number
  has_text_layer: boolean
  raw_text_preview: string
}

export async function parsePdfBuffer(
  buffer: ArrayBuffer,
  filename: string,
  onProgress?: (page: number, total: number) => void,
): Promise<PdfParseOutput> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const workerUrl = (await import('pdfjs-dist/legacy/build/pdf.worker.mjs?url')).default
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
  } as Parameters<typeof pdfjsLib.getDocument>[0] & { disableWorker?: boolean }).promise

  const pageTexts: string[] = []
  let totalTextLength = 0

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    onProgress?.(pageNum, pdf.numPages)
    const page = await pdf.getPage(pageNum)
    const content = await page.getTextContent()
    const pageText = content.items.map((item) => ('str' in item ? item.str : '')).join(' ')
    pageTexts.push(pageText)
    totalTextLength += pageText.length

    if (pageNum % 5 === 0) {
      await new Promise((r) => setTimeout(r, 0))
    }
  }

  const fullText = pageTexts.join(' ')
  const parsed = parseGenericText(fullText)

  return {
    rows: parsed.map((r, i) => ({
      ...r,
      raw_source: `${filename}:line ${i + 1}`,
    })),
    page_count: pdf.numPages,
    has_text_layer: totalTextLength > 50,
    raw_text_preview: fullText.slice(0, 2000),
  }
}

export async function parseOcrText(text: string, filename: string): Promise<PdfParseOutput> {
  const parsed = parseGenericText(text)
  return {
    rows: parsed.map((r, i) => ({
      ...r,
      raw_source: `${filename}:ocr-line ${i + 1}`,
    })),
    page_count: 1,
    has_text_layer: true,
    raw_text_preview: text.slice(0, 2000),
  }
}

export async function pdfRowsToTransactions(
  rows: ParsedRow[],
  accountId: string,
  batchId: string,
  currency = 'USD',
): Promise<import('@/types/transaction').Transaction[]> {
  return rowsToTransactions(rows, accountId, batchId, currency)
}

export async function runOcrOnPdf(
  buffer: ArrayBuffer,
  onProgress: (page: number, total: number) => void,
): Promise<string> {
  const { renderPdfPagesToImages } = await import('@/lib/parsers/pdf-render')
  const images = await renderPdfPagesToImages(buffer)
  const total = images.length

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('@/workers/ocr.worker.ts', import.meta.url), { type: 'module' })

    worker.onmessage = (event: MessageEvent<import('@/workers/ocr.worker').OcrWorkerResponse>) => {
      const data = event.data
      if (data.type === 'progress') {
        onProgress(data.pageIndex + 1, total)
      } else if (data.type === 'complete') {
        worker.terminate()
        resolve(data.text)
      } else if (data.type === 'error') {
        worker.terminate()
        reject(new Error(data.message))
      }
    }

    worker.postMessage({
      type: 'ocr_pages',
      pages: images.map((imageData, pageIndex) => ({ pageIndex, imageData })),
    })
  })
}
