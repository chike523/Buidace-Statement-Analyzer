import type { ParsedRow } from '@/types/transaction'

export type OfxParseOutput = {
  rows: ParsedRow[]
  currency?: string
  raw_text_preview: string
}

const STMTTRN_RE = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi

/** Read an SGML/XML-style OFX tag value, tolerant of unclosed SGML tags. */
function tag(block: string, name: string): string {
  const match = block.match(new RegExp(`<${name}>([^<\\r\\n]*)`, 'i'))
  return match ? match[1].trim() : ''
}

/** OFX dates look like YYYYMMDDHHMMSS[.XXX][TZ]; we only need the calendar day. */
function parseOfxDate(value: string): string | null {
  const digits = value.replace(/[^\d]/g, '')
  if (digits.length < 8) return null
  const year = digits.slice(0, 4)
  const month = digits.slice(4, 6)
  const day = digits.slice(6, 8)
  const iso = `${year}-${month}-${day}`
  return Number.isNaN(new Date(iso).getTime()) ? null : iso
}

/**
 * Parse OFX and QFX (Quicken) statement text. Both share the OFX <STMTTRN>
 * transaction structure, so a single tolerant parser handles both.
 */
export function parseOfxText(text: string, filename: string): OfxParseOutput {
  const rows: ParsedRow[] = []
  const currency = tag(text, 'CURDEF') || undefined

  let index = 0
  const txnBlocks: string[] = []
  const flags = STMTTRN_RE.flags.includes('g') ? STMTTRN_RE.flags : `${STMTTRN_RE.flags}g`
  const re = new RegExp(STMTTRN_RE.source, flags)
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    txnBlocks.push(match[1])
    if (match[0].length === 0) re.lastIndex += 1
  }

  for (const block of txnBlocks) {
    const date = parseOfxDate(tag(block, 'DTPOSTED'))
    const amountRaw = tag(block, 'TRNAMT')
    const amount = Number.parseFloat(amountRaw)

    if (!date || !Number.isFinite(amount)) continue

    const name = tag(block, 'NAME')
    const memo = tag(block, 'MEMO')
    const payee = tag(block, 'PAYEE')
    const description = [name || payee, memo]
      .filter(Boolean)
      .join(' — ')
      .trim()

    index += 1
    rows.push({
      date,
      description: description || tag(block, 'TRNTYPE') || 'Transaction',
      amount,
      raw_source: `${filename}:txn ${index}`,
    })
  }

  return {
    rows,
    currency,
    raw_text_preview: text.slice(0, 2000),
  }
}
