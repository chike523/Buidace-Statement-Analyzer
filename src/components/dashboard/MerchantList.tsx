import type { TopMerchant } from '@/types/transaction'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'

type MerchantListProps = {
  merchants: TopMerchant[]
  currency: string
  variant: 'debit' | 'credit'
  emptyMessage: string
  showVariants?: boolean
  onSelect?: (merchant: TopMerchant) => void
}

export function MerchantList({
  merchants,
  currency,
  variant,
  emptyMessage,
  showVariants = false,
  onSelect,
}: MerchantListProps) {
  if (merchants.length === 0) {
    return <p className="text-sm text-[var(--color-muted-foreground)]">{emptyMessage}</p>
  }

  const fmt = (n: number) => formatCurrency(variant === 'debit' ? -n : n, currency)

  return (
    <ul className="min-w-0 space-y-1 overflow-hidden">
      {merchants.map((m, i) => (
        <li key={`${m.merchant}-${i}`} className="min-w-0">
          <button
            type="button"
            onClick={() => onSelect?.(m)}
            className={cn(
              'flex w-full min-w-0 items-start justify-between gap-3 overflow-hidden rounded-md px-1 py-2 text-left text-sm transition-colors sm:px-2 sm:py-1.5',
              onSelect && 'cursor-pointer hover:bg-[var(--color-accent)]',
            )}
          >
            <span className="flex min-w-0 flex-1 items-start gap-2 overflow-hidden">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-muted)] text-xs font-medium text-[var(--color-muted-foreground)]">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 overflow-hidden">
                <span className="block truncate" title={m.merchant}>
                  {m.merchant}
                </span>
                {showVariants && m.variants != null && m.variants > 1 && (
                  <span className="block truncate text-xs text-[var(--color-muted-foreground)]">
                    {m.variants} descriptions grouped
                  </span>
                )}
              </span>
            </span>
            <span
              className={cn(
                'max-w-[42%] shrink-0 truncate text-right text-xs font-semibold tabular-nums sm:max-w-[45%] sm:text-sm',
                variant === 'debit' ? 'text-[var(--color-destructive)]' : 'text-green-600',
              )}
              title={fmt(m.total)}
            >
              {fmt(m.total)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
