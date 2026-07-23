import { Suspense, lazy } from 'react'
import { Loader2 } from 'lucide-react'
import { ImportSteps } from '@/components/upload/ImportSteps'

const UploadZone = lazy(() =>
  import('@/components/upload/UploadZone').then((m) => ({ default: m.UploadZone })),
)

export function WelcomeHero() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Analyze your bank statements
        </h2>
        <p className="mt-2 text-[var(--color-muted-foreground)]">
          Import a CSV or PDF to explore spending, income, and recurring patterns.
        </p>
        <p className="mt-4 text-xs text-[var(--color-muted-foreground)]">
          Processed in your browser. Nothing is uploaded.
        </p>
      </div>

      <ImportSteps current={1} className="mb-6 justify-center" />
      <Suspense
        fallback={
          <div className="flex items-center justify-center rounded-lg border border-dashed border-[var(--color-border)] py-16 text-[var(--color-muted-foreground)]">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        }
      >
        <UploadZone />
      </Suspense>
    </div>
  )
}
