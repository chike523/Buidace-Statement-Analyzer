import type { ImportSummary } from '@/lib/import-helpers'
import { Toast } from '@/components/ui/toast'

type ImportSuccessToastProps = {
  summary: ImportSummary
  onDismiss: () => void
  onReviewDuplicates?: () => void
}

export function ImportSuccessToast({ summary, onDismiss, onReviewDuplicates }: ImportSuccessToastProps) {
  const detail = [
    summary.filename,
    summary.skipped_count > 0 ? `${summary.skipped_count} rows skipped` : null,
    summary.duplicate_count > 0 ? `${summary.duplicate_count} possible duplicates` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Toast
      message={`${summary.row_count.toLocaleString()} transactions imported to ${summary.account_name}`}
      detail={detail || undefined}
      action={
        summary.duplicate_count > 0 && onReviewDuplicates
          ? { label: 'Review duplicates', onClick: onReviewDuplicates }
          : undefined
      }
      onDismiss={onDismiss}
    />
  )
}
