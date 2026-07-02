import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ToastProps = {
  message: string
  detail?: string
  action?: { label: string; onClick: () => void }
  onDismiss: () => void
  className?: string
}

export function Toast({ message, detail, action, onDismiss, className }: ToastProps) {
  return (
    <div
      role="status"
      className={cn(
        'fixed bottom-4 right-4 z-50 flex max-w-sm items-start gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-lg',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{message}</p>
        {detail && (
          <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">{detail}</p>
        )}
        {action && (
          <Button variant="ghost" size="sm" className="mt-1 h-auto px-0 text-xs" onClick={action.onClick}>
            {action.label}
          </Button>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
