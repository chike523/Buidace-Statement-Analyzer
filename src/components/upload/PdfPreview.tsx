import { formatCurrency, formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

type PdfPreviewProps = {
  rows: { date: string; description: string; amount: number; raw_source?: string }[]
  meta: { page_count: number; has_text_layer: boolean; raw_text_preview: string }
}

export function PdfPreview({ rows, meta }: PdfPreviewProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{meta.page_count} page(s)</Badge>
        <Badge variant={meta.has_text_layer ? 'default' : 'secondary'}>
          {meta.has_text_layer ? 'Digital text layer' : 'OCR extracted'}
        </Badge>
        <Badge variant="outline">{rows.length} transactions found</Badge>
      </div>

      {rows.length === 0 && (
        <p className="text-sm text-[var(--color-destructive)]">
          No transactions detected. Try exporting CSV from your bank instead, or check that the PDF
          contains a transaction table.
        </p>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-[var(--color-muted)]">
                <th className="px-3 py-2 text-left font-medium">Date</th>
                <th className="px-3 py-2 text-left font-medium">Description</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 20).map((row, i) => (
                <tr key={i} className="border-b">
                  <td className="whitespace-nowrap px-3 py-2">{formatDate(row.date)}</td>
                  <td className="max-w-xs truncate px-3 py-2">{row.description}</td>
                  <td
                    className={`whitespace-nowrap px-3 py-2 text-right ${
                      row.amount < 0 ? 'text-[var(--color-destructive)]' : 'text-green-600'
                    }`}
                  >
                    {formatCurrency(row.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 20 && (
            <p className="px-3 py-2 text-xs text-[var(--color-muted-foreground)]">
              Showing 20 of {rows.length} detected transactions
            </p>
          )}
        </div>
      )}

      <details className="text-xs">
        <summary className="cursor-pointer text-[var(--color-muted-foreground)]">
          Raw text preview
        </summary>
        <pre className="mt-2 max-h-40 overflow-auto rounded bg-[var(--color-muted)] p-3 whitespace-pre-wrap">
          {meta.raw_text_preview}
        </pre>
      </details>
    </div>
  )
}
