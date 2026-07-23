import Papa from 'papaparse'

const HEADER_HINTS = [
  /date/i,
  /posted/i,
  /description/i,
  /narration/i,
  /details/i,
  /memo/i,
  /payee/i,
  /amount/i,
  /debit/i,
  /credit/i,
  /balance/i,
  /withdrawal/i,
  /deposit/i,
]

/**
 * Bank Excel exports often start with a few title/metadata rows before the real
 * header. Score the first rows and pick the one that looks most like a header.
 */
function findHeaderRow(aoa: string[][]): number {
  let bestIdx = 0
  let bestScore = 0
  const limit = Math.min(aoa.length, 15)

  for (let i = 0; i < limit; i++) {
    const cells = aoa[i].map((c) => String(c ?? '').trim()).filter(Boolean)
    if (cells.length < 2) continue
    const score = cells.reduce(
      (acc, cell) => acc + (HEADER_HINTS.some((re) => re.test(cell)) ? 1 : 0),
      0,
    )
    if (score > bestScore) {
      bestScore = score
      bestIdx = i
    }
  }

  return bestScore > 0 ? bestIdx : 0
}

/**
 * Convert the first worksheet of an Excel workbook (.xlsx/.xls) into CSV text so
 * it can flow through the existing CSV column-mapping pipeline.
 */
export async function excelToCsv(buffer: ArrayBuffer): Promise<string> {
  const XLSX = await import('xlsx')

  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error('The Excel file has no worksheets')

  const sheet = workbook.Sheets[sheetName]
  const aoa = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    blankrows: false,
    raw: false,
    dateNF: 'yyyy-mm-dd',
  })

  if (aoa.length === 0) throw new Error('The Excel worksheet is empty')

  const headerIdx = findHeaderRow(aoa)
  const rows = aoa
    .slice(headerIdx)
    .map((row) => row.map((cell) => (cell == null ? '' : String(cell))))

  return Papa.unparse(rows)
}
