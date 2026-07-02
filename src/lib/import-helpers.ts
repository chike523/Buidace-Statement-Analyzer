export type ImportSummary = {
  filename: string
  account_name: string
  row_count: number
  skipped_count: number
  duplicate_count: number
  currency: string
}

export function suggestAccountName(filename: string): string {
  const base = filename
    .replace(/\.(pdf|csv|tsv)$/i, '')
    .replace(/[_-]/g, ' ')
    .replace(/\(\d+\)$/, '')
    .trim()

  if (/opay|owallet/i.test(base)) return 'OPay'
  if (/gtbank|guaranty/i.test(base)) return 'GTBank'
  if (/access/i.test(base)) return 'Access Bank'
  if (/kuda/i.test(base)) return 'Kuda'
  if (/moniepoint/i.test(base)) return 'Moniepoint'

  const words = base.split(/\s+/).filter(Boolean)
  if (words.length <= 3) return words.join(' ') || 'Main Account'
  return words.slice(0, 2).join(' ') || 'Main Account'
}

export function detectCurrencyFromText(text: string): string {
  if (/₦|NGN|naira/i.test(text)) return 'NGN'
  if (/€|EUR/i.test(text)) return 'EUR'
  if (/£|GBP/i.test(text)) return 'GBP'
  return 'USD'
}
