import type { ParsedRow, Transaction } from '@/types/transaction'
import { hashString } from '@/lib/normalize'

export async function rowsToTransactions(
  rows: ParsedRow[],
  accountId: string,
  batchId: string,
  currency = 'USD',
): Promise<Transaction[]> {
  const transactions: Transaction[] = []
  for (const row of rows) {
    const fp = `${row.date}|${row.description}|${row.amount}|${accountId}|${row.raw_source}`
    const id = await hashString(fp)
    transactions.push({
      id,
      account_id: accountId,
      date: row.date,
      description: row.description,
      amount: row.amount,
      balance: row.balance,
      currency,
      raw_source: row.raw_source,
      import_batch_id: batchId,
    })
  }
  return transactions
}
