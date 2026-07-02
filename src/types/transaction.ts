import { z } from 'zod'

export const TransactionSchema = z.object({
  id: z.string(),
  account_id: z.string(),
  date: z.string(),
  description: z.string(),
  amount: z.number(),
  balance: z.number().optional(),
  currency: z.string().optional(),
  raw_source: z.string(),
  import_batch_id: z.string(),
})

export type Transaction = z.infer<typeof TransactionSchema>

export type Account = {
  id: string
  name: string
  currency: string
}

export type ImportBatch = {
  id: string
  account_id: string
  filename: string
  imported_at: string
  row_count: number
  skipped_count: number
}

export type ColumnMapping = {
  date: string
  description: string
  amount?: string
  debit?: string
  credit?: string
  balance?: string
}

export type ParsedRow = {
  date: string
  description: string
  amount: number
  balance?: number
  raw_source: string
}

export type ParseResult = {
  headers: string[]
  preview_rows: Record<string, string>[]
  suggested_mapping: Partial<ColumnMapping>
  total_rows: number
  errors: string[]
}

export type DuplicateGroup = {
  id: string
  transaction_ids: string[]
  fingerprint: string
  status: 'pending' | 'keep_both' | 'ignored'
}

export type RecurringPattern = {
  id: string
  merchant: string
  account_id: string
  amount: number
  interval: 'weekly' | 'monthly' | 'yearly'
  transaction_ids: string[]
  next_expected?: string
  confidence: number
}

export type TransactionFilters = {
  account_id: string | 'all'
  date_from: string
  date_to: string
  amount_min: string
  amount_max: string
  type: 'all' | 'debit' | 'credit'
  search: string
}

export type DashboardStats = {
  total_income: number
  total_expenses: number
  net_flow: number
  transaction_count: number
}

export type MonthlyFlow = {
  month: string
  income: number
  expenses: number
  net: number
}

export type TopMerchant = {
  merchant: string
  total: number
  count: number
  variants?: number
  search_hint?: string
}

export type MerchantGroupingMode = 'exact' | 'smart'

export type DashboardPreferences = {
  exclude_transfers: boolean
  merchant_mode: MerchantGroupingMode
}

export type TransferPair = {
  id: string
  debit_id: string
  credit_id: string
  amount: number
  date: string
  confidence: 'high' | 'medium' | 'low'
}

export type PayeeSearchResult = {
  name: string
  count: number
  total_amount: number
}

export type AccountBreakdown = {
  account_id: string
  account_name: string
  income: number
  expenses: number
  net: number
}
