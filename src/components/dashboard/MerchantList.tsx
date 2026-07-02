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
    <ul className="space-y-1">
      {merchants.map((m, i) => (
        <li key={`${m.merchant}-${i}`}>
          <button
            type="button"
            onClick={() => onSelect?.(m)}
            className={cn(
              'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
              onSelect && 'hover:bg-[var(--color-accent)] cursor-pointer',
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-muted)] text-xs font-medium text-[var(--color-muted-foreground)]">
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className="block truncate">{m.merchant}</span>
                {showVariants && m.variants != null && m.variants > 1 && (
                  <span className="text-xs text-[var(--color-muted-foreground)]">
                    {m.variants} descriptions grouped
                  </span>
                )}
              </span>
            </span>
            <span
              className={cn(
                'shrink-0 font-medium',
                variant === 'debit' ? 'text-[var(--color-destructive)]' : 'text-green-600',
              )}
            >
              {fmt(m.total)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
