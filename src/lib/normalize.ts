export function normalizeDescription(description: string): string {
  return description
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
}

export function normalizeMerchant(description: string): string {
  const normalized = normalizeDescription(description)
  const tokens = normalized.split(' ')
  const stopWords = new Set(['pos', 'debit', 'credit', 'purchase', 'payment', 'ach', 'transfer', 'card'])
  const filtered = tokens.filter((t) => t.length > 2 && !stopWords.has(t))
  return filtered.slice(0, 3).join(' ') || normalized.slice(0, 30)
}

export function parseAmount(value: string): number | null {
  if (!value || !value.trim()) return null
  const cleaned = value.replace(/[,$\s]/g, '').replace(/\(([^)]+)\)/, '-$1')
  const num = Number.parseFloat(cleaned)
  return Number.isFinite(num) ? num : null
}

export function parseDate(value: string): string | null {
  if (!value?.trim()) return null
  const trimmed = value.trim()

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`

  const usMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/)
  if (usMatch) {
    const year = usMatch[3].length === 2 ? `20${usMatch[3]}` : usMatch[3]
    const month = usMatch[1].padStart(2, '0')
    const day = usMatch[2].padStart(2, '0')
    return `${year}-${month}-${day}`
}

  const parsed = new Date(trimmed)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10)
  }

  return null
}

export function computeAmountFromRow(
  row: Record<string, string>,
  mapping: { amount?: string; debit?: string; credit?: string },
): number | null {
  if (mapping.amount && row[mapping.amount] !== undefined) {
    return parseAmount(row[mapping.amount])
  }

  const debit = mapping.debit ? parseAmount(row[mapping.debit] ?? '') : null
  const credit = mapping.credit ? parseAmount(row[mapping.credit] ?? '') : null

  if (debit !== null && debit !== 0) return -Math.abs(debit)
  if (credit !== null && credit !== 0) return Math.abs(credit)
  if (debit === 0 && credit !== null) return Math.abs(credit)
  if (credit === 0 && debit !== null) return -Math.abs(debit)

  return null
}

export function buildTransactionFingerprint(
  description: string,
  date: string,
  amount: number,
  accountId: string,
): string {
  return `${normalizeDescription(description)}|${date}|${Math.abs(amount).toFixed(2)}|${accountId}`
}

export async function hashString(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16)
}
