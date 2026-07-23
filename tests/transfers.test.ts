import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectInternalTransfers, getTransferTransactionIds } from '../src/lib/transfers.ts'
import { tx } from './helpers.ts'

test('detectInternalTransfers pairs cross-account same-day equal amounts as high confidence', () => {
  const pairs = detectInternalTransfers([
    tx({ id: 'd', account_id: 'acct-a', description: 'Transfer to Savings', date: '2024-01-05', amount: -100 }),
    tx({ id: 'c', account_id: 'acct-b', description: 'Transfer from Checking', date: '2024-01-05', amount: 100 }),
  ])
  assert.equal(pairs.length, 1)
  assert.equal(pairs[0].confidence, 'high')
  assert.equal(pairs[0].debit_id, 'd')
  assert.equal(pairs[0].credit_id, 'c')
})

test('detectInternalTransfers does not pair same-account debit/credit without keyword', () => {
  const pairs = detectInternalTransfers([
    tx({ id: 'd', account_id: 'acct-a', description: 'Grocery', date: '2024-01-05', amount: -100 }),
    tx({ id: 'c', account_id: 'acct-a', description: 'Refund', date: '2024-01-05', amount: 100 }),
  ])
  assert.equal(pairs.length, 0)
})

test('detectInternalTransfers does not pair mismatched amounts', () => {
  const pairs = detectInternalTransfers([
    tx({ id: 'd', account_id: 'acct-a', description: 'Transfer to Savings', date: '2024-01-05', amount: -100 }),
    tx({ id: 'c', account_id: 'acct-b', description: 'Transfer from Checking', date: '2024-01-05', amount: 90 }),
  ])
  assert.equal(pairs.length, 0)
})

test('detectInternalTransfers does not pair when dates are far apart', () => {
  const pairs = detectInternalTransfers([
    tx({ id: 'd', account_id: 'acct-a', description: 'Transfer to Savings', date: '2024-01-05', amount: -100 }),
    tx({ id: 'c', account_id: 'acct-b', description: 'Transfer from Checking', date: '2024-01-20', amount: 100 }),
  ])
  assert.equal(pairs.length, 0)
})

test('getTransferTransactionIds excludes rejected pairs', () => {
  const pairs = detectInternalTransfers([
    tx({ id: 'd', account_id: 'acct-a', description: 'Transfer to Savings', date: '2024-01-05', amount: -100 }),
    tx({ id: 'c', account_id: 'acct-b', description: 'Transfer from Checking', date: '2024-01-05', amount: 100 }),
  ])
  const ids = getTransferTransactionIds(pairs, new Set())
  assert.equal(ids.has('d') && ids.has('c'), true)

  const rejected = getTransferTransactionIds(pairs, new Set([pairs[0].id]))
  assert.equal(rejected.size, 0)
})
