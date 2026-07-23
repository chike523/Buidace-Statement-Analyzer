import type { ColumnMapping, ParseResult } from '@/types/transaction'
import type { CsvWorkerRequest, CsvWorkerResponse } from '@/workers/csv-parser.worker'
import { rowsToTransactions } from '@/lib/parsers/shared'
import type { Transaction } from '@/types/transaction'

let csvWorker: Worker | null = null

function getCsvWorker(): Worker {
  if (!csvWorker) {
    csvWorker = new Worker(new URL('@/workers/csv-parser.worker.ts', import.meta.url), {
      type: 'module',
    })
  }
  return csvWorker
}

export function parseCsvFile(content: string, filename: string): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const worker = getCsvWorker()
    const handler = (event: MessageEvent<CsvWorkerResponse>) => {
      worker.removeEventListener('message', handler)
      const data = event.data
      if (data.type === 'parse_result') resolve(data.result)
      else if (data.type === 'error') reject(new Error(data.message))
    }
    worker.addEventListener('message', handler)
    worker.postMessage({ type: 'parse', fileContent: content, filename } satisfies CsvWorkerRequest)
  })
}

export async function convertCsvToTransactions(
  content: string,
  filename: string,
  mapping: ColumnMapping,
  accountId: string,
  batchId: string,
  currency = 'USD',
): Promise<{ transactions: Transaction[]; skipped: number; errors: string[] }> {
  return new Promise((resolve, reject) => {
    const worker = getCsvWorker()
    const handler = async (event: MessageEvent<CsvWorkerResponse>) => {
      worker.removeEventListener('message', handler)
      const data = event.data
      if (data.type === 'convert_result') {
        const transactions = await rowsToTransactions(data.rows, accountId, batchId, currency)
        resolve({ transactions, skipped: data.skipped, errors: data.errors })
      } else if (data.type === 'error') {
        reject(new Error(data.message))
      }
    }
    worker.addEventListener('message', handler)
    worker.postMessage({
      type: 'convert',
      fileContent: content,
      filename,
      mapping,
      accountId,
      batchId,
    } satisfies CsvWorkerRequest)
  })
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsArrayBuffer(file)
  })
}

export type ImportFileType = 'csv' | 'pdf' | 'excel' | 'ofx'

export function detectFileType(file: File): ImportFileType {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'csv' || ext === 'tsv' || file.type === 'text/csv') return 'csv'
  if (ext === 'xlsx' || ext === 'xls') return 'excel'
  if (ext === 'ofx' || ext === 'qfx') return 'ofx'
  return 'pdf'
}
