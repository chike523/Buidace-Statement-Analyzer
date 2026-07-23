import { detectDuplicates } from '@/lib/duplicates'
import { detectRecurringPayments } from '@/lib/recurring'
import { detectInternalTransfers } from '@/lib/transfers'
import type {
  DuplicateGroup,
  RecurringPattern,
  Transaction,
  TransferPair,
} from '@/types/transaction'

export type AnalysisRequest = {
  allTransactions: Transaction[]
  visibleTransactions: Transaction[]
}

export type AnalysisResponse =
  | {
      type: 'result'
      duplicateGroups: DuplicateGroup[]
      recurringPatterns: RecurringPattern[]
      transferPairs: TransferPair[]
    }
  | { type: 'error'; message: string }

self.onmessage = (event: MessageEvent<AnalysisRequest>) => {
  try {
    const { allTransactions, visibleTransactions } = event.data
    const response: AnalysisResponse = {
      type: 'result',
      duplicateGroups: detectDuplicates(allTransactions),
      recurringPatterns: detectRecurringPayments(visibleTransactions),
      transferPairs: detectInternalTransfers(allTransactions),
    }
    self.postMessage(response)
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : 'Analysis failed',
    } satisfies AnalysisResponse)
  }
}
