import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useTransactions, useApp } from '@/context/AppContext'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

export function TransactionTable() {
  const { transactions, loading } = useTransactions()
  const { accounts, filteredCount, transferIds } = useApp()
  const parentRef = useRef<HTMLDivElement>(null)
  const transferIdSet = new Set(transferIds)

  const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a]))
  const defaultCurrency = accounts[0]?.currency ?? 'NGN'

  const virtualizer = useVirtualizer({
    count: transactions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 10,
  })

  if (loading && transactions.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-[var(--color-muted-foreground)]">
        Loading transactions…
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-[var(--color-muted-foreground)]">
        <p>No transactions match your filters.</p>
        <p className="text-sm">Upload a statement or adjust filters.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Showing {transactions.length.toLocaleString()} of {filteredCount.toLocaleString()} transactions
      </p>
      <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
        <div className="grid grid-cols-[120px_120px_1fr_120px] border-b bg-[var(--color-muted)] px-4 py-2 text-xs font-medium">
          <span>Date</span>
          <span>Account</span>
          <span>Description</span>
          <span className="text-right">Amount</span>
        </div>
        <div ref={parentRef} className="h-[500px] overflow-auto">
          <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
            {virtualizer.getVirtualItems().map((item) => {
              const tx = transactions[item.index]
              return (
                <div
                  key={tx.id}
                  className="absolute left-0 grid w-full grid-cols-[120px_120px_1fr_120px] border-b px-4 py-2.5 text-sm"
                  style={{ height: `${item.size}px`, transform: `translateY(${item.start}px)` }}
                >
                  <span className="text-[var(--color-muted-foreground)]">{formatDate(tx.date)}</span>
                  <span className="truncate text-xs">{accountMap[tx.account_id]?.name ?? tx.account_id}</span>
                  <span className="flex min-w-0 items-center gap-1.5 truncate" title={tx.description}>
                    {transferIdSet.has(tx.id) && (
                      <Badge variant="outline" className="shrink-0 px-1 py-0 text-[10px]">
                        Transfer
                      </Badge>
                    )}
                    <span className="truncate">{tx.description}</span>
                  </span>
                  <span
                    className={cn(
                      'text-right font-medium',
                      tx.amount < 0 ? 'text-[var(--color-destructive)]' : 'text-green-600',
                    )}
                  >
                    {formatCurrency(tx.amount, tx.currency ?? accountMap[tx.account_id]?.currency ?? defaultCurrency)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
