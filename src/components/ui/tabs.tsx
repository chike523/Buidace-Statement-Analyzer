import { cn } from '@/lib/utils'

type TabsProps = {
  tabs: { id: string; label: string }[]
  active: string
  onChange: (id: string) => void
  className?: string
}

export function Tabs({ tabs, active, onChange, className }: TabsProps) {
  return (
    <div
      className={cn(
        '-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      <div className="flex min-w-full gap-1 rounded-lg bg-[var(--color-muted)] p-1 sm:min-w-0 sm:flex-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              'min-h-10 shrink-0 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors sm:min-h-0 sm:flex-1 sm:py-1.5',
              active === tab.id
                ? 'bg-[var(--color-card)] text-[var(--color-foreground)] shadow-sm'
                : 'text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}
