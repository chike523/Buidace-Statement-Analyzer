import { useState } from 'react'
import { FileDown, Copy, Check, Loader2 } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { Button } from '@/components/ui/button'
import { generateReportMarkdown, reportFilename } from '@/lib/report'
import { copyTextToClipboard, downloadTextFile } from '@/lib/download'

export function ExportReportButton() {
  const {
    accounts,
    importBatches,
    filters,
    ignoredIds,
    dashboardPrefs,
    transferPairs,
    transferIds,
    rejectedTransferPairIds,
    duplicateGroups,
    recurringPatterns,
    transactionCount,
  } = useApp()

  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  if (transactionCount === 0) return null

  const buildInput = () => ({
    accounts,
    importBatches,
    filters,
    ignoredIds,
    dashboardPrefs,
    transferPairs,
    transferIds,
    rejectedTransferPairIds,
    duplicateGroups,
    recurringPatterns,
  })

  const handleDownload = async () => {
    setLoading(true)
    try {
      const markdown = await generateReportMarkdown(buildInput())
      downloadTextFile(markdown, reportFilename())
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    setLoading(true)
    try {
      const markdown = await generateReportMarkdown(buildInput())
      const ok = await copyTextToClipboard(markdown)
      if (ok) {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1 sm:gap-2">
      <Button
        variant="outline"
        size="sm"
        className="min-h-9"
        onClick={handleDownload}
        disabled={loading}
        aria-label="Export report"
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin sm:mr-1.5" />
        ) : (
          <FileDown className="h-3.5 w-3.5 sm:mr-1.5" />
        )}
        <span className="hidden sm:inline">Export report</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="min-h-9"
        onClick={handleCopy}
        disabled={loading}
        aria-label={copied ? 'Copied' : 'Copy for AI'}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-green-600 sm:mr-1.5" />
        ) : (
          <Copy className="h-3.5 w-3.5 sm:mr-1.5" />
        )}
        <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy for AI'}</span>
      </Button>
    </div>
  )
}
