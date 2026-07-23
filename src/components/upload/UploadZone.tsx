import { useCallback, useRef, useState } from 'react'
import { Upload, FileSpreadsheet, FileText, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { detectFileType, parseCsvFile, readFileAsArrayBuffer, readFileAsText } from '@/lib/parsers/csv'
import type { ImportFileType } from '@/lib/parsers/csv'
import { ColumnMapper } from '@/components/upload/ColumnMapper'
import { PdfPreview } from '@/components/upload/PdfPreview'
import { AccountPicker } from '@/components/accounts/AccountPicker'
import { ImportSteps } from '@/components/upload/ImportSteps'
import { suggestAccountName, detectCurrencyFromText } from '@/lib/import-helpers'
import type { ColumnMapping } from '@/types/transaction'

type UploadZoneProps = {
  compact?: boolean
}

/** Upper bounds on file size to avoid freezing the tab or exhausting memory. */
const MAX_SIZE_BYTES: Record<ImportFileType, number> = {
  csv: 25 * 1024 * 1024,
  excel: 25 * 1024 * 1024,
  ofx: 25 * 1024 * 1024,
  pdf: 50 * 1024 * 1024,
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${bytes} B`
}

export function UploadZone({ compact = false }: UploadZoneProps) {
  const {
    pendingImports,
    addPendingImport,
    updatePendingImport,
    removePendingImport,
    importCsv,
    importPdf,
    accounts,
  } = useApp()
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(
    async (file: File) => {
      const fileType = detectFileType(file)
      const id = addPendingImport(file, fileType)

      const maxSize = MAX_SIZE_BYTES[fileType]
      if (file.size > maxSize) {
        updatePendingImport(id, {
          status: 'error',
          error: `File is too large (${formatBytes(file.size)}). The limit for ${fileType.toUpperCase()} files is ${formatBytes(maxSize)}.`,
        })
        return
      }

      updatePendingImport(id, { status: 'parsing', parseProgress: 0 })

      try {
        if (fileType === 'csv') {
          const content = await readFileAsText(file)
          const result = await parseCsvFile(content, file.name)
          updatePendingImport(id, { status: 'ready', parseResult: result })
        } else if (fileType === 'excel') {
          const [{ excelToCsv }, buffer] = await Promise.all([
            import('@/lib/parsers/excel'),
            readFileAsArrayBuffer(file),
          ])
          const csvContent = await excelToCsv(buffer)
          const result = await parseCsvFile(csvContent, file.name)
          updatePendingImport(id, { status: 'ready', parseResult: result, csvContent })
        } else if (fileType === 'ofx') {
          const [{ parseOfxText }, content] = await Promise.all([
            import('@/lib/parsers/ofx'),
            readFileAsText(file),
          ])
          const output = parseOfxText(content, file.name)
          updatePendingImport(id, {
            status: 'ready',
            pdfRows: output.rows,
            pdfMeta: {
              page_count: 0,
              has_text_layer: true,
              raw_text_preview: output.raw_text_preview,
            },
          })
        } else {
          const [{ parsePdfBuffer, runOcrOnPdf, parseOcrText }, buffer] = await Promise.all([
            import('@/lib/parsers/pdf'),
            readFileAsArrayBuffer(file),
          ])
          let output = await parsePdfBuffer(buffer, file.name, (page, total) => {
            updatePendingImport(id, {
              status: 'parsing',
              parseProgress: Math.round((page / total) * 100),
              error: `Reading page ${page} of ${total}…`,
            })
          })

          if (!output.has_text_layer || output.rows.length === 0) {
            updatePendingImport(id, {
              status: 'parsing',
              parseProgress: 0,
              error: 'Running OCR — this may take a while…',
            })
            const ocrText = await runOcrOnPdf(buffer, () => {})
            output = await parseOcrText(ocrText, file.name)
          }

          updatePendingImport(id, {
            status: 'ready',
            pdfRows: output.rows,
            pdfMeta: {
              page_count: output.page_count,
              has_text_layer: output.has_text_layer,
              raw_text_preview: output.raw_text_preview,
            },
          })
        }
      } catch (err) {
        updatePendingImport(id, {
          status: 'error',
          error: err instanceof Error ? err.message : 'Parse failed',
        })
      }
    },
    [addPendingImport, updatePendingImport],
  )

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return
      Array.from(files).forEach(processFile)
    },
    [processFile],
  )

  const activeImports = pendingImports.filter((p) => p.status !== 'done')
  const wizardStep = activeImports.some((p) => p.status === 'ready' || p.status === 'importing')
    ? 2
    : activeImports.some((p) => p.status === 'parsing')
      ? 1
      : 1

  return (
    <div className="space-y-5">
      {!compact && activeImports.length > 0 && <ImportSteps current={wizardStep as 1 | 2 | 3} />}

      <Card
        className={cn(
          'border-dashed transition-colors',
          dragOver && 'border-[var(--color-primary)] bg-[var(--color-accent)]',
          compact && 'border-solid',
        )}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          handleFiles(e.dataTransfer.files)
        }}
      >
        <CardContent className={cn('flex flex-col items-center justify-center', compact ? 'py-8' : 'py-12')}>
          <Upload className="mb-3 h-9 w-9 text-[var(--color-muted-foreground)]" />
          <p className="mb-1 font-medium">{compact ? 'Add another statement' : 'Drop your bank statement here'}</p>
          <p className="mb-4 text-center text-sm text-[var(--color-muted-foreground)]">
            CSV, Excel, PDF & OFX/QFX · Nothing leaves your browser
          </p>
          <Button onClick={() => inputRef.current?.click()} variant={compact ? 'outline' : 'default'}>
            Choose file
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.tsv,.pdf,.xlsx,.xls,.ofx,.qfx,text/csv,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </CardContent>
      </Card>

      {activeImports.map((imp) => (
        <ImportCard
          key={imp.id}
          imp={imp}
          hasAccounts={accounts.length > 0}
          onRemove={() => removePendingImport(imp.id)}
          onImportCsv={async (accountId, mapping) => {
            const content = imp.csvContent ?? (await readFileAsText(imp.file))
            await importCsv(imp.id, accountId, mapping, content)
          }}
          onImportPdf={async (accountId, rows) => {
            await importPdf(imp.id, accountId, rows)
          }}
        />
      ))}
    </div>
  )
}

type ImportCardProps = {
  imp: {
    id: string
    file: File
    fileType: ImportFileType
    status: string
    parseProgress?: number
    parseResult?: import('@/types/transaction').ParseResult
    csvContent?: string
    pdfRows?: { date: string; description: string; amount: number; raw_source: string }[]
    pdfMeta?: { page_count: number; has_text_layer: boolean; raw_text_preview: string }
    error?: string
  }
  hasAccounts: boolean
  onRemove: () => void
  onImportCsv: (accountId: string, mapping: ColumnMapping) => Promise<void>
  onImportPdf: (
    accountId: string,
    rows: { date: string; description: string; amount: number; raw_source: string }[],
  ) => Promise<void>
}

function ImportCard({ imp, hasAccounts, onRemove, onImportCsv, onImportPdf }: ImportCardProps) {
  const [accountId, setAccountId] = useState('')
  const [mapping, setMapping] = useState<ColumnMapping | null>(null)
  const [importing, setImporting] = useState(false)

  const suggestedName = suggestAccountName(imp.file.name)
  const suggestedCurrency = detectCurrencyFromText(
    imp.pdfMeta?.raw_text_preview ?? imp.parseResult?.preview_rows?.[0]?.Description ?? '',
  )

  const isCsvLike = imp.fileType === 'csv' || imp.fileType === 'excel'
  const isRowsLike = imp.fileType === 'pdf' || imp.fileType === 'ofx'

  const rowCount = imp.pdfRows?.length ?? imp.parseResult?.total_rows ?? 0
  const canImport =
    accountId &&
    ((isCsvLike && mapping) || (isRowsLike && imp.pdfRows && imp.pdfRows.length > 0))

  const handleImport = async () => {
    if (!canImport) return
    setImporting(true)
    try {
      if (isCsvLike && mapping) {
        await onImportCsv(accountId, mapping)
      } else if (imp.pdfRows) {
        await onImportPdf(accountId, imp.pdfRows)
      }
    } finally {
      setImporting(false)
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-[var(--color-border)] bg-[var(--color-muted)]/30 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {isCsvLike ? (
              <FileSpreadsheet className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
            ) : (
              <FileText
                className={cn(
                  'mt-0.5 h-5 w-5 shrink-0',
                  imp.fileType === 'ofx' ? 'text-blue-600' : 'text-red-600',
                )}
              />
            )}
            <div>
              <CardTitle className="text-base">{imp.file.name}</CardTitle>
              <CardDescription>
                {imp.status === 'ready' && (
                  <span className="inline-flex items-center gap-1 text-green-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {rowCount.toLocaleString()} transactions ready
                  </span>
                )}
                {imp.status === 'parsing' && 'Analyzing…'}
                {imp.status === 'error' && 'Could not parse file'}
                {imp.status === 'importing' && 'Saving to database…'}
              </CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onRemove}>
            Remove
          </Button>
        </div>
      </CardHeader>

      {imp.status === 'parsing' && (
        <CardContent className="pt-5">
          <Progress value={imp.parseProgress ?? 15} className="mb-2" />
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {imp.error ?? 'Analyzing file…'}
          </p>
        </CardContent>
      )}

      {imp.status === 'error' && (
        <CardContent className="flex items-center gap-2 pt-5 text-[var(--color-destructive)]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="text-sm">{imp.error}</span>
        </CardContent>
      )}

      {imp.status === 'ready' && (
        <CardContent className="space-y-5 pt-5">
          {isRowsLike && imp.pdfRows && imp.pdfMeta && (
            <PdfPreview
              rows={imp.pdfRows}
              meta={imp.pdfMeta}
              sourceLabel={imp.fileType === 'ofx' ? 'Structured OFX/QFX' : undefined}
            />
          )}

          {isCsvLike && imp.parseResult && (
            <ColumnMapper
              headers={imp.parseResult.headers}
              previewRows={imp.parseResult.preview_rows}
              suggestedMapping={imp.parseResult.suggested_mapping}
              onMappingChange={setMapping}
            />
          )}

          <AccountPicker
            value={accountId}
            onChange={setAccountId}
            suggestedName={suggestedName}
            suggestedCurrency={suggestedCurrency}
            preferCreate={!hasAccounts}
          />

          <Button onClick={handleImport} disabled={importing || !canImport} className="w-full sm:w-auto" size="lg">
            {importing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing {rowCount.toLocaleString()} transactions…
              </>
            ) : (
              `Import ${rowCount.toLocaleString()} transactions`
            )}
          </Button>
        </CardContent>
      )}

      {imp.status === 'importing' && (
        <CardContent className="flex items-center gap-2 pt-5 text-[var(--color-muted-foreground)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Importing {rowCount.toLocaleString()} transactions…</span>
        </CardContent>
      )}
    </Card>
  )
}
