import { format, subDays } from 'date-fns'
import { useApp } from '@/context/AppContext'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { AccountSwitcher } from '@/components/accounts/AccountPicker'
import { NameSearch } from '@/components/filters/NameSearch'

export function FilterBar() {
  const { filters, setFilters } = useApp()

  const setPreset = (days: number | 'all') => {
    if (days === 'all') {
      setFilters({ date_from: '', date_to: '' })
    } else {
      setFilters({
        date_from: format(subDays(new Date(), days), 'yyyy-MM-dd'),
        date_to: format(new Date(), 'yyyy-MM-dd'),
      })
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-3 sm:p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <AccountSwitcher />
          <Select
            value={filters.type}
            onChange={(e) => setFilters({ type: e.target.value as typeof filters.type })}
            className="w-full sm:w-32"
          >
            <option value="all">All types</option>
            <option value="debit">Debits</option>
            <option value="credit">Credits</option>
          </Select>
        </div>
        <div className="flex gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Button variant="outline" size="sm" className="min-h-9 shrink-0" onClick={() => setPreset(30)}>
            30d
          </Button>
          <Button variant="outline" size="sm" className="min-h-9 shrink-0" onClick={() => setPreset(90)}>
            90d
          </Button>
          <Button variant="outline" size="sm" className="min-h-9 shrink-0" onClick={() => setPreset(365)}>
            1y
          </Button>
          <Button variant="outline" size="sm" className="min-h-9 shrink-0" onClick={() => setPreset('all')}>
            All
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Input
          type="date"
          value={filters.date_from}
          onChange={(e) => setFilters({ date_from: e.target.value })}
          aria-label="From date"
          title="From date"
          className="min-h-10"
        />
        <Input
          type="date"
          value={filters.date_to}
          onChange={(e) => setFilters({ date_to: e.target.value })}
          aria-label="To date"
          title="To date"
          className="min-h-10"
        />
        <Input
          type="number"
          placeholder="Min amount"
          value={filters.amount_min}
          onChange={(e) => setFilters({ amount_min: e.target.value })}
          className="min-h-10"
        />
        <Input
          type="number"
          placeholder="Max amount"
          value={filters.amount_max}
          onChange={(e) => setFilters({ amount_max: e.target.value })}
          className="min-h-10"
        />
        <NameSearch />
      </div>
      {filters.search && (
        <p className="text-xs text-[var(--color-muted-foreground)]">
          Filtering by name:{' '}
          <span className="font-medium text-[var(--color-foreground)]">{filters.search}</span>
        </p>
      )}
    </div>
  )
}
