import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type {
  Account,
  AccountBreakdown,
  ColumnMapping,
  DashboardPreferences,
  DashboardStats,
  DuplicateGroup,
  ImportBatch,
  MonthlyFlow,
  ParseResult,
  RecurringPattern,
  TopMerchant,
  Transaction,
  TransactionFilters,
  TransferPair,
} from '@/types/transaction'
import { isPersistenceEnabled, isPersistenceSupported } from '@/db/persistence'
import { loadDuckDb } from '@/db/load'
import { countPendingDuplicates } from '@/lib/duplicates'
import { getTransferTransactionIds } from '@/lib/transfers'
import { runAnalysis } from '@/lib/analysis-client'
import { generateId } from '@/lib/utils'
import type { ImportSummary } from '@/lib/import-helpers'

type ImportFileType = 'csv' | 'pdf' | 'excel' | 'ofx'

type PendingImport = {
  id: string
  file: File
  fileType: ImportFileType
  parseResult?: ParseResult
  /** For Excel imports: the worksheet converted to CSV text, fed into the CSV pipeline. */
  csvContent?: string
  pdfRows?: { date: string; description: string; amount: number; raw_source: string }[]
  pdfMeta?: { page_count: number; has_text_layer: boolean; raw_text_preview: string }
  status: 'pending' | 'parsing' | 'ready' | 'importing' | 'done' | 'error'
  error?: string
  parseProgress?: number
}

type AppContextValue = {
  ready: boolean
  accounts: Account[]
  importBatches: ImportBatch[]
  pendingImports: PendingImport[]
  filters: TransactionFilters
  setFilters: (filters: Partial<TransactionFilters>) => void
  duplicateGroups: DuplicateGroup[]
  recurringPatterns: RecurringPattern[]
  ignoredIds: string[]
  transactionCount: number
  filteredCount: number
  refreshData: () => Promise<number>
  createAccount: (name: string, currency?: string) => Promise<Account>
  addPendingImport: (file: File, fileType: ImportFileType) => string
  updatePendingImport: (id: string, update: Partial<PendingImport>) => void
  removePendingImport: (id: string) => void
  importCsv: (
    pendingId: string,
    accountId: string,
    mapping: ColumnMapping,
    content: string,
  ) => Promise<{ skipped: number; errors: string[] }>
  importPdf: (pendingId: string, accountId: string, rows: { date: string; description: string; amount: number; raw_source: string }[]) => Promise<void>
  resolveDuplicate: (groupId: string, status: 'keep_both' | 'ignored') => Promise<void>
  activeTab: string
  setActiveTab: (tab: string) => void
  importSummary: ImportSummary | null
  completeImport: (summary: ImportSummary) => void
  dismissImportSummary: () => void
  dashboardPrefs: DashboardPreferences
  setDashboardPrefs: (update: Partial<DashboardPreferences>) => void
  transferPairs: TransferPair[]
  transferIds: string[]
  rejectedTransferPairIds: Set<string>
  rejectTransfer: (pairId: string) => Promise<void>
  persistenceSupported: boolean
  persistenceEnabled: boolean
  persistenceBusy: boolean
  setPersistence: (enabled: boolean) => Promise<void>
}

const defaultDashboardPrefs = (): DashboardPreferences => ({
  exclude_transfers: false,
  merchant_mode: 'exact',
})

const EMPTY_EXCLUDE_IDS: string[] = []

