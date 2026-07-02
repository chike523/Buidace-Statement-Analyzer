import Papa from 'papaparse'
import type { ColumnMapping, ParseResult } from '@/types/transaction'
import { detectColumnMapping } from '@/lib/column-detect'
import { computeAmountFromRow, parseDate } from '@/lib/normalize'
import type { ParsedRow } from '@/types/transaction'

export type CsvWorkerRequest =
  | { type: 'parse'; fileContent: string; filename: string }
  | { type: 'convert'; fileContent: string; filename: string; mapping: ColumnMapping; accountId: string; batchId: string }

export type CsvWorkerResponse =
  | { type: 'parse_result'; result: ParseResult }
  | { type: 'convert_result'; rows: ParsedRow[]; skipped: number; errors: string[] }
  | { type: 'error'; message: string }

function parseCsvContent(content: string): { headers: string[]; rows: Record<string, string>[] } {
  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  })

  const headers = result.meta.fields ?? []
  const rows = result.data.filter((row) => Object.values(row).some((v) => v?.trim()))
  return { headers, rows }
}

function handleParse(content: string): ParseResult {
  const { headers, rows } = parseCsvContent(content)
  const suggested_mapping = detectColumnMapping(headers)

  return {
    headers,
    preview_rows: rows.slice(0, 20),
    suggested_mapping,
    total_rows: rows.length,
    errors: [],
  }
}

async function handleConvert(
  content: string,
  filename: string,
  mapping: ColumnMapping,
  _accountId: string,
  _batchId: string,
): Promise<{ rows: ParsedRow[]; skipped: number; errors: string[] }> {
  const { rows } = parseCsvContent(content)
  const parsed: ParsedRow[] = []
  let skipped = 0
  const errors: string[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const date = parseDate(row[mapping.date] ?? '')
    const description = (row[mapping.description] ?? '').trim()
    const amount = computeAmountFromRow(row, mapping)

    if (!date || !description || amount === null) {
      skipped++
      if (errors.length < 10) {
        errors.push(`Row ${i + 2}: missing or invalid date/description/amount`)
      }
      continue
    }

    const balance = mapping.balance ? Number.parseFloat((row[mapping.balance] ?? '').replace(/[,$]/g, '')) : undefined

    parsed.push({
      date,
      description,
      amount,
      balance: Number.isFinite(balance) ? balance : undefined,
      raw_source: `${filename}:row ${i + 2}`,
    })
  }

  return { rows: parsed, skipped, errors }
}

self.onmessage = async (event: MessageEvent<CsvWorkerRequest>) => {
  try {
    const msg = event.data
    if (msg.type === 'parse') {
      const result = handleParse(msg.fileContent)
      self.postMessage({ type: 'parse_result', result } satisfies CsvWorkerResponse)
    } else if (msg.type === 'convert') {
      const { rows, skipped, errors } = await handleConvert(
        msg.fileContent,
        msg.filename,
        msg.mapping,
        msg.accountId,
        msg.batchId,
      )
      self.postMessage({ type: 'convert_result', rows, skipped, errors } satisfies CsvWorkerResponse)
    }
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : 'Unknown CSV parse error',
    } satisfies CsvWorkerResponse)
  }
}
