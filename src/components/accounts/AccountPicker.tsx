import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

type AccountPickerProps = {
  value: string
  onChange: (accountId: string) => void
  suggestedName?: string
  suggestedCurrency?: string
  /** When true and no accounts exist, show create form immediately */
  preferCreate?: boolean
}

export function AccountPicker({
  value,
  onChange,
  suggestedName = '',
  suggestedCurrency = 'USD',
  preferCreate = false,
}: AccountPickerProps) {
  const { accounts, createAccount } = useApp()
  const [creating, setCreating] = useState(preferCreate && accounts.length === 0)
  const [newName, setNewName] = useState(suggestedName)
  const [currency, setCurrency] = useState(suggestedCurrency)

  useEffect(() => {
    if (suggestedName && !newName) setNewName(suggestedName)
  }, [suggestedName, newName])

  useEffect(() => {
    if (suggestedCurrency) setCurrency(suggestedCurrency)
  }, [suggestedCurrency])

  const handleCreate = async () => {
    if (!newName.trim()) return
    const account = await createAccount(newName.trim(), currency)
    onChange(account.id)
    setCreating(false)
  }

  if (creating || (preferCreate && accounts.length === 0)) {
    return (
      <div className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)]/40 p-4">
        <div>
          <label className="text-sm font-medium">Account name</label>
          <p className="text-xs text-[var(--color-muted-foreground)]">
            Label this statement so you can filter by account later
          </p>
        </div>
        <Input
          placeholder="e.g. OPay, GTBank Savings"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          autoFocus
        />
        <div className="flex gap-2">
          <Select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-32">
            <option value="NGN">₦ NGN</option>
            <option value="USD">$ USD</option>
            <option value="EUR">€ EUR</option>
            <option value="GBP">£ GBP</option>
          </Select>
          <Button onClick={handleCreate} disabled={!newName.trim()} className="flex-1">
            Create account
          </Button>
        </div>
        {accounts.length > 0 && (
          <button
            type="button"
            onClick={() => setCreating(false)}
            className="text-xs text-[var(--color-muted-foreground)] hover:underline"
          >
            Use existing account instead
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Assign to account</label>
      <div className="flex gap-2">
        <Select value={value} onChange={(e) => onChange(e.target.value)} className="flex-1">
          <option value="">— Select account —</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.currency})
            </option>
          ))}
        </Select>
        <Button variant="outline" size="icon" onClick={() => setCreating(true)} type="button" title="New account">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export function AccountSwitcher() {
  const { accounts, filters, setFilters } = useApp()

  return (
    <Select
      value={filters.account_id}
      onChange={(e) => setFilters({ account_id: e.target.value })}
      className="w-48"
    >
      <option value="all">All accounts</option>
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
        </option>
      ))}
    </Select>
  )
}
