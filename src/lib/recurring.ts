import { differenceInDays, parseISO } from 'date-fns'
import type { RecurringPattern, Transaction } from '@/types/transaction'
import { generateId } from '@/lib/utils'
import { normalizeMerchant } from '@/lib/normalize'

type MerchantGroup = {
  merchant: string
  account_id: string
  transactions: Transaction[]
}

function groupByMerchant(transactions: Transaction[]): MerchantGroup[] {
  const map = new Map<string, MerchantGroup>()

  for (const tx of transactions) {
    if (tx.amount >= 0) continue
    const merchant = normalizeMerchant(tx.description)
    const key = `${tx.account_id}:${merchant}`
    const group = map.get(key) ?? { merchant, account_id: tx.account_id, transactions: [] }
    group.transactions.push(tx)
    map.set(key, group)
  }

  return Array.from(map.values()).filter((g) => g.transactions.length >= 3)
}

function detectInterval(days: number[]): 'weekly' | 'monthly' | 'yearly' | null {
  if (days.length < 2) return null
  const avg = days.reduce((a, b) => a + b, 0) / days.length

  if (avg >= 5 && avg <= 10) return 'weekly'
  if (avg >= 25 && avg <= 35) return 'monthly'
  if (avg >= 350 && avg <= 380) return 'yearly'
  return null
}

function amountVariance(amounts: number[]): number {
  const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length
  const variance = amounts.reduce((sum, a) => sum + (a - avg) ** 2, 0) / amounts.length
  return Math.sqrt(variance)
}

export function detectRecurringPayments(transactions: Transaction[]): RecurringPattern[] {
  const patterns: RecurringPattern[] = []

  for (const group of groupByMerchant(transactions)) {
    const sorted = [...group.transactions].sort((a, b) => a.date.localeCompare(b.date))
    const amounts = sorted.map((t) => Math.abs(t.amount))
    const variance = amountVariance(amounts)
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length

    if (variance / avgAmount > 0.15) continue

    const gaps: number[] = []
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(Math.abs(differenceInDays(parseISO(sorted[i].date), parseISO(sorted[i - 1].date))))
    }

    const interval = detectInterval(gaps)
    if (!interval) continue

    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length
    const gapVariance = amountVariance(gaps)
    const confidence = Math.min(1, (sorted.length / 6) * (1 - gapVariance / avgGap))

    const lastDate = parseISO(sorted[sorted.length - 1].date)
    const nextExpected = new Date(lastDate)
    if (interval === 'weekly') nextExpected.setDate(nextExpected.getDate() + 7)
    if (interval === 'monthly') nextExpected.setMonth(nextExpected.getMonth() + 1)
    if (interval === 'yearly') nextExpected.setFullYear(nextExpected.getFullYear() + 1)

    patterns.push({
      id: generateId(),
      merchant: group.merchant,
      account_id: group.account_id,
      amount: -avgAmount,
      interval,
      transaction_ids: sorted.map((t) => t.id),
      next_expected: nextExpected.toISOString().slice(0, 10),
      confidence,
    })
  }

  return patterns.sort((a, b) => b.confidence - a.confidence)
}
