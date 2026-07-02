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
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={handleDownload} disabled={loading}>
        {loading ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <FileDown className="mr-1.5 h-3.5 w-3.5" />
        )}
        Export report
      </Button>
      <Button variant="ghost" size="sm" onClick={handleCopy} disabled={loading}>
        {copied ? (
          <Check className="mr-1.5 h-3.5 w-3.5 text-green-600" />
        ) : (
          <Copy className="mr-1.5 h-3.5 w-3.5" />
        )}
        {copied ? 'Copied' : 'Copy for AI'}
      </Button>
    </div>
  )
}
