import { Suspense, lazy, useEffect } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { AppProvider, useApp } from '@/context/AppContext'
import { Tabs } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { WelcomeHero } from '@/components/onboarding/WelcomeHero'
import { ImportSuccessToast } from '@/components/layout/AppChrome'
import { PersistenceToggle } from '@/components/layout/PersistenceToggle'
import { countPendingDuplicates } from '@/lib/duplicates'

const UploadZone = lazy(() =>
  import('@/components/upload/UploadZone').then((m) => ({ default: m.UploadZone })),
)
const FilterBar = lazy(() =>
  import('@/components/filters/FilterBar').then((m) => ({ default: m.FilterBar })),
)
const TransactionTable = lazy(() =>
  import('@/components/table/TransactionTable').then((m) => ({ default: m.TransactionTable })),
)
const Dashboard = lazy(() =>
  import('@/components/dashboard/Dashboard').then((m) => ({ default: m.Dashboard })),
)
const RecurringPanel = lazy(() =>
  import('@/components/recurring/RecurringPanel').then((m) => ({ default: m.RecurringPanel })),
)
const ReviewPanel = lazy(() =>
  import('@/components/review/ReviewPanel').then((m) => ({ default: m.ReviewPanel })),
)
const ExportReportButton = lazy(() =>
  import('@/components/report/ExportReportButton').then((m) => ({ default: m.ExportReportButton })),
)

function PanelFallback() {
  return (
    <div className="flex items-center justify-center py-16 text-[var(--color-muted-foreground)]">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  )
}

function AppContent() {
  const {
    ready,
    transactionCount,
    duplicateGroups,
    recurringPatterns,
    activeTab,
    setActiveTab,
    importSummary,
    dismissImportSummary,
    accounts,
  } = useApp()

  const pendingDupes = countPendingDuplicates(duplicateGroups)
  const hasData = transactionCount > 0

  useEffect(() => {
    if (!importSummary) return
    const timer = setTimeout(dismissImportSummary, 6000)
    return () => clearTimeout(timer)
  }, [importSummary, dismissImportSummary])

  const tabs = [
    { id: 'dashboard', label: 'Overview' },
    { id: 'transactions', label: 'Activity' },
    {
      id: 'review',
      label: pendingDupes > 0 ? `Review (${pendingDupes})` : 'Review',
    },
    {
      id: 'recurring',
      label:
        recurringPatterns.length > 0 ? `Bills (${recurringPatterns.length})` : 'Bills',
    },
  ]

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-[var(--color-muted-foreground)]">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p>Starting…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-[env(safe-area-inset-bottom)]">
      <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-card)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--color-card)]/80">
        <div className="mx-auto flex max-w-7xl items-start justify-between gap-3 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:items-center sm:gap-4 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight sm:text-xl">Statement Analyzer</h1>
            <p className="truncate text-xs text-[var(--color-muted-foreground)] sm:text-sm">
              {hasData
                ? `${accounts.length} account${accounts.length !== 1 ? 's' : ''} · ${transactionCount.toLocaleString()} transactions`
                : 'Import a statement to get started'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <PersistenceToggle />
            {hasData && (
              <>
                <Suspense fallback={null}>
                  <ExportReportButton />
                </Suspense>
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-9"
                  onClick={() => setActiveTab('upload')}
                >
                  <Upload className="h-3.5 w-3.5 sm:mr-1.5" />
                  <span className="hidden sm:inline">Import</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
        {!hasData ? (
          <WelcomeHero />
        ) : (
          <>
            <div className="mb-6">
              <Tabs
                tabs={tabs}
                active={activeTab === 'upload' ? '' : activeTab}
                onChange={setActiveTab}
              />
            </div>

            <Suspense fallback={<PanelFallback />}>
              {activeTab === 'upload' && (
                <div className="mx-auto max-w-2xl space-y-4">
                  <button
                    type="button"
                    onClick={() => setActiveTab('dashboard')}
                    className="text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
                  >
                    ← Back to overview
                  </button>
                  <UploadZone compact />
                </div>
              )}

              {activeTab === 'dashboard' && (
                <div className="space-y-6">
                  <FilterBar />
                  <Dashboard />
                </div>
              )}

              {activeTab === 'transactions' && (
                <div className="space-y-6">
                  <FilterBar />
                  <TransactionTable />
                </div>
              )}

              {activeTab === 'review' && <ReviewPanel />}
              {activeTab === 'recurring' && <RecurringPanel />}
            </Suspense>
          </>
        )}
      </main>

      {importSummary && (
        <ImportSuccessToast
          summary={importSummary}
          onDismiss={dismissImportSummary}
          onReviewDuplicates={() => {
            dismissImportSummary()
            setActiveTab('review')
          }}
        />
      )}
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  )
}
