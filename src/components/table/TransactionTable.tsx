import { useEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useTransactions, useApp } from '@/context/AppContext'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

export function TransactionTable() {
  const { transactions, loading } = useTransactions()
  const { accounts, filteredCount, transferIds } = useApp()
  const parentRef = useRef<HTMLDivElement>(null)
  const transferIdSet = new Set(transferIds)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a]))
  const defaultCurrency = accounts[0]?.currency ?? 'NGN'

  const virtualizer = useVirtualizer({
    count: transactions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (isMobile ? 92 : 44),
    overscan: 12,
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
      <div className="flex h-64 flex-col items-center justify-center px-4 text-center text-[var(--color-muted-foreground)]">
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
        {/* Desktop header */}
        <div className="hidden grid-cols-[120px_120px_1fr_120px] border-b bg-[var(--color-muted)] px-4 py-2 text-xs font-medium md:grid">
          <span>Date</span>
          <span>Account</span>
          <span>Description</span>
          <span className="text-right">Amount</span>
        </div>

        <div
          ref={parentRef}
          className="h-[min(70vh,560px)] overflow-auto overscroll-contain"
        >
          <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
            {virtualizer.getVirtualItems().map((item) => {
              const tx = transactions[item.index]
              const currency =
                tx.currency ?? accountMap[tx.account_id]?.currency ?? defaultCurrency
              const isTransfer = transferIdSet.has(tx.id)

              return (
                <div
                  key={tx.id}
                  className="absolute left-0 w-full border-b border-[var(--color-border)]"
                  style={{ height: `${item.size}px`, transform: `translateY(${item.start}px)` }}
                >
                  {/* Mobile card row */}
                  <div className="flex h-full flex-col justify-center gap-1 px-3 py-2.5 md:hidden">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium leading-snug" title={tx.description}>
                          {tx.description}
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--color-muted-foreground)]">
                          <span>{formatDate(tx.date)}</span>
                          <span aria-hidden>·</span>
                          <span className="truncate">
                            {accountMap[tx.account_id]?.name ?? tx.account_id}
                          </span>
                          {isTransfer && (
                            <Badge variant="outline" className="px-1 py-0 text-[10px]">
                              Transfer
                            </Badge>
                          )}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'shrink-0 text-sm font-semibold tabular-nums',
                          tx.amount < 0
                            ? 'text-[var(--color-destructive)]'
                            : 'text-green-600',
                        )}
                      >
                        {formatCurrency(tx.amount, currency)}
                      </span>
                    </div>
                  </div>

                  {/* Desktop table row */}
                  <div className="hidden h-full grid-cols-[120px_120px_1fr_120px] items-center px-4 text-sm md:grid">
                    <span className="text-[var(--color-muted-foreground)]">{formatDate(tx.date)}</span>
                    <span className="truncate text-xs">
                      {accountMap[tx.account_id]?.name ?? tx.account_id}
                    </span>
                    <span className="flex min-w-0 items-center gap-1.5 truncate" title={tx.description}>
                      {isTransfer && (
                        <Badge variant="outline" className="shrink-0 px-1 py-0 text-[10px]">
                          Transfer
                        </Badge>
                      )}
                      <span className="truncate">{tx.description}</span>
                    </span>
                    <span
                      className={cn(
                        'text-right font-medium tabular-nums',
                        tx.amount < 0
                          ? 'text-[var(--color-destructive)]'
                          : 'text-green-600',
                      )}
                    >
                      {formatCurrency(tx.amount, currency)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
