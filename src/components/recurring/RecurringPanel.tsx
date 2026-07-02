import { RefreshCw } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'

export function RecurringPanel() {
  const { recurringPatterns, accounts, transactionCount } = useApp()

  const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a.name]))

  if (transactionCount === 0) {
    return (
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Import transactions to detect recurring payments.
      </p>
    )
  }

  if (recurringPatterns.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-[var(--color-muted-foreground)]">
        <RefreshCw className="h-8 w-8" />
        <p className="text-sm">No recurring patterns detected yet.</p>
        <p className="text-xs">Need at least 3 similar debits at regular intervals.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {recurringPatterns.map((pattern) => (
        <Card key={pattern.id}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm capitalize">{pattern.merchant}</CardTitle>
              <Badge variant="outline">{pattern.interval}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--color-muted-foreground)]">Amount</span>
              <span className="font-medium text-[var(--color-destructive)]">
                {formatCurrency(pattern.amount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-muted-foreground)]">Account</span>
              <span>{accountMap[pattern.account_id] ?? pattern.account_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-muted-foreground)]">Occurrences</span>
              <span>{pattern.transaction_ids.length}</span>
            </div>
            {pattern.next_expected && (
              <div className="flex justify-between">
                <span className="text-[var(--color-muted-foreground)]">Next expected</span>
                <span>{formatDate(pattern.next_expected)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-[var(--color-muted-foreground)]">Confidence</span>
              <span>{Math.round(pattern.confidence * 100)}%</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
