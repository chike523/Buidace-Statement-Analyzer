import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useDashboardData, useApp } from '@/context/AppContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MerchantList } from '@/components/dashboard/MerchantList'
import { Switch } from '@/components/ui/switch'
import { formatCurrency } from '@/lib/utils'
import { TrendingDown, TrendingUp, Wallet, Hash } from 'lucide-react'
import type { TopMerchant } from '@/types/transaction'

export function Dashboard() {
  const {
    stats,
    grossStats,
    monthly,
    merchants,
    creditMerchants,
    breakdown,
    loading,
    initialLoading,
  } = useDashboardData()
  const {
    transactionCount,
    filters,
    accounts,
    setFilters,
    setActiveTab,
    dashboardPrefs,
    setDashboardPrefs,
    transferPairs,
    transferIds,
  } = useApp()

  const currency = accounts[0]?.currency ?? 'NGN'
  const fmt = (n: number) => formatCurrency(n, currency)
  const chartSuffix = currency === 'NGN' ? '₦' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$'

  const activeTransferCount = transferIds.length
  const showTransferToggle = accounts.length >= 2 || transferPairs.length > 0

  const searchMerchant = (merchant: TopMerchant) => {
    setFilters({ search: merchant.search_hint ?? merchant.merchant, type: 'all' })
    setActiveTab('transactions')
  }

  if (transactionCount === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-[var(--color-muted-foreground)]">
        Import statements to see your dashboard.
      </div>
    )
  }

  if (initialLoading || !stats) {
    return (
      <div className="flex h-48 items-center justify-center text-[var(--color-muted-foreground)]">
        Loading dashboard…
      </div>
    )
  }

  const chartData = monthly.map((m) => ({
    ...m,
    label: m.month,
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3">
        {showTransferToggle && (
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Switch
              checked={dashboardPrefs.exclude_transfers}
              onCheckedChange={(checked) => setDashboardPrefs({ exclude_transfers: checked })}
            />
            <span>Exclude transfers</span>
          </label>
        )}
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Switch
            checked={dashboardPrefs.merchant_mode === 'smart'}
            onCheckedChange={(checked) =>
              setDashboardPrefs({ merchant_mode: checked ? 'smart' : 'exact' })
            }
          />
          <span>Group payees</span>
        </label>
        {loading && (
          <span className="text-xs text-[var(--color-muted-foreground)]">Updating…</span>
        )}
      </div>

      {transferPairs.length > 0 && (
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {transferPairs.length} internal transfer{transferPairs.length === 1 ? '' : 's'} detected
          {dashboardPrefs.exclude_transfers && activeTransferCount > 0
            ? ` · ${activeTransferCount} excluded from totals`
            : ''}
          {dashboardPrefs.exclude_transfers && grossStats && (
            <span className="ml-1">
              (gross income {fmt(grossStats.total_income)}, expenses {fmt(grossStats.total_expenses)})
            </span>
          )}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Income"
          value={fmt(stats.total_income)}
          icon={<TrendingUp className="h-4 w-4 text-green-600" />}
        />
        <StatCard
          title="Expenses"
          value={fmt(stats.total_expenses)}
          icon={<TrendingDown className="h-4 w-4 text-[var(--color-destructive)]" />}
        />
        <StatCard
          title="Net flow"
          value={fmt(stats.net_flow)}
          icon={<Wallet className="h-4 w-4 text-[var(--color-primary)]" />}
        />
        <StatCard
          title="Transactions"
          value={stats.transaction_count.toLocaleString()}
          icon={<Hash className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly cash flow</CardTitle>
          </CardHeader>
          <CardContent className="h-72 min-h-72">
            {chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted-foreground)]">
                No monthly data for the current filters.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minHeight={288}>
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `${chartSuffix}${(Number(v) / 1000).toFixed(0)}k`}
                  />
                  <Tooltip formatter={(v) => fmt(Number(v))} />
                  <Legend />
                  <Bar dataKey="income" fill="#16a34a" name="Income" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey="expenses" fill="#dc2626" name="Expenses" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Net flow trend</CardTitle>
          </CardHeader>
          <CardContent className="h-72 min-h-72">
            {chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted-foreground)]">
                No monthly data for the current filters.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minHeight={288}>
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `${chartSuffix}${(Number(v) / 1000).toFixed(0)}k`}
                  />
                  <Tooltip formatter={(v) => fmt(Number(v))} />
                  <Line
                    type="monotone"
                    dataKey="net"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top payees by spend</CardTitle>
            {dashboardPrefs.merchant_mode === 'smart' && (
              <CardDescription>Grouped by payee</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <MerchantList
              merchants={merchants}
              currency={currency}
              variant="debit"
              showVariants={dashboardPrefs.merchant_mode === 'smart'}
              emptyMessage="No expense data in range."
              onSelect={searchMerchant}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top payees by income</CardTitle>
            {dashboardPrefs.merchant_mode === 'smart' && (
              <CardDescription>Grouped by payee</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <MerchantList
              merchants={creditMerchants}
              currency={currency}
              variant="credit"
              showVariants={dashboardPrefs.merchant_mode === 'smart'}
              emptyMessage="No income data in range."
              onSelect={searchMerchant}
            />
          </CardContent>
        </Card>
      </div>

      {filters.account_id === 'all' && breakdown.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {breakdown.map((b) => (
                <li key={b.account_id} className="space-y-1">
                  <div className="flex justify-between text-sm font-medium">
                    <span>{b.account_name}</span>
                    <span className={b.net >= 0 ? 'text-green-600' : 'text-[var(--color-destructive)]'}>
                      {fmt(b.net)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-[var(--color-muted-foreground)]">
                    <span>In: {fmt(b.income)}</span>
                    <span>Out: {fmt(b.expenses)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function StatCard({
  title,
  value,
  icon,
}: {
  title: string
  value: string
  icon: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-6">
        <div>
          <p className="text-sm text-[var(--color-muted-foreground)]">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
        {icon}
      </CardContent>
    </Card>
  )
}
