import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { Transaction, TransferPair } from '@/types/transaction'
import { generateId } from '@/lib/utils'

const TRANSFER_KEYWORD_RE =
  /\btransfer\b|wallet\s+to\s+wallet|inter[\s-]?account|bank\s+transfer|own\s+account|self\s+transfer/i

const AMOUNT_TOLERANCE = 0.01
const DATE_TOLERANCE_DAYS = 1

function isTransferDescription(description: string): boolean {
  return TRANSFER_KEYWORD_RE.test(description)
}

function amountsMatch(a: number, b: number): boolean {
  return Math.abs(Math.abs(a) - Math.abs(b)) <= AMOUNT_TOLERANCE
}

function datesClose(dateA: string, dateB: string): boolean {
  return Math.abs(differenceInCalendarDays(parseISO(dateA), parseISO(dateB))) <= DATE_TOLERANCE_DAYS
}

function pairConfidence(
  debit: Transaction,
  credit: Transaction,
  crossAccount: boolean,
): TransferPair['confidence'] {
  const sameDay = debit.date === credit.date
  const hasKeyword =
    isTransferDescription(debit.description) || isTransferDescription(credit.description)

  if (crossAccount && sameDay && hasKeyword) return 'high'
  if (crossAccount && sameDay) return 'high'
  if (crossAccount && hasKeyword) return 'medium'
  if (!crossAccount && sameDay && hasKeyword) return 'medium'
  return 'low'
}

export function detectInternalTransfers(transactions: Transaction[]): TransferPair[] {
  const debits = transactions.filter((t) => t.amount < 0)
  const credits = transactions.filter((t) => t.amount > 0)
  const usedDebit = new Set<string>()
  const usedCredit = new Set<string>()
  const pairs: TransferPair[] = []

  for (const debit of debits) {
    if (usedDebit.has(debit.id)) continue

    let best: { credit: Transaction; score: number; confidence: TransferPair['confidence'] } | null =
      null

    for (const credit of credits) {
      if (usedCredit.has(credit.id)) continue
      if (!amountsMatch(debit.amount, credit.amount)) continue
      if (!datesClose(debit.date, credit.date)) continue

      const crossAccount = debit.account_id !== credit.account_id
      const sameDay = debit.date === credit.date
      const hasKeyword =
        isTransferDescription(debit.description) || isTransferDescription(credit.description)

      if (!crossAccount) {
        if (!sameDay || !hasKeyword) continue
      } else if (!sameDay && !hasKeyword) {
        continue
      }

      const confidence = pairConfidence(debit, credit, crossAccount)
      if (confidence === 'low') continue

      const score =
        (crossAccount ? 4 : 1) +
        (sameDay ? 2 : 0) +
        (hasKeyword ? 2 : 0) +
        (confidence === 'high' ? 1 : 0)

      if (!best || score > best.score) {
        best = { credit, score, confidence }
      }
    }

    if (best) {
      usedDebit.add(debit.id)
      usedCredit.add(best.credit.id)
      pairs.push({
        id: generateId(),
        debit_id: debit.id,
        credit_id: best.credit.id,
        amount: Math.abs(debit.amount),
        date: debit.date >= best.credit.date ? debit.date : best.credit.date,
        confidence: best.confidence,
      })
    }
  }

  return pairs.sort((a, b) => b.amount - a.amount || a.date.localeCompare(b.date))
}

export function getTransferTransactionIds(
  pairs: TransferPair[],
  rejectedPairIds: Set<string>,
): Set<string> {
  const ids = new Set<string>()
  for (const pair of pairs) {
    if (rejectedPairIds.has(pair.id)) continue
    ids.add(pair.debit_id)
    ids.add(pair.credit_id)
  }
  return ids
}
