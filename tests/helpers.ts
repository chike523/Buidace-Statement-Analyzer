import type { Transaction } from '../src/types/transaction.ts'

let counter = 0

/** Build a Transaction with sensible defaults for tests. */
export function tx(partial: Partial<Transaction> = {}): Transaction {
  counter += 1
  return {
    id: partial.id ?? `t${counter}`,
    account_id: partial.account_id ?? 'acct-a',
    date: partial.date ?? '2024-01-01',
    description: partial.description ?? 'Test transaction',
    amount: partial.amount ?? -10,
    balance: partial.balance,
    currency: partial.currency ?? 'USD',
    raw_source: partial.raw_source ?? 'test',
    import_batch_id: partial.import_batch_id ?? 'batch-1',
  }
}
