import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectDuplicates, countPendingDuplicates } from '../src/lib/duplicates.ts'
import { tx } from './helpers.ts'

test('detectDuplicates groups exact duplicates', () => {
  const groups = detectDuplicates([
    tx({ id: 'a', description: 'Coffee', date: '2024-01-01', amount: -5 }),
    tx({ id: 'b', description: 'Coffee', date: '2024-01-01', amount: -5 }),
  ])
  assert.equal(groups.length, 1)
  assert.deepEqual(groups[0].transaction_ids.sort(), ['a', 'b'])
})

test('detectDuplicates groups fuzzy near-duplicates (same date/amount/account)', () => {
  const groups = detectDuplicates([
    tx({ id: 'a', description: 'Amazon Purchase 123', date: '2024-01-01', amount: -50 }),
    tx({ id: 'b', description: 'Amazon Purchase 124', date: '2024-01-01', amount: -50 }),
  ])
  assert.equal(groups.length, 1)
  assert.equal(groups[0].id.startsWith('dup-fuzzy'), true)
})

test('detectDuplicates does not group across different accounts', () => {
  const groups = detectDuplicates([
    tx({ id: 'a', account_id: 'acct-a', description: 'Coffee', date: '2024-01-01', amount: -5 }),
    tx({ id: 'b', account_id: 'acct-b', description: 'Coffee', date: '2024-01-01', amount: -5 }),
  ])
  assert.equal(groups.length, 0)
})

test('detectDuplicates does not group different dates or amounts', () => {
  const groups = detectDuplicates([
    tx({ id: 'a', description: 'Coffee', date: '2024-01-01', amount: -5 }),
    tx({ id: 'b', description: 'Coffee', date: '2024-01-02', amount: -5 }),
    tx({ id: 'c', description: 'Coffee', date: '2024-01-01', amount: -6 }),
  ])
  assert.equal(groups.length, 0)
})

test('countPendingDuplicates counts only pending groups', () => {
  const groups = detectDuplicates([
    tx({ id: 'a', description: 'Coffee', date: '2024-01-01', amount: -5 }),
    tx({ id: 'b', description: 'Coffee', date: '2024-01-01', amount: -5 }),
  ])
  assert.equal(countPendingDuplicates(groups), 1)
  groups[0].status = 'keep_both'
  assert.equal(countPendingDuplicates(groups), 0)
})
