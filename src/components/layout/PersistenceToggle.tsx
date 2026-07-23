import { HardDrive, Loader2 } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { Switch } from '@/components/ui/switch'

export function PersistenceToggle() {
  const { persistenceSupported, persistenceEnabled, persistenceBusy, setPersistence } = useApp()

  if (!persistenceSupported) return null

  return (
    <div
      className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]"
      title={
        persistenceEnabled
          ? 'Your data is saved in this browser and will still be here after a refresh. It never leaves your device.'
          : 'Data is kept only for this session. Turn on to save it in this browser (on-device only).'
      }
    >
      {persistenceBusy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <HardDrive className="h-3.5 w-3.5" />
      )}
      <label htmlFor="persist-toggle" className="hidden cursor-pointer sm:inline">
        Save on device
      </label>
      <Switch
        id="persist-toggle"
        checked={persistenceEnabled}
        disabled={persistenceBusy}
        onCheckedChange={(checked) => {
          void setPersistence(checked)
        }}
      />
    </div>
  )
}
