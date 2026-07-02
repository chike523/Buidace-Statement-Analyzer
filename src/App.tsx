import { useEffect } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { AppProvider, useApp } from '@/context/AppContext'
import { Tabs } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { UploadZone } from '@/components/upload/UploadZone'
import { FilterBar } from '@/components/filters/FilterBar'
import { TransactionTable } from '@/components/table/TransactionTable'
import { Dashboard } from '@/components/dashboard/Dashboard'
import { RecurringPanel } from '@/components/recurring/RecurringPanel'
import { ReviewPanel } from '@/components/review/ReviewPanel'
import { WelcomeHero } from '@/components/onboarding/WelcomeHero'
import { ImportSuccessToast } from '@/components/layout/AppChrome'
import { ExportReportButton } from '@/components/report/ExportReportButton'
import { countPendingDuplicates } from '@/lib/duplicates'

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
    { id: 'transactions', label: 'Transactions' },
    {
      id: 'review',
      label: pendingDupes > 0 ? `Review (${pendingDupes})` : 'Review',
    },
    {
      id: 'recurring',
      label:
        recurringPatterns.length > 0 ? `Recurring (${recurringPatterns.length})` : 'Recurring',
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
    <div className="min-h-screen">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Statement Analyzer</h1>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              {hasData
                ? `${accounts.length} account${accounts.length !== 1 ? 's' : ''} · ${transactionCount.toLocaleString()} transactions`
                : 'Import a statement to get started'}
            </p>
          </div>
          {hasData && (
            <div className="flex items-center gap-2">
              <ExportReportButton />
              <Button variant="outline" size="sm" onClick={() => setActiveTab('upload')}>
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                Import
              </Button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
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
