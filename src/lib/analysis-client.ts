import type { AnalysisRequest, AnalysisResponse } from '@/workers/analysis.worker'
import type {
  DuplicateGroup,
  RecurringPattern,
  Transaction,
  TransferPair,
} from '@/types/transaction'

let analysisWorker: Worker | null = null

function getWorker(): Worker {
  if (!analysisWorker) {
    analysisWorker = new Worker(new URL('@/workers/analysis.worker.ts', import.meta.url), {
      type: 'module',
    })
  }
  return analysisWorker
}

export type AnalysisResult = {
  duplicateGroups: DuplicateGroup[]
  recurringPatterns: RecurringPattern[]
  transferPairs: TransferPair[]
}

/**
 * Run duplicate/recurring/transfer detection in a Web Worker so the O(n^2)-ish
 * passes never block the main thread on large statements.
 */
export function runAnalysis(
  allTransactions: Transaction[],
  visibleTransactions: Transaction[],
): Promise<AnalysisResult> {
  return new Promise((resolve, reject) => {
    const worker = getWorker()
    const handler = (event: MessageEvent<AnalysisResponse>) => {
      worker.removeEventListener('message', handler)
      const data = event.data
      if (data.type === 'result') {
        resolve({
          duplicateGroups: data.duplicateGroups,
          recurringPatterns: data.recurringPatterns,
          transferPairs: data.transferPairs,
        })
      } else {
        reject(new Error(data.message))
      }
    }
    worker.addEventListener('message', handler)
    worker.postMessage({ allTransactions, visibleTransactions } satisfies AnalysisRequest)
  })
}
