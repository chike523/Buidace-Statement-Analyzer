import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectRecurringPayments } from '../src/lib/recurring.ts'
import { tx } from './helpers.ts'

test('detectRecurringPayments finds a monthly subscription', () => {
  const patterns = detectRecurringPayments([
    tx({ description: 'Netflix', date: '2024-01-01', amount: -15.99 }),
    tx({ description: 'Netflix', date: '2024-01-31', amount: -15.99 }),
    tx({ description: 'Netflix', date: '2024-03-01', amount: -15.99 }),
  ])
  assert.equal(patterns.length, 1)
  assert.equal(patterns[0].interval, 'monthly')
  assert.equal(patterns[0].amount, -15.99)
})

test('detectRecurringPayments finds a weekly pattern', () => {
  const patterns = detectRecurringPayments([
    tx({ description: 'Gym', date: '2024-01-01', amount: -10 }),
    tx({ description: 'Gym', date: '2024-01-08', amount: -10 }),
    tx({ description: 'Gym', date: '2024-01-15', amount: -10 }),
    tx({ description: 'Gym', date: '2024-01-22', amount: -10 }),
  ])
  assert.equal(patterns.length, 1)
  assert.equal(patterns[0].interval, 'weekly')
})

test('detectRecurringPayments requires at least 3 occurrences', () => {
  const patterns = detectRecurringPayments([
    tx({ description: 'Netflix', date: '2024-01-01', amount: -15.99 }),
    tx({ description: 'Netflix', date: '2024-01-31', amount: -15.99 }),
  ])
  assert.equal(patterns.length, 0)
})

test('detectRecurringPayments rejects high amount variance', () => {
  const patterns = detectRecurringPayments([
    tx({ description: 'Shopping', date: '2024-01-01', amount: -10 }),
    tx({ description: 'Shopping', date: '2024-01-31', amount: -50 }),
    tx({ description: 'Shopping', date: '2024-03-01', amount: -100 }),
  ])
  assert.equal(patterns.length, 0)
})

test('detectRecurringPayments ignores credits (income)', () => {
  const patterns = detectRecurringPayments([
    tx({ description: 'Salary', date: '2024-01-01', amount: 3000 }),
    tx({ description: 'Salary', date: '2024-01-31', amount: 3000 }),
    tx({ description: 'Salary', date: '2024-03-01', amount: 3000 }),
  ])
  assert.equal(patterns.length, 0)
})
