import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseOfxText } from '../src/lib/parsers/ofx.ts'

const fixture = readFileSync(
  fileURLToPath(new URL('./fixtures/sample.ofx', import.meta.url)),
  'utf8',
)

test('parseOfxText reads all transactions with correct signs', () => {
  const { rows } = parseOfxText(fixture, 'sample.ofx')
  assert.equal(rows.length, 3)
  assert.equal(rows[0].amount, -2500)
  assert.equal(rows[1].amount, 150000)
  assert.equal(rows[2].amount, -1200.5)
})

test('parseOfxText normalizes timezone-suffixed dates to YYYY-MM-DD', () => {
  const { rows } = parseOfxText(fixture, 'sample.ofx')
  assert.equal(rows[0].date, '2024-01-15')
  assert.equal(rows[1].date, '2024-01-16')
})

test('parseOfxText combines NAME and MEMO, falls back to MEMO only', () => {
  const { rows } = parseOfxText(fixture, 'sample.ofx')
  assert.equal(rows[0].description, 'SHOPRITE LEKKI — Card purchase')
  assert.equal(rows[1].description, 'SALARY PAYMENT')
  assert.equal(rows[2].description, 'MTN Airtime Purchase')
})

test('parseOfxText extracts the account currency from CURDEF', () => {
  const { currency } = parseOfxText(fixture, 'sample.ofx')
  assert.equal(currency, 'NGN')
})

test('parseOfxText returns no rows for empty input', () => {
  const { rows } = parseOfxText('', 'empty.ofx')
  assert.equal(rows.length, 0)
})
