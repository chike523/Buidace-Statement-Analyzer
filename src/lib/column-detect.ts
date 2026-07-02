import type { ColumnMapping } from '@/types/transaction'

const DATE_PATTERNS = [/date/i, /posted/i, /transaction.?date/i, /value.?date/i, /time/i]
const DESC_PATTERNS = [/description/i, /memo/i, /narration/i, /details/i, /payee/i, /merchant/i, /name/i]
const AMOUNT_PATTERNS = [/amount/i, /value/i, /sum/i]
const DEBIT_PATTERNS = [/debit/i, /withdrawal/i, /out/i, /spent/i, /payment/i]
const CREDIT_PATTERNS = [/credit/i, /deposit/i, /in/i, /received/i]
const BALANCE_PATTERNS = [/balance/i, /running/i, /available/i]

function findColumn(headers: string[], patterns: RegExp[]): string | undefined {
  return headers.find((h) => patterns.some((p) => p.test(h)))
}

export function detectColumnMapping(headers: string[]): Partial<ColumnMapping> {
  const normalized = headers.map((h) => h.trim())

  const mapping: Partial<ColumnMapping> = {
    date: findColumn(normalized, DATE_PATTERNS),
    description: findColumn(normalized, DESC_PATTERNS),
    amount: findColumn(normalized, AMOUNT_PATTERNS),
    debit: findColumn(normalized, DEBIT_PATTERNS),
    credit: findColumn(normalized, CREDIT_PATTERNS),
    balance: findColumn(normalized, BALANCE_PATTERNS),
  }

  if (mapping.debit && mapping.credit) {
    delete mapping.amount
  }

  return mapping
}

export function isMappingComplete(mapping: Partial<ColumnMapping>): boolean {
  if (!mapping.date || !mapping.description) return false
  if (mapping.amount) return true
  return Boolean(mapping.debit || mapping.credit)
}

export function getMappingConfidence(mapping: Partial<ColumnMapping>): number {
  let score = 0
  if (mapping.date) score += 30
  if (mapping.description) score += 30
  if (mapping.amount) score += 25
  if (mapping.debit || mapping.credit) score += 15
  if (mapping.balance) score += 5
  return Math.min(100, score)
}
