import { DuplicatePanel } from '@/components/duplicates/DuplicatePanel'
import { TransfersPanel } from '@/components/transfers/TransfersPanel'

export function ReviewPanel() {
  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-4 text-base font-semibold">Duplicates</h2>
        <DuplicatePanel embedded />
      </section>
      <section>
        <h2 className="mb-4 text-base font-semibold">Internal transfers</h2>
        <TransfersPanel embedded />
      </section>
    </div>
  )
}
