import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  smartMerchantKey,
  smartMerchantLabel,
  aggregateMerchants,
} from '../src/lib/merchant.ts'

test('smartMerchantKey groups transfers by counterparty', () => {
  assert.equal(smartMerchantKey('Transfer to John Doe'), 'transfer:to:JOHN DOE')
  assert.equal(smartMerchantKey('Transfer from John Doe'), 'transfer:from:JOHN DOE')
})

test('smartMerchantKey classifies known fees', () => {
  assert.equal(smartMerchantKey('Stamp Duty'), 'fee:stamp duty')
  assert.equal(smartMerchantKey('SMS Charge'), 'fee:sms charge')
})

test('smartMerchantKey normalizes POS brand variants together', () => {
  const a = smartMerchantKey('POS Shoprite Lekki 1234')
  const b = smartMerchantKey('POS Shoprite Lekki 5678')
  assert.equal(a, b)
})

test('smartMerchantKey falls back to exact for unknown descriptions', () => {
  assert.equal(smartMerchantKey('Random Description'), 'exact:random description')
})

test('smartMerchantLabel is human-readable', () => {
  assert.equal(smartMerchantLabel('Transfer to John Doe'), 'Transfer to John Doe')
  // "POS " prefix and trailing digits are stripped; the label is capitalized.
  assert.equal(smartMerchantLabel('POS Shoprite Lekki 1234'), 'Shoprite lekki')
})

test('aggregateMerchants rolls up smart-mode debits and counts variants', () => {
  const rows = [
    { description: 'POS Shoprite Lekki 1234', amount: -100 },
    { description: 'POS Shoprite Lekki 5678', amount: -50 },
    { description: 'Netflix', amount: -15 },
  ]
  const result = aggregateMerchants(rows, 'smart', 'debit', 10)
  const shoprite = result.find((r) => r.merchant === 'Shoprite lekki')
  assert.ok(shoprite)
  assert.equal(shoprite.total, 150)
  assert.equal(shoprite.count, 2)
  assert.equal(shoprite.variants, 2)
})

test('aggregateMerchants respects direction (credit only)', () => {
  const rows = [
    { description: 'Salary', amount: 3000 },
    { description: 'Coffee', amount: -5 },
  ]
  const result = aggregateMerchants(rows, 'exact', 'credit', 10)
  assert.equal(result.length, 1)
  assert.equal(result[0].merchant, 'Salary')
  assert.equal(result[0].total, 3000)
})
