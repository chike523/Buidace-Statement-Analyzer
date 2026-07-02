import { cn } from '@/lib/utils'

type BadgeProps = {
  children: React.ReactNode
  variant?: 'default' | 'secondary' | 'destructive' | 'outline'
  className?: string
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variant === 'default' && 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]',
        variant === 'secondary' && 'bg-[var(--color-secondary)] text-[var(--color-secondary-foreground)]',
        variant === 'destructive' && 'bg-[var(--color-destructive)] text-[var(--color-destructive-foreground)]',
        variant === 'outline' && 'border border-[var(--color-border)] text-[var(--color-foreground)]',
        className,
      )}
    >
      {children}
    </span>
  )
}
