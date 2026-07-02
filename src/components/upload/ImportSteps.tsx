import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const STEPS = [
  { id: 1, label: 'Upload' },
  { id: 2, label: 'Review' },
  { id: 3, label: 'Import' },
]

type ImportStepsProps = {
  current: 1 | 2 | 3
  className?: string
}

export function ImportSteps({ current, className }: ImportStepsProps) {
  return (
    <ol className={cn('flex items-center gap-2', className)}>
      {STEPS.map((step, i) => {
        const done = step.id < current
        const active = step.id === current
        return (
          <li key={step.id} className="flex items-center gap-2">
            {i > 0 && <span className="h-px w-6 bg-[var(--color-border)] sm:w-10" />}
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                  done && 'bg-green-600 text-white',
                  active && !done && 'bg-[var(--color-primary)] text-white',
                  !done && !active && 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]',
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : step.id}
              </span>
              <span
                className={cn(
                  'hidden text-sm sm:inline',
                  active ? 'font-medium' : 'text-[var(--color-muted-foreground)]',
                )}
              >
                {step.label}
              </span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
