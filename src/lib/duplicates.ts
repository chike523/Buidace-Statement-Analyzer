import type { DuplicateGroup, Transaction } from '@/types/transaction'
import { buildTransactionFingerprint, normalizeDescription } from '@/lib/normalize'

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = []
  for (let i = 0; i <= b.length; i++) matrix[i] = [i]
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] =
        b[i - 1] === a[j - 1]
          ? matrix[i - 1][j - 1]
          : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
    }
  }
  return matrix[b.length][a.length]
}

export function detectDuplicates(
  transactions: Transaction[],
  fuzzyThreshold = 0.85,
): DuplicateGroup[] {
  const exactMap = new Map<string, Transaction[]>()

  for (const tx of transactions) {
    const fp = buildTransactionFingerprint(tx.description, tx.date, tx.amount, tx.account_id)
    const existing = exactMap.get(fp) ?? []
    existing.push(tx)
    exactMap.set(fp, existing)
  }

  const groups: DuplicateGroup[] = []
  let groupIndex = 0

  for (const [fingerprint, txs] of exactMap) {
    if (txs.length > 1) {
      groups.push({
        id: `dup-exact-${groupIndex++}`,
        transaction_ids: txs.map((t) => t.id),
        fingerprint,
        status: 'pending',
      })
    }
  }

  const usedIds = new Set(groups.flatMap((g) => g.transaction_ids))
  const remaining = transactions.filter((t) => !usedIds.has(t.id))

  // Fuzzy matches require the same account + date + amount, so only compare
  // within account/date buckets instead of every pair (O(n^2) -> O(sum k^2)).
  // Iterating bucket-mates in their original order preserves exact output.
  const bucketIndices = new Map<string, number[]>()
  remaining.forEach((t, idx) => {
    const key = `${t.account_id}|${t.date}`
    const arr = bucketIndices.get(key)
    if (arr) arr.push(idx)
    else bucketIndices.set(key, [idx])
  })

  for (let i = 0; i < remaining.length; i++) {
    const a = remaining[i]
    const fuzzyMatches: Transaction[] = [a]
    const mates = bucketIndices.get(`${a.account_id}|${a.date}`) ?? []

    for (const j of mates) {
      if (j <= i) continue
      const b = remaining[j]
      if (Math.abs(Math.abs(a.amount) - Math.abs(b.amount)) > 0.01) continue

      const descA = normalizeDescription(a.description)
      const descB = normalizeDescription(b.description)
      const maxLen = Math.max(descA.length, descB.length)
      if (maxLen === 0) continue

      const similarity = 1 - levenshtein(descA, descB) / maxLen
      if (similarity >= fuzzyThreshold) {
        fuzzyMatches.push(b)
        usedIds.add(b.id)
      }
    }

    if (fuzzyMatches.length > 1) {
      usedIds.add(a.id)
      groups.push({
        id: `dup-fuzzy-${groupIndex++}`,
        transaction_ids: fuzzyMatches.map((t) => t.id),
        fingerprint: `fuzzy:${a.date}:${Math.abs(a.amount)}`,
        status: 'pending',
      })
    }
  }

  return groups
}

export function countPendingDuplicates(groups: DuplicateGroup[]): number {
  return groups.filter((g) => g.status === 'pending').length
}
