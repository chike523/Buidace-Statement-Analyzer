import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { Input } from '@/components/ui/input'
import { searchPayeeNames } from '@/db/duckdb'
import { formatCurrency } from '@/lib/utils'
import type { PayeeSearchResult } from '@/types/transaction'

export function NameSearch() {
  const { filters, setFilters, ignoredIds, accounts, setActiveTab } = useApp()
  const [suggestions, setSuggestions] = useState<PayeeSearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const currency = accounts[0]?.currency ?? 'NGN'

  useEffect(() => {
    if (filters.search.trim().length < 2) {
      setSuggestions([])
      setOpen(false)
      return
    }

    const timer = setTimeout(() => {
      setLoading(true)
      searchPayeeNames(filters.search, filters, ignoredIds)
        .then((results) => {
          setSuggestions(results)
          setOpen(results.length > 0)
        })
        .finally(() => setLoading(false))
    }, 200)

    return () => clearTimeout(timer)
  }, [filters.search, filters, ignoredIds])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectName = (name: string) => {
    setFilters({ search: name })
    setOpen(false)
    setActiveTab('transactions')
  }

  return (
    <div ref={containerRef} className="relative sm:col-span-2 lg:col-span-1">
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--color-muted-foreground)]" />
      <Input
        placeholder="Search names, merchants, payees…"
        value={filters.search}
        onChange={(e) => setFilters({ search: e.target.value })}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        className="pl-8"
        autoComplete="off"
      />
      {filters.search && (
        <button
          type="button"
          onClick={() => {
            setFilters({ search: '' })
            setOpen(false)
          }}
          className="absolute right-2.5 top-2.5 text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {open && (
        <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border border-[var(--color-border)] bg-[var(--color-card)] py-1 shadow-lg">
          {loading && (
            <li className="px-3 py-2 text-xs text-[var(--color-muted-foreground)]">Searching…</li>
          )}
          {!loading &&
            suggestions.map((s) => (
              <li key={s.name}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--color-accent)]"
                  onClick={() => selectName(s.name)}
                >
                  <span className="truncate">{s.name}</span>
                  <span className="shrink-0 text-xs text-[var(--color-muted-foreground)]">
                    {s.count}× · {formatCurrency(s.total_amount, currency)}
                  </span>
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}
