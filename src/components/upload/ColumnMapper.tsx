import { useEffect, useState } from 'react'
import type { ColumnMapping } from '@/types/transaction'
import { detectColumnMapping, getMappingConfidence, isMappingComplete } from '@/lib/column-detect'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

type ColumnMapperProps = {
  headers: string[]
  previewRows: Record<string, string>[]
  suggestedMapping: Partial<ColumnMapping>
  onMappingChange: (mapping: ColumnMapping | null) => void
}

const FIELD_LABELS: { key: keyof ColumnMapping; label: string; required?: boolean }[] = [
  { key: 'date', label: 'Date', required: true },
  { key: 'description', label: 'Description', required: true },
  { key: 'amount', label: 'Amount' },
  { key: 'debit', label: 'Debit' },
  { key: 'credit', label: 'Credit' },
  { key: 'balance', label: 'Balance' },
]

export function ColumnMapper({
  headers,
  previewRows,
  suggestedMapping,
  onMappingChange,
}: ColumnMapperProps) {
  const [mapping, setMapping] = useState<Partial<ColumnMapping>>(suggestedMapping)

  useEffect(() => {
    setMapping(suggestedMapping)
  }, [suggestedMapping])

  useEffect(() => {
    if (isMappingComplete(mapping)) {
      onMappingChange(mapping as ColumnMapping)
    } else {
      onMappingChange(null)
    }
  }, [mapping, onMappingChange])

  const confidence = getMappingConfidence(mapping)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Column mapping</h4>
        <Badge variant={confidence >= 80 ? 'default' : 'secondary'}>
          {confidence}% confidence
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FIELD_LABELS.map(({ key, label, required }) => (
          <div key={key} className="space-y-1">
            <label className="text-xs font-medium text-[var(--color-muted-foreground)]">
              {label}
              {required && ' *'}
            </label>
            <Select
              value={mapping[key] ?? ''}
              onChange={(e) =>
                setMapping((prev) => ({
                  ...prev,
                  [key]: e.target.value || undefined,
                }))
              }
            >
              <option value="">— Select —</option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </Select>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-md border border-[var(--color-border)]">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-[var(--color-muted)]">
              {headers.map((h) => (
                <th key={h} className="px-3 py-2 text-left font-medium">
                  {h}
                  {Object.entries(mapping).find(([, v]) => v === h) && (
                    <span className="ml-1 text-[var(--color-primary)]">●</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.slice(0, 5).map((row, i) => (
              <tr key={i} className="border-b">
                {headers.map((h) => (
                  <td key={h} className="max-w-[200px] truncate px-3 py-2">
                    {row[h]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!isMappingComplete(mapping) && (
        <p className="text-xs text-[var(--color-muted-foreground)]">
          Map date, description, and either amount or debit/credit columns to continue.
        </p>
      )}
    </div>
  )
}

export { detectColumnMapping }
