import { useEffect, useMemo, useState } from 'react'
import { useApp } from '@/context/AppContext'
import { queryTransactions } from '@/db/duckdb'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Transaction } from '@/types/transaction'

export function TransfersPanel({ embedded = false }: { embedded?: boolean }) {
  const {
    transferPairs,
    rejectTransfer,
    accounts,
    transactionCount,
    rejectedTransferPairIds,
  } = useApp()
  const [txMap, setTxMap] = useState<Record<string, Transaction>>({})

  const accountMap = useMemo(
    () => Object.fromEntries(accounts.map((a) => [a.id, a])),
    [accounts],
  )
  const currency = accounts[0]?.currency ?? 'NGN'

  useEffect(() => {
    if (transactionCount === 0) return
    queryTransactions(
      {
        account_id: 'all',
        date_from: '',
        date_to: '',
        amount_min: '',
        amount_max: '',
        type: 'all',
        search: '',
      },
      [],
      50000,
    ).then((txs) => {
      setTxMap(Object.fromEntries(txs.map((t) => [t.id, t])))
    })
  }, [transactionCount, transferPairs])

  if (transactionCount === 0) {
    if (embedded) return null
    return (
      <div className="flex h-48 items-center justify-center text-[var(--color-muted-foreground)]">
        Import statements to detect internal transfers.
      </div>
    )
  }

  if (transferPairs.length === 0) {
    return (
      <p className="py-4 text-sm text-[var(--color-muted-foreground)]">
        No internal transfers detected.
      </p>
    )
  }

  const activePairs = transferPairs.filter((p) => !rejectedTransferPairIds.has(p.id))

  return (
    <div className="space-y-3">
      {!embedded && (
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {activePairs.length} pair{activePairs.length === 1 ? '' : 's'} · exclude from totals on
          the overview page
        </p>
      )}

      <ul className="space-y-3">
        {transferPairs.map((pair) => {
          const rejected = rejectedTransferPairIds.has(pair.id)
          const debit = txMap[pair.debit_id]
          const credit = txMap[pair.credit_id]

          return (
            <li key={pair.id}>
              <Card className={rejected ? 'opacity-60' : undefined}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{formatCurrency(pair.amount, currency)}</span>
                      <span className="text-sm text-[var(--color-muted-foreground)]">
                        {formatDate(pair.date)}
                      </span>
                      {rejected && <Badge variant="secondary">Dismissed</Badge>}
                    </div>
                    {!rejected && (
                      <Button variant="outline" size="sm" onClick={() => rejectTransfer(pair.id)}>
                        Not a transfer
                      </Button>
                    )}
                  </div>
                  {debit && (
                    <TransferLeg
                      label="Out"
                      tx={debit}
                      accountName={accountMap[debit.account_id]?.name}
                      currency={currency}
                    />
                  )}
                  {credit && (
                    <TransferLeg
                      label="In"
                      tx={credit}
                      accountName={accountMap[credit.account_id]?.name}
                      currency={currency}
                    />
                  )}
                </CardContent>
              </Card>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function TransferLeg({
  label,
  tx,
  accountName,
  currency,
}: {
  label: string
  tx: Transaction
  accountName?: string
  currency: string
}) {
  return (
    <div className="rounded-md bg-[var(--color-muted)]/50 px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          <span className="font-medium">{label}</span>
          <span className="text-[var(--color-muted-foreground)]"> · {accountName ?? tx.account_id}</span>
        </span>
        <span className={tx.amount < 0 ? 'text-[var(--color-destructive)]' : 'text-green-600'}>
          {formatCurrency(tx.amount, currency)}
        </span>
      </div>
      <p className="mt-1 truncate text-xs text-[var(--color-muted-foreground)]" title={tx.description}>
        {tx.description}
      </p>
    </div>
  )
}
