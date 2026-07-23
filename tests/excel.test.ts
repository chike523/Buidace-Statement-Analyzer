import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { excelToCsv } from '../src/lib/parsers/excel.ts'

const buffer = readFileSync(
  fileURLToPath(new URL('./fixtures/sample.xlsx', import.meta.url)),
)

// Node's Buffer is a Uint8Array; pass its underlying ArrayBuffer slice.
const arrayBuffer = buffer.buffer.slice(
  buffer.byteOffset,
  buffer.byteOffset + buffer.byteLength,
)

test('excelToCsv skips preamble rows and starts at the real header', async () => {
  const csv = await excelToCsv(arrayBuffer)
  const lines = csv.trim().split(/\r?\n/)
  assert.equal(lines[0], 'Date,Description,Amount,Balance')
})

test('excelToCsv converts every data row', async () => {
  const csv = await excelToCsv(arrayBuffer)
  const lines = csv.trim().split(/\r?\n/)
  // 1 header + 3 transactions
  assert.equal(lines.length, 4)
  assert.match(csv, /Coffee Shop/)
  assert.match(csv, /Salary/)
  assert.match(csv, /Grocery Store/)
})

test('excelToCsv preserves negative amounts', async () => {
  const csv = await excelToCsv(arrayBuffer)
  assert.match(csv, /-4\.5/)
  assert.match(csv, /-120\.75/)
})
