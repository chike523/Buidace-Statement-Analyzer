import { useMemo } from 'react'
import { Copy, Check, X } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { countPendingDuplicates } from '@/lib/duplicates'
import { queryTransactions } from '@/db/duckdb'
import { useEffect, useState } from 'react'
import type { Transaction } from '@/types/transaction'

export function DuplicatePanel({ embedded = false }: { embedded?: boolean }) {
  const { duplicateGroups, resolveDuplicate, transactionCount } = useApp()
  const [txMap, setTxMap] = useState<Record<string, Transaction>>({})
  const pending = countPendingDuplicates(duplicateGroups)

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
  }, [transactionCount, duplicateGroups])

  const pendingGroups = useMemo(
    () => duplicateGroups.filter((g) => g.status === 'pending'),
    [duplicateGroups],
  )

  if (transactionCount === 0) {
    if (embedded) return null
    return (
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Import transactions to scan for duplicates.
      </p>
    )
  }

  if (pendingGroups.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-[var(--color-muted-foreground)]">
        <Check className="h-6 w-6 text-green-600" />
        <p className="text-sm">No duplicates to review.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {!embedded && (
        <div className="flex items-center gap-2">
          <Copy className="h-4 w-4" />
          <span className="text-sm font-medium">{pending} duplicate group(s) to review</span>
        </div>
      )}

      {pendingGroups.map((group) => (
        <Card key={group.id}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Possible duplicates</CardTitle>
              <Badge variant="secondary">{group.transaction_ids.length} transactions</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {group.transaction_ids.map((id) => {
              const tx = txMap[id]
              if (!tx) return null
              return (
                <div
                  key={id}
                  className="flex items-center justify-between rounded-md bg-[var(--color-muted)] px-3 py-2 text-sm"
                >
                  <div>
                    <span className="text-[var(--color-muted-foreground)]">{formatDate(tx.date)}</span>
                    <span className="mx-2">·</span>
                    <span>{tx.description}</span>
                  </div>
                  <span className={tx.amount < 0 ? 'text-[var(--color-destructive)]' : 'text-green-600'}>
                    {formatCurrency(tx.amount)}
                  </span>
                </div>
              )
            })}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => resolveDuplicate(group.id, 'keep_both')}>
                <Check className="mr-1 h-3 w-3" />
                Keep both
              </Button>
              <Button size="sm" variant="destructive" onClick={() => resolveDuplicate(group.id, 'ignored')}>
                <X className="mr-1 h-3 w-3" />
                Mark as duplicate
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
