import {
  getAccountBreakdown,
  getAllTransactions,
  getDashboardStats,
  getMonthlyFlow,
  getTopMerchants,
  getTopMerchantsByCredit,
} from '@/db/duckdb'
import type {
  Account,
  DashboardPreferences,
  DuplicateGroup,
  ImportBatch,
  RecurringPattern,
  Transaction,
  TransactionFilters,
  TransferPair,
} from '@/types/transaction'
import { countPendingDuplicates } from '@/lib/duplicates'
import { formatCurrency, formatDate } from '@/lib/utils'

export type ReportInput = {
  accounts: Account[]
  importBatches: ImportBatch[]
  filters: TransactionFilters
  ignoredIds: string[]
  dashboardPrefs: DashboardPreferences
  transferPairs: TransferPair[]
  transferIds: string[]
  rejectedTransferPairIds: Set<string>
  duplicateGroups: DuplicateGroup[]
  recurringPatterns: RecurringPattern[]
}

export type ReportData = Awaited<ReturnType<typeof gatherReportData>>

export async function gatherReportData(input: ReportInput) {
  const { filters, ignoredIds, dashboardPrefs, transferIds } = input
  const excludeTransferIds = dashboardPrefs.exclude_transfers ? transferIds : []
  const merchantOptions = {
    excludeTransactionIds: excludeTransferIds,
    merchantMode: dashboardPrefs.merchant_mode,
  }

  const allTransactions = await getAllTransactions()
  const visible = allTransactions.filter((t) => !ignoredIds.includes(t.id))

  const [stats, grossStats, monthly, expensePayees, incomePayees, breakdown] = await Promise.all([
    getDashboardStats(filters, ignoredIds, excludeTransferIds),
    dashboardPrefs.exclude_transfers && transferIds.length > 0
      ? getDashboardStats(filters, ignoredIds, [])
      : Promise.resolve(null),
    getMonthlyFlow(filters, ignoredIds, excludeTransferIds),
    getTopMerchants(filters, ignoredIds, 15, merchantOptions),
    getTopMerchantsByCredit(filters, ignoredIds, 15, merchantOptions),
    getAccountBreakdown(filters, ignoredIds, excludeTransferIds),
  ])

  const filtered = applyReportFilters(visible, filters, excludeTransferIds)
  const dates = filtered.map((t) => t.date).sort()
  const currency = input.accounts[0]?.currency ?? filtered[0]?.currency ?? 'NGN'

  const largestDebits = [...filtered]
    .filter((t) => t.amount < 0)
    .sort((a, b) => a.amount - b.amount)
    .slice(0, 10)

  const largestCredits = [...filtered]
    .filter((t) => t.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10)

  const activeTransferPairs = input.transferPairs.filter(
    (p) => !input.rejectedTransferPairIds.has(p.id),
  )

  return {
    generatedAt: new Date().toISOString(),
    currency,
    period: {
      from: dates[0] ?? '',
      to: dates[dates.length - 1] ?? '',
    },
    filters,
    dashboardPrefs,
    accounts: input.accounts,
    importBatches: input.importBatches,
    stats,
    grossStats,
    monthly,
    expensePayees,
    incomePayees,
    breakdown,
    largestDebits,
    largestCredits,
    recurringPatterns: input.recurringPatterns,
    duplicateGroups: input.duplicateGroups,
    pendingDuplicates: countPendingDuplicates(input.duplicateGroups),
    transferPairs: input.transferPairs,
    activeTransferPairs,
    excludedTransferCount: excludeTransferIds.length,
    transactionCount: filtered.length,
    totalInDatabase: visible.length,
  }
}

function applyReportFilters(
  transactions: Transaction[],
  filters: TransactionFilters,
  excludeIds: string[],
): Transaction[] {
  const excludeSet = new Set(excludeIds)

  return transactions.filter((t) => {
    if (excludeSet.has(t.id)) return false
    if (filters.account_id !== 'all' && t.account_id !== filters.account_id) return false
    if (filters.date_from && t.date < filters.date_from) return false
    if (filters.date_to && t.date > filters.date_to) return false
    if (filters.amount_min && t.amount < Number.parseFloat(filters.amount_min)) return false
    if (filters.amount_max && t.amount > Number.parseFloat(filters.amount_max)) return false
    if (filters.type === 'debit' && t.amount >= 0) return false
    if (filters.type === 'credit' && t.amount <= 0) return false
    if (filters.search) {
      const q = filters.search.toLowerCase()
      if (!t.description.toLowerCase().includes(q)) return false
    }
    return true
  })
}

function accountName(accounts: Account[], accountId: string): string {
  return accounts.find((a) => a.id === accountId)?.name ?? accountId
}

function pct(part: number, total: number): string {
  if (total <= 0) return '0%'
  return `${((part / total) * 100).toFixed(1)}%`
}

