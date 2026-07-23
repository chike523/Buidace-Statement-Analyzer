const MONTH = 'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec'
const DATE = `\\d{2}\\s+(?:${MONTH})\\s+\\d{4}`
const AMOUNT = `[\\d,]+\\.\\d{2}|--`

// Matches a common tabular statement row:
// <posted datetime> <value date> <description> <debit> <credit> <balance>
const TABULAR_ROW_RE = new RegExp(
  `(?:${DATE}\\s+\\d{2}:\\d{2}:\\d{2})\\s+(${DATE})\\s+(.+?)\\s+(${AMOUNT})\\s+(${AMOUNT})\\s+(${AMOUNT})`,
  'gi',
)

function parseMonthDate(value: string): string | null {
  const parsed = new Date(value.replace(/\s+/g, ' '))
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

function parseAmountToken(token: string): number | null {
  if (!token || token === '--') return null
  const num = Number.parseFloat(token.replace(/,/g, ''))
  return Number.isFinite(num) ? num : null
}

export function parseTabularText(text: string): { date: string; description: string; amount: number }[] {
  const rows: { date: string; description: string; amount: number }[] = []
  const normalized = text.replace(/\s+/g, ' ')

  for (const match of normalized.matchAll(TABULAR_ROW_RE)) {
    const date = parseMonthDate(match[1])
    const description = match[2].trim()
    const debit = parseAmountToken(match[3])
    const credit = parseAmountToken(match[4])

    if (!date || description.length < 2) continue

    let amount: number | null = null
    if (credit !== null && credit > 0) amount = credit
    else if (debit !== null && debit > 0) amount = -debit
    if (amount === null) continue

    rows.push({ date, description, amount })
  }

  return rows
}

export function parseGenericText(text: string): { date: string; description: string; amount: number }[] {
  const tabular = parseTabularText(text)
  if (tabular.length > 0) return tabular

  const rows: { date: string; description: string; amount: number }[] = []
  for (const line of text.split('\n')) {
    const dateMatch = line.match(new RegExp(`(${DATE})`, 'i'))
    if (!dateMatch) continue
    const date = parseMonthDate(dateMatch[1])
    const amounts = line.match(/[\d,]+\.\d{2}/g)
    if (!date || !amounts?.length) continue
    const amount = Number.parseFloat(amounts[amounts.length - 1].replace(/,/g, ''))
    rows.push({
      date,
      description: line.replace(dateMatch[0], '').replace(/[\d,]+\.\d{2}/g, '').trim(),
      amount,
    })
  }
  return rows
}
