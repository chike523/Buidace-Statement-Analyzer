/**
 * Structured merchant grouping — conservative rules only.
 * Never fuzzy-match person names; P2P transfers use the full counterparty segment.
 */

const TRANSFER_RE = /^transfer\s+(from|to)\s+(.+)$/i
const FEE_PATTERNS = [
  /^electronic money transfer levy$/i,
  /^stamp duty$/i,
  /^sms charge$/i,
  /^account maintenance/i,
  /^vat on /i,
  /^nip fee$/i,
  /^coralpay /i,
]
const POS_RE = /^(pos|purchase at|payment to|pay to)\s+/i

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function normalizePersonName(name: string): string {
  return collapseWhitespace(name.replace(/,/g, ' ')).toUpperCase()
}

function normalizeBrand(description: string): string {
  let text = description.trim()
  text = text.replace(POS_RE, '')
  text = text.replace(/\s+(lagos|abuja|ikeja|lekki|port harcourt|ph)\s*$/i, '')
  text = text.replace(/\s+\d{4,}$/, '')
  return collapseWhitespace(text).toLowerCase()
}

function isFeeDescription(description: string): boolean {
  const trimmed = description.trim()
  return FEE_PATTERNS.some((re) => re.test(trimmed))
}

/** Stable grouping key — identical keys are rolled up together in smart mode. */
export function smartMerchantKey(description: string): string {
  const trimmed = description.trim()
  if (!trimmed) return ''

  const transferMatch = trimmed.match(TRANSFER_RE)
  if (transferMatch) {
    const counterparty = transferMatch[2].split('|')[0].trim()
    return `transfer:${transferMatch[1].toLowerCase()}:${normalizePersonName(counterparty)}`
  }

  if (isFeeDescription(trimmed)) {
    return `fee:${trimmed.toLowerCase()}`
  }

  if (POS_RE.test(trimmed)) {
    return `merchant:${normalizeBrand(trimmed)}`
  }

  return `exact:${trimmed.toLowerCase()}`
}

/** Human-readable label for a grouped merchant row. */
export function smartMerchantLabel(description: string): string {
  const trimmed = description.trim()
  if (!trimmed) return trimmed

  const transferMatch = trimmed.match(TRANSFER_RE)
  if (transferMatch) {
    const counterparty = transferMatch[2].split('|')[0].trim()
    return `Transfer ${transferMatch[1].toLowerCase()} ${counterparty}`
  }

  if (isFeeDescription(trimmed)) {
    return trimmed
  }

  if (POS_RE.test(trimmed)) {
    const brand = normalizeBrand(trimmed)
    return brand.charAt(0).toUpperCase() + brand.slice(1)
  }

  return trimmed
}

export type MerchantAggregateInput = {
  description: string
  amount: number
}

export type AggregatedMerchant = {
  merchant: string
  total: number
  count: number
  variants: number
  search_hint: string
}

export function aggregateMerchants(
  rows: MerchantAggregateInput[],
  mode: 'exact' | 'smart',
  direction: 'debit' | 'credit',
  limit = 10,
): AggregatedMerchant[] {
  const map = new Map<
    string,
    { label: string; total: number; count: number; descriptions: Set<string>; searchHint: string }
  >()

  for (const row of rows) {
    const isDebit = row.amount < 0
    const isCredit = row.amount > 0
    if (direction === 'debit' && !isDebit) continue
    if (direction === 'credit' && !isCredit) continue

    const key = mode === 'smart' ? smartMerchantKey(row.description) : row.description
    const label = mode === 'smart' ? smartMerchantLabel(row.description) : row.description
    const absAmount = Math.abs(row.amount)

    const existing = map.get(key)
    if (existing) {
      existing.total += absAmount
      existing.count += 1
      existing.descriptions.add(row.description)
      if (row.description.length < existing.searchHint.length) {
        existing.searchHint = row.description
      }
    } else {
      map.set(key, {
        label,
        total: absAmount,
        count: 1,
        descriptions: new Set([row.description]),
        searchHint: row.description,
      })
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
    .map((entry) => ({
      merchant: entry.label,
      total: entry.total,
      count: entry.count,
      variants: entry.descriptions.size,
      search_hint: entry.searchHint,
    }))
}