function tableRow(cells: string[]): string {
  return `| ${cells.join(' | ')} |`
}

export function formatReportMarkdown(data: ReportData): string {
  const fmt = (n: number) => formatCurrency(n, data.currency)
  const lines: string[] = []

  lines.push('# Financial Statement Summary Report')
  lines.push('')
  lines.push(`**Generated:** ${formatDate(data.generatedAt.slice(0, 10))} at ${data.generatedAt.slice(11, 19)} UTC`)
  lines.push('**Source:** Statement Analyzer (local browser analysis — verify figures against original bank statements)')
  lines.push('')

  lines.push('## 1. Executive summary')
  lines.push('')
  if (data.period.from && data.period.to) {
    lines.push(`- **Period covered:** ${formatDate(data.period.from)} to ${formatDate(data.period.to)}`)
  }
  lines.push(`- **Accounts:** ${data.accounts.map((a) => `${a.name} (${a.currency})`).join(', ') || '—'}`)
  lines.push(`- **Transactions analyzed:** ${data.transactionCount.toLocaleString()}${data.totalInDatabase !== data.transactionCount ? ` (of ${data.totalInDatabase.toLocaleString()} in session)` : ''}`)
  lines.push(`- **Total income:** ${fmt(data.stats.total_income)}`)
  lines.push(`- **Total expenses:** ${fmt(data.stats.total_expenses)}`)
  lines.push(`- **Net cash flow:** ${fmt(data.stats.net_flow)}`)
  if (data.grossStats && data.dashboardPrefs.exclude_transfers) {
    lines.push(`- **Gross income (before transfer exclusion):** ${fmt(data.grossStats.total_income)}`)
    lines.push(`- **Gross expenses (before transfer exclusion):** ${fmt(data.grossStats.total_expenses)}`)
    lines.push(`- **Internal transfers excluded from totals:** ${data.excludedTransferCount} transactions`)
  }
  lines.push('')

  lines.push('## 2. Data sources')
  lines.push('')
  if (data.importBatches.length === 0) {
    lines.push('- No import metadata recorded for this session.')
  } else {
    for (const batch of data.importBatches) {
      const acct = accountName(data.accounts, batch.account_id)
      lines.push(
        `- **${batch.filename}** → ${acct}: ${batch.row_count.toLocaleString()} rows imported${batch.skipped_count > 0 ? ` (${batch.skipped_count} skipped)` : ''}`,
      )
    }
  }
  lines.push('')

  if (data.breakdown.length > 1) {
    lines.push('## 3. Account breakdown')
    lines.push('')
    lines.push(tableRow(['Account', 'Income', 'Expenses', 'Net']))
    lines.push(tableRow(['---', '---', '---', '---']))
    for (const row of data.breakdown) {
      lines.push(tableRow([row.account_name, fmt(row.income), fmt(row.expenses), fmt(row.net)]))
    }
    lines.push('')
  }

  lines.push(`## ${data.breakdown.length > 1 ? '4' : '3'}. Monthly cash flow`)
  lines.push('')
  if (data.monthly.length === 0) {
    lines.push('_No monthly data for current filters._')
  } else {
    lines.push(tableRow(['Month', 'Income', 'Expenses', 'Net']))
    lines.push(tableRow(['---', '---', '---', '---']))
    for (const m of data.monthly) {
      lines.push(tableRow([m.month, fmt(m.income), fmt(m.expenses), fmt(m.net)]))
    }
  }
  lines.push('')

  const section = (n: number) => n + (data.breakdown.length > 1 ? 1 : 0)

  lines.push(`## ${section(4)}. Top expense payees`)
  lines.push('')
  if (data.expensePayees.length === 0) {
    lines.push('_No expense payees in range._')
  } else {
    lines.push(tableRow(['Payee', 'Total', 'Txns', '% of expenses']))
    lines.push(tableRow(['---', '---', '---', '---']))
    for (const p of data.expensePayees) {
      lines.push(
        tableRow([
          p.merchant.replace(/\|/g, '/'),
          fmt(-p.total),
          String(p.count),
          pct(p.total, data.stats.total_expenses),
        ]),
      )
    }
  }
  lines.push('')

  lines.push(`## ${section(5)}. Top income sources`)
  lines.push('')
  if (data.incomePayees.length === 0) {
    lines.push('_No income sources in range._')
  } else {
    lines.push(tableRow(['Source', 'Total', 'Txns', '% of income']))
    lines.push(tableRow(['---', '---', '---', '---']))
    for (const p of data.incomePayees) {
      lines.push(
        tableRow([
          p.merchant.replace(/\|/g, '/'),
          fmt(p.total),
          String(p.count),
          pct(p.total, data.stats.total_income),
        ]),
      )
    }
  }
  lines.push('')

  lines.push(`## ${section(6)}. Recurring payments detected`)
  lines.push('')
  if (data.recurringPatterns.length === 0) {
    lines.push('_No recurring patterns detected (minimum 3 similar debits required)._')
  } else {
    lines.push(tableRow(['Payee', 'Amount', 'Interval', 'Occurrences', 'Confidence']))
    lines.push(tableRow(['---', '---', '---', '---', '---']))
    for (const p of data.recurringPatterns.slice(0, 20)) {
      lines.push(
        tableRow([
          p.merchant,
          fmt(p.amount),
          p.interval,
          String(p.transaction_ids.length),
          `${Math.round(p.confidence * 100)}%`,
        ]),
      )
    }
  }
  lines.push('')

  lines.push(`## ${section(7)}. Internal transfers`)
  lines.push('')
  lines.push(`- **Pairs detected:** ${data.transferPairs.length}`)
  lines.push(`- **Active pairs (not dismissed):** ${data.activeTransferPairs.length}`)
  if (data.dashboardPrefs.exclude_transfers) {
    lines.push(`- **Excluded from income/expense totals:** yes (${data.excludedTransferCount} transactions)`)
  } else {
    lines.push('- **Excluded from income/expense totals:** no')
  }
  lines.push('')

  lines.push(`## ${section(8)}. Largest transactions`)
  lines.push('')
  lines.push('### Largest outflows')
  lines.push('')
  if (data.largestDebits.length === 0) {
    lines.push('_None in range._')
  } else {
    lines.push(tableRow(['Date', 'Description', 'Amount', 'Account']))
    lines.push(tableRow(['---', '---', '---', '---']))
    for (const t of data.largestDebits) {
      lines.push(
        tableRow([
          formatDate(t.date),
          t.description.slice(0, 80).replace(/\|/g, '/'),
          fmt(t.amount),
          accountName(data.accounts, t.account_id),
        ]),
      )
    }
  }
  lines.push('')
  lines.push('### Largest inflows')
  lines.push('')
  if (data.largestCredits.length === 0) {
    lines.push('_None in range._')
  } else {
    lines.push(tableRow(['Date', 'Description', 'Amount', 'Account']))
    lines.push(tableRow(['---', '---', '---', '---']))
    for (const t of data.largestCredits) {
      lines.push(
        tableRow([
          formatDate(t.date),
          t.description.slice(0, 80).replace(/\|/g, '/'),
          fmt(t.amount),
          accountName(data.accounts, t.account_id),
        ]),
      )
    }
  }
  lines.push('')

  lines.push(`## ${section(9)}. Data quality notes`)
  lines.push('')
  lines.push(`- **Duplicate groups:** ${data.duplicateGroups.length} (${data.pendingDuplicates} pending review)`)
  lines.push(`- **Payee grouping in report:** ${data.dashboardPrefs.merchant_mode === 'smart' ? 'grouped (structured rules)' : 'exact descriptions'}`)
  if (data.filters.account_id !== 'all' || data.filters.date_from || data.filters.date_to || data.filters.search) {
    lines.push('- **Active filters applied:**')
    if (data.filters.account_id !== 'all') {
      lines.push(`  - Account: ${accountName(data.accounts, data.filters.account_id)}`)
    }
    if (data.filters.date_from) lines.push(`  - From: ${data.filters.date_from}`)
    if (data.filters.date_to) lines.push(`  - To: ${data.filters.date_to}`)
    if (data.filters.search) lines.push(`  - Search: "${data.filters.search}"`)
    if (data.filters.type !== 'all') lines.push(`  - Type: ${data.filters.type}`)
  } else {
    lines.push('- **Active filters:** none (full dataset)')
  }
  lines.push('')

  lines.push(`## ${section(10)}. Questions for a financial advisor or AI`)
  lines.push('')
  lines.push('Use this report to explore:')
  lines.push('')
  lines.push('1. Is my net cash flow sustainable over the period covered?')
  lines.push('2. Which expense categories or payees dominate spending, and are they justified?')
  lines.push('3. Are there recurring charges I should cancel, renegotiate, or monitor?')
  lines.push('4. Do large one-off transactions suggest upcoming risks or opportunities?')
  lines.push('5. How much of my income/expense is internal transfers vs real economic activity?')
  lines.push('6. What budget or savings rate would be realistic given this cash flow pattern?')
  lines.push('')
  lines.push('---')
  lines.push('_This report is generated locally from parsed statement data. It is not tax, legal, or investment advice. Confirm all figures against original bank records before making decisions._')

  return lines.join('\n')
}

export function reportFilename(): string {
  const date = new Date().toISOString().slice(0, 10)
  return `financial-summary-${date}.md`
}

export async function generateReportMarkdown(input: ReportInput): Promise<string> {
  const data = await gatherReportData(input)
  return formatReportMarkdown(data)
}