const defaultFilters = (): TransactionFilters => ({
  account_id: 'all',
  date_from: '',
  date_to: '',
  amount_min: '',
  amount_max: '',
  type: 'all',
  search: '',
})

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [importBatches, setImportBatches] = useState<ImportBatch[]>([])
  const [pendingImports, setPendingImports] = useState<PendingImport[]>([])
  const [filters, setFiltersState] = useState<TransactionFilters>(defaultFilters)
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([])
  const [recurringPatterns, setRecurringPatterns] = useState<RecurringPattern[]>([])
  const [ignoredIds, setIgnoredIds] = useState<string[]>([])
  const [transactionCount, setTransactionCount] = useState(0)
  const [filteredCount, setFilteredCount] = useState(0)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null)
  const [dashboardPrefs, setDashboardPrefsState] = useState<DashboardPreferences>(defaultDashboardPrefs)
  const [transferPairs, setTransferPairs] = useState<TransferPair[]>([])
  const [rejectedTransferPairIds, setRejectedTransferPairIds] = useState<Set<string>>(new Set())
  const [persistenceSupported] = useState(isPersistenceSupported)
  const [persistenceEnabled, setPersistenceEnabledState] = useState(isPersistenceEnabled)
  const [persistenceBusy, setPersistenceBusy] = useState(false)

  const transferIds = useMemo(
    () => Array.from(getTransferTransactionIds(transferPairs, rejectedTransferPairIds)),
    [transferPairs, rejectedTransferPairIds],
  )

  const refreshData = useCallback(async (): Promise<number> => {
    const db = await loadDuckDb()
    const [accts, ignored, count, rejectedPairs] = await Promise.all([
      db.getAccounts(),
      db.getIgnoredTransactionIds(),
      db.getTransactionCount(),
      db.getRejectedTransferPairIds(),
    ])
    setAccounts(accts)
    setIgnoredIds(ignored)
    setTransactionCount(count)
    setFilteredCount(await db.countTransactions(filters, ignored))
    setRejectedTransferPairIds(new Set(rejectedPairs))

    if (count > 0) {
      const allTx = await db.getAllTransactions()
      const visibleTx = allTx.filter((t) => !ignored.includes(t.id))
      const existingGroups = await db.getDuplicateGroups()
      const resolvedMap = new Map(
        existingGroups.filter((g) => g.status !== 'pending').map((g) => [g.fingerprint, g.status]),
      )
      // Detection runs in a Web Worker to keep the UI responsive on large imports.
      const { duplicateGroups, recurringPatterns, transferPairs } = await runAnalysis(
        allTx,
        visibleTx,
      )
      const groups = duplicateGroups.map((g) => ({
        ...g,
        status: resolvedMap.get(g.fingerprint) ?? g.status,
      }))
      setDuplicateGroups(groups)
      await db.saveDuplicateGroups(groups)
      setRecurringPatterns(recurringPatterns)
      setTransferPairs(transferPairs)
      return countPendingDuplicates(groups)
    }

    setDuplicateGroups([])
    setRecurringPatterns([])
    setTransferPairs([])
    return 0
  }, [filters])

  useEffect(() => {
    let cancelled = false
    const persistOn = isPersistenceEnabled()

    // Session-only mode: paint the welcome UI immediately, then warm DuckDB
    // in the background so the first import isn't stalled by WASM download.
    if (!persistOn) {
      setReady(true)
    }

    const boot = async () => {
      const db = await loadDuckDb()
      await db.initDatabase()
      if (cancelled) return
      await refreshData()
      if (cancelled) return
      if (persistOn) setReady(true)
    }

    const scheduleWarm = () => {
      void boot().catch(console.error)
    }

    if (persistOn) {
      scheduleWarm()
      return () => {
        cancelled = true
      }
    }

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const id = window.requestIdleCallback(scheduleWarm, { timeout: 1500 })
      return () => {
        cancelled = true
        window.cancelIdleCallback(id)
      }
    }

    const timer = setTimeout(scheduleWarm, 50)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // Boot once on mount. refreshData is stable enough for the initial load;
    // later filter changes go through the dedicated count effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!ready) return
    void loadDuckDb().then((db) => db.countTransactions(filters, ignoredIds).then(setFilteredCount))
  }, [filters, ignoredIds, ready, transactionCount])

  const setFilters = useCallback((update: Partial<TransactionFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...update }))
  }, [])

  const setDashboardPrefs = useCallback((update: Partial<DashboardPreferences>) => {
    setDashboardPrefsState((prev) => ({ ...prev, ...update }))
  }, [])

  const rejectTransfer = useCallback(async (pairId: string) => {
    const db = await loadDuckDb()
    await db.rejectTransferPair(pairId)
    setRejectedTransferPairIds((prev) => new Set([...prev, pairId]))
  }, [])

  const setPersistence = useCallback(
    async (enabled: boolean) => {
      setPersistenceBusy(true)
      try {
        const db = await loadDuckDb()
        await db.setPersistenceEnabled(enabled)
        setPersistenceEnabledState(enabled)
        await refreshData()
      } finally {
        setPersistenceBusy(false)
      }
    },
    [refreshData],
  )

  const createAccount = useCallback(async (name: string, currency = 'USD') => {
    const db = await loadDuckDb()
    const account: Account = { id: generateId(), name, currency }
    await db.upsertAccount(account)
    setAccounts((prev) => [...prev, account])
    return account
  }, [])

  const addPendingImport = useCallback((file: File, fileType: ImportFileType): string => {
    const id = generateId()
    setPendingImports((prev) => [
      ...prev,
      { id, file, fileType, status: 'pending' },
    ])
    return id
  }, [])

  const updatePendingImport = useCallback((id: string, update: Partial<PendingImport>) => {
    setPendingImports((prev) => prev.map((p) => (p.id === id ? { ...p, ...update } : p)))
  }, [])

  const removePendingImport = useCallback((id: string) => {
    setPendingImports((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const completeImport = useCallback((summary: ImportSummary) => {
    setImportSummary(summary)
    setActiveTab('dashboard')
  }, [])

  const dismissImportSummary = useCallback(() => setImportSummary(null), [])

  const importCsv = useCallback(
    async (pendingId: string, accountId: string, mapping: ColumnMapping, content: string) => {
      const pending = pendingImports.find((p) => p.id === pendingId)
      if (!pending) throw new Error('Import not found')

      const account = accounts.find((a) => a.id === accountId)
      updatePendingImport(pendingId, { status: 'importing' })
      const batchId = generateId()
      const [{ convertCsvToTransactions }, db] = await Promise.all([
        import('@/lib/parsers/csv'),
        loadDuckDb(),
      ])
      const { transactions, skipped, errors } = await convertCsvToTransactions(
        content,
        pending.file.name,
        mapping,
        accountId,
        batchId,
        account?.currency ?? 'USD',
      )

      await db.insertTransactions(transactions)
      setImportBatches((prev) => [
        ...prev,
        {
          id: batchId,
          account_id: accountId,
          filename: pending.file.name,
          imported_at: new Date().toISOString(),
          row_count: transactions.length,
          skipped_count: skipped,
        },
      ])
      updatePendingImport(pendingId, { status: 'done' })
      const dupes = await refreshData()
      completeImport({
        filename: pending.file.name,
        account_name: account?.name ?? 'Account',
        row_count: transactions.length,
        skipped_count: skipped,
        duplicate_count: dupes,
        currency: account?.currency ?? 'USD',
      })
      return { skipped, errors }
    },
    [pendingImports, accounts, refreshData, updatePendingImport, completeImport],
  )

  const importPdf = useCallback(
    async (
      pendingId: string,
      accountId: string,
      rows: { date: string; description: string; amount: number; raw_source: string }[],
    ) => {
      const pending = pendingImports.find((p) => p.id === pendingId)
      if (!pending) throw new Error('Import not found')

      const account = accounts.find((a) => a.id === accountId)
      updatePendingImport(pendingId, { status: 'importing' })
      const batchId = generateId()
      const [{ pdfRowsToTransactions }, db] = await Promise.all([
        import('@/lib/parsers/pdf'),
        loadDuckDb(),
      ])
      const transactions = await pdfRowsToTransactions(
        rows,
        accountId,
        batchId,
        account?.currency ?? 'USD',
      )

      await db.insertTransactions(transactions)
      setImportBatches((prev) => [
        ...prev,
        {
          id: batchId,
          account_id: accountId,
          filename: pending.file.name,
          imported_at: new Date().toISOString(),
          row_count: transactions.length,
          skipped_count: 0,
        },
      ])
      updatePendingImport(pendingId, { status: 'done' })
      const dupes = await refreshData()
      completeImport({
        filename: pending.file.name,
        account_name: account?.name ?? 'Account',
        row_count: transactions.length,
        skipped_count: 0,
        duplicate_count: dupes,
        currency: account?.currency ?? 'USD',
      })
    },
    [pendingImports, accounts, refreshData, updatePendingImport, completeImport],
  )

  const resolveDuplicate = useCallback(
    async (groupId: string, status: 'keep_both' | 'ignored') => {
      const db = await loadDuckDb()
      const updated = duplicateGroups.map((g) =>
        g.id === groupId ? { ...g, status } : g,
      )
      setDuplicateGroups(updated)
      await db.saveDuplicateGroups(updated)
      await refreshData()
    },
    [duplicateGroups, refreshData],
  )

  const value = useMemo(
    () => ({
      ready,
      accounts,
      importBatches,
      pendingImports,
      filters,
      setFilters,
      duplicateGroups,
      recurringPatterns,
      ignoredIds,
      transactionCount,
      filteredCount,
      refreshData,
      createAccount,
      addPendingImport,
      updatePendingImport,
      removePendingImport,
      importCsv,
      importPdf,
      resolveDuplicate,
      activeTab,
      setActiveTab,
      importSummary,
      completeImport,
      dismissImportSummary,
      dashboardPrefs,
      setDashboardPrefs,
      transferPairs,
      transferIds,
      rejectedTransferPairIds,
      rejectTransfer,
      persistenceSupported,
      persistenceEnabled,
      persistenceBusy,
      setPersistence,
    }),
    [
      ready,
      accounts,
      importBatches,
      pendingImports,
      filters,
      duplicateGroups,
      recurringPatterns,
      ignoredIds,
      transactionCount,
      filteredCount,
      refreshData,
      createAccount,
      addPendingImport,
      updatePendingImport,
      removePendingImport,
      importCsv,
      importPdf,
      resolveDuplicate,
      activeTab,
      importSummary,
      completeImport,
      dismissImportSummary,
      dashboardPrefs,
      setDashboardPrefs,
      transferPairs,
      transferIds,
      rejectedTransferPairIds,
      rejectTransfer,
      persistenceSupported,
      persistenceEnabled,
      persistenceBusy,
      setPersistence,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

export function useDashboardData() {
  const { filters, ignoredIds, ready, transactionCount, dashboardPrefs, transferIds } = useApp()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [grossStats, setGrossStats] = useState<DashboardStats | null>(null)
  const [monthly, setMonthly] = useState<MonthlyFlow[]>([])
  const [merchants, setMerchants] = useState<TopMerchant[]>([])
  const [creditMerchants, setCreditMerchants] = useState<TopMerchant[]>([])
  const [breakdown, setBreakdown] = useState<AccountBreakdown[]>([])
  const [loading, setLoading] = useState(false)

  const excludeTransferIds = useMemo(
    () => (dashboardPrefs.exclude_transfers ? transferIds : EMPTY_EXCLUDE_IDS),
    [dashboardPrefs.exclude_transfers, transferIds],
  )
  const merchantMode = dashboardPrefs.merchant_mode

  useEffect(() => {
    if (!ready || transactionCount === 0) {
      setStats(null)
      setGrossStats(null)
      setMonthly([])
      setMerchants([])
      setCreditMerchants([])
      setBreakdown([])
      return
    }

    let cancelled = false
    setLoading(true)
    void loadDuckDb()
      .then((db) =>
        Promise.all([
          db.getDashboardStats(filters, ignoredIds, excludeTransferIds),
          dashboardPrefs.exclude_transfers && transferIds.length > 0
            ? db.getDashboardStats(filters, ignoredIds, EMPTY_EXCLUDE_IDS)
            : Promise.resolve(null),
          db.getMonthlyFlow(filters, ignoredIds, excludeTransferIds),
          db.getTopMerchants(filters, ignoredIds, 10, {
            excludeTransactionIds: excludeTransferIds,
            merchantMode,
          }),
          db.getTopMerchantsByCredit(filters, ignoredIds, 10, {
            excludeTransactionIds: excludeTransferIds,
            merchantMode,
          }),
          db.getAccountBreakdown(filters, ignoredIds, excludeTransferIds),
        ]),
      )
      .then(([s, gross, m, t, c, b]) => {
        if (cancelled) return
        setStats(s)
        setGrossStats(gross)
        setMonthly(m)
        setMerchants(t)
        setCreditMerchants(c)
        setBreakdown(b)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [filters, ignoredIds, ready, transactionCount, excludeTransferIds, merchantMode, dashboardPrefs.exclude_transfers, transferIds.length])

  return { stats, grossStats, monthly, merchants, creditMerchants, breakdown, loading, initialLoading: loading && stats === null }
}

export function useTransactions() {
  const { filters, ignoredIds, ready, transactionCount } = useApp()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!ready || transactionCount === 0) {
      setTransactions([])
      return
    }

    const timer = setTimeout(() => {
      setLoading(true)
      void loadDuckDb()
        .then((db) => db.queryTransactions(filters, ignoredIds, 50000))
        .then(setTransactions)
        .finally(() => setLoading(false))
    }, 150)

    return () => clearTimeout(timer)
  }, [filters, ignoredIds, ready, transactionCount])

  return { transactions, loading }
}
