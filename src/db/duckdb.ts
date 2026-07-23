import * as duckdb from '@duckdb/duckdb-wasm'
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url'
import mvp_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url'
import duckdb_wasm_eh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url'
import eh_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url'
import { aggregateMerchants } from '@/lib/merchant'
import {
  clearPersistedSnapshot,
  isPersistenceSupported as persistenceSupported,
  loadPersistedSnapshot,
  savePersistedSnapshot,
} from '@/db/persistence'
import type {
  Account,
  AccountBreakdown,
  DashboardStats,
  DuplicateGroup,
  MerchantGroupingMode,
  MonthlyFlow,
  TopMerchant,
  PayeeSearchResult,
  Transaction,
  TransactionFilters,
} from '@/types/transaction'

const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
  mvp: { mainModule: duckdb_wasm, mainWorker: mvp_worker },
  eh: { mainModule: duckdb_wasm_eh, mainWorker: eh_worker },
}

/** Values that can be safely bound to a prepared statement. */
type SqlParam = string | number | boolean | null

const PERSIST_KEY = 'statement-analyzer:persist'

let dbInstance: duckdb.AsyncDuckDB | null = null
let connInstance: duckdb.AsyncDuckDBConnection | null = null

/** True while restoring a persisted snapshot, so writes don't re-persist. */
let restoring = false
let persistTimer: ReturnType<typeof setTimeout> | null = null

/** Whether this browser can persist data on-device. */
export function isPersistenceSupported(): boolean {
  return persistenceSupported()
}

/** Whether the user has opted in to on-device persistence. */
export function isPersistenceEnabled(): boolean {
  try {
    return localStorage.getItem(PERSIST_KEY) === 'true'
  } catch {
    return false
  }
}

function setPersistFlag(enabled: boolean): void {
  try {
    localStorage.setItem(PERSIST_KEY, String(enabled))
  } catch {
    /* ignore storage errors (e.g. private mode) */
  }
}

/** Write the current database contents to IndexedDB immediately. */
async function persistNow(): Promise<void> {
  if (!isPersistenceEnabled() || !isPersistenceSupported()) return
  try {
    const snapshot = await snapshotDatabase()
    await savePersistedSnapshot(snapshot)
  } catch (err) {
    console.error('Failed to persist data', err)
  }
}

/**
 * Debounced persistence. Data-mutating operations call this so a burst of
 * writes (e.g. a bulk import) results in a single snapshot write.
 */
function schedulePersist(): void {
  if (restoring || !isPersistenceEnabled() || !isPersistenceSupported()) return
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = null
    void persistNow()
  }, 400)
}

function normalizeRowDate(value: unknown): string {
  if (value == null) return ''
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }
  if (typeof value === 'number' && value > 1_000_000_000) {
    const ms = value > 1_000_000_000_000 ? value : value * 1000
    return new Date(ms).toISOString().slice(0, 10)
  }
  const text = String(value)
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10)
  if (/^\d{10,13}$/.test(text)) {
    const n = Number(text)
    const ms = n > 1_000_000_000_000 ? n : n * 1000
    return new Date(ms).toISOString().slice(0, 10)
  }
  const parsed = new Date(text)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  return text.slice(0, 10)
}

async function getConnection(): Promise<duckdb.AsyncDuckDBConnection> {
  if (connInstance) return connInstance

  const bundle = await duckdb.selectBundle(MANUAL_BUNDLES)
  const worker = new Worker(bundle.mainWorker!)
  const logger = new duckdb.ConsoleLogger()
  const db = new duckdb.AsyncDuckDB(logger, worker)
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker)

  dbInstance = db
  connInstance = await db.connect()

  await connInstance.query(`
    CREATE TABLE IF NOT EXISTS accounts (
      id VARCHAR PRIMARY KEY,
      name VARCHAR NOT NULL,
      currency VARCHAR DEFAULT 'USD'
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id VARCHAR PRIMARY KEY,
      account_id VARCHAR NOT NULL,
      date DATE NOT NULL,
      description VARCHAR NOT NULL,
      amount DOUBLE NOT NULL,
      balance DOUBLE,
      currency VARCHAR,
      raw_source VARCHAR,
      import_batch_id VARCHAR NOT NULL
    );

    CREATE TABLE IF NOT EXISTS duplicate_groups (
      id VARCHAR PRIMARY KEY,
      fingerprint VARCHAR NOT NULL,
      status VARCHAR DEFAULT 'pending'
    );

    CREATE TABLE IF NOT EXISTS duplicate_members (
      group_id VARCHAR NOT NULL,
      transaction_id VARCHAR NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transfer_rejections (
      pair_id VARCHAR PRIMARY KEY
    );
  `)

  // Restore any previously persisted data into the fresh in-memory database.
  if (isPersistenceEnabled() && isPersistenceSupported()) {
    try {
      const snapshot = await loadPersistedSnapshot()
      if (snapshot) {
        restoring = true
        await restoreDatabase(snapshot)
        restoring = false
      }
    } catch (err) {
      restoring = false
      console.error('Failed to restore persisted data', err)
    }
  }

  return connInstance
}

/**
 * Run a read query with bound parameters via a prepared statement, returning the
 * result rows. Parameters are always bound (never interpolated) to avoid any SQL
 * injection or quoting issues from user-provided descriptions, search terms, etc.
 */
async function runQuery(
  sql: string,
  params: SqlParam[] = [],
): Promise<Record<string, unknown>[]> {
  const conn = await getConnection()
  if (params.length === 0) {
    const result = await conn.query(sql)
    return result.toArray() as Record<string, unknown>[]
  }
  const stmt = await conn.prepare(sql)
  try {
    const result = await stmt.query(...params)
    return result.toArray() as Record<string, unknown>[]
  } finally {
    await stmt.close()
  }
}

/** Build a parameterized WHERE clause plus its ordered bind parameters. */
function buildFilterWhere(
  filters: TransactionFilters,
  ignoredIds: string[],
  options?: { includeSearch?: boolean; excludeTransactionIds?: string[] },
): { where: string; params: SqlParam[] } {
  const conditions: string[] = ['1=1']
  const params: SqlParam[] = []
  const includeSearch = options?.includeSearch !== false
  const excludeTransactionIds = options?.excludeTransactionIds ?? []

  if (filters.account_id !== 'all') {
    conditions.push('t.account_id = ?')
    params.push(filters.account_id)
  }
  if (filters.date_from) {
    conditions.push('t.date >= ?')
    params.push(filters.date_from)
  }
  if (filters.date_to) {
    conditions.push('t.date <= ?')
    params.push(filters.date_to)
  }
  if (filters.amount_min) {
    conditions.push('t.amount >= ?')
    params.push(Number.parseFloat(filters.amount_min))
  }
  if (filters.amount_max) {
    conditions.push('t.amount <= ?')
    params.push(Number.parseFloat(filters.amount_max))
  }
  if (filters.type === 'debit') {
    conditions.push('t.amount < 0')
  }
  if (filters.type === 'credit') {
    conditions.push('t.amount > 0')
  }
  if (includeSearch && filters.search) {
    conditions.push('LOWER(t.description) LIKE LOWER(?)')
    params.push(`%${filters.search}%`)
  }
  if (ignoredIds.length > 0) {
    conditions.push(`t.id NOT IN (${ignoredIds.map(() => '?').join(',')})`)
    params.push(...ignoredIds)
  }
  if (excludeTransactionIds.length > 0) {
    conditions.push(`t.id NOT IN (${excludeTransactionIds.map(() => '?').join(',')})`)
    params.push(...excludeTransactionIds)
  }

  return { where: conditions.join(' AND '), params }
}

export async function initDatabase(): Promise<void> {
  await getConnection()
  void dbInstance
}

export async function upsertAccount(account: Account): Promise<void> {
  await runQuery(
    `INSERT OR REPLACE INTO accounts (id, name, currency) VALUES (?, ?, ?)`,
    [account.id, account.name, account.currency],
  )
  schedulePersist()
}

export async function getAccounts(): Promise<Account[]> {
  const rows = await runQuery('SELECT id, name, currency FROM accounts ORDER BY name')
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    currency: String(row.currency),
  }))
}

export async function insertTransactions(transactions: Transaction[]): Promise<void> {
  if (transactions.length === 0) return
  const conn = await getConnection()

  const stmt = await conn.prepare(`
    INSERT OR REPLACE INTO transactions
    (id, account_id, date, description, amount, balance, currency, raw_source, import_batch_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  await conn.query('BEGIN TRANSACTION')
  try {
    for (const t of transactions) {
      await stmt.query(
        t.id,
        t.account_id,
        t.date,
        t.description,
        t.amount,
        t.balance ?? null,
        t.currency ?? null,
        t.raw_source,
        t.import_batch_id,
      )
    }
    await conn.query('COMMIT')
  } catch (err) {
    await conn.query('ROLLBACK')
    throw err
  } finally {
    await stmt.close()
  }
  schedulePersist()
}

function mapTransactionRow(row: Record<string, unknown>): Transaction {
  return {
    id: String(row.id),
    account_id: String(row.account_id),
    date: normalizeRowDate(row.date),
    description: String(row.description),
    amount: Number(row.amount),
    balance: row.balance != null ? Number(row.balance) : undefined,
    currency: row.currency != null ? String(row.currency) : undefined,
    raw_source: String(row.raw_source),
    import_batch_id: String(row.import_batch_id),
  }
}

export async function getAllTransactions(): Promise<Transaction[]> {
  const rows = await runQuery('SELECT * FROM transactions ORDER BY date DESC')
  return rows.map(mapTransactionRow)
}

export async function queryTransactions(
  filters: TransactionFilters,
  ignoredIds: string[] = [],
  limit = 10000,
  offset = 0,
): Promise<Transaction[]> {
  const { where, params } = buildFilterWhere(filters, ignoredIds)
  const rows = await runQuery(
    `
    SELECT t.* FROM transactions t
    WHERE ${where}
    ORDER BY t.date DESC, t.description
    LIMIT ${Number(limit)} OFFSET ${Number(offset)}
  `,
    params,
  )
  return rows.map(mapTransactionRow)
}

export async function countTransactions(
  filters: TransactionFilters,
  ignoredIds: string[] = [],
): Promise<number> {
  const { where, params } = buildFilterWhere(filters, ignoredIds)
  const rows = await runQuery(
    `SELECT COUNT(*) as cnt FROM transactions t WHERE ${where}`,
    params,
  )
  return Number(rows[0]?.cnt ?? 0)
}

export async function getDashboardStats(
  filters: TransactionFilters,
  ignoredIds: string[] = [],
  excludeTransactionIds: string[] = [],
): Promise<DashboardStats> {
  const { where, params } = buildFilterWhere(filters, ignoredIds, { excludeTransactionIds })
  const rows = await runQuery(
    `
    SELECT
      COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as total_income,
      COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as total_expenses,
      COALESCE(SUM(amount), 0) as net_flow,
      COUNT(*) as transaction_count
    FROM transactions t
    WHERE ${where}
  `,
    params,
  )
  const row = rows[0]
  return {
    total_income: Number(row?.total_income ?? 0),
    total_expenses: Number(row?.total_expenses ?? 0),
    net_flow: Number(row?.net_flow ?? 0),
    transaction_count: Number(row?.transaction_count ?? 0),
  }
}

export async function getMonthlyFlow(
  filters: TransactionFilters,
  ignoredIds: string[] = [],
  excludeTransactionIds: string[] = [],
): Promise<MonthlyFlow[]> {
  const { where, params } = buildFilterWhere(filters, ignoredIds, { excludeTransactionIds })
  const rows = await runQuery(
    `
    SELECT
      strftime(date, '%Y-%m') as month,
      COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as income,
      COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as expenses,
      COALESCE(SUM(amount), 0) as net
    FROM transactions t
    WHERE ${where}
    GROUP BY 1
    ORDER BY 1
  `,
    params,
  )
  return rows.map((row) => ({
    month: String(row.month),
    income: Number(row.income),
    expenses: Number(row.expenses),
    net: Number(row.net),
  }))
}

export async function getTopMerchants(
  filters: TransactionFilters,
  ignoredIds: string[] = [],
  limit = 10,
  options?: { excludeTransactionIds?: string[]; merchantMode?: MerchantGroupingMode },
): Promise<TopMerchant[]> {
  const excludeTransactionIds = options?.excludeTransactionIds ?? []
  const merchantMode = options?.merchantMode ?? 'exact'

  if (merchantMode === 'exact') {
    const { where, params } = buildFilterWhere(filters, ignoredIds, { excludeTransactionIds })
    const rows = await runQuery(
      `
      SELECT
        description as merchant,
        SUM(ABS(amount)) as total,
        COUNT(*) as count
      FROM transactions t
      WHERE ${where} AND amount < 0
      GROUP BY description
      ORDER BY total DESC
      LIMIT ${Number(limit)}
    `,
      params,
    )
    return rows.map((row) => ({
      merchant: String(row.merchant),
      total: Number(row.total),
      count: Number(row.count),
      variants: 1,
    }))
  }

  const rows = await getMerchantAggregationRows(filters, ignoredIds, excludeTransactionIds)
  return aggregateMerchants(rows, 'smart', 'debit', limit)
}

export async function getTopMerchantsByCredit(
  filters: TransactionFilters,
  ignoredIds: string[] = [],
  limit = 10,
  options?: { excludeTransactionIds?: string[]; merchantMode?: MerchantGroupingMode },
): Promise<TopMerchant[]> {
  const excludeTransactionIds = options?.excludeTransactionIds ?? []
  const merchantMode = options?.merchantMode ?? 'exact'

  if (merchantMode === 'exact') {
    const { where, params } = buildFilterWhere(filters, ignoredIds, { excludeTransactionIds })
    const rows = await runQuery(
      `
      SELECT
        description as merchant,
        SUM(amount) as total,
        COUNT(*) as count
      FROM transactions t
      WHERE ${where} AND amount > 0
      GROUP BY description
      ORDER BY total DESC
      LIMIT ${Number(limit)}
    `,
      params,
    )
    return rows.map((row) => ({
      merchant: String(row.merchant),
      total: Number(row.total),
      count: Number(row.count),
      variants: 1,
    }))
  }

  const rows = await getMerchantAggregationRows(filters, ignoredIds, excludeTransactionIds)
  return aggregateMerchants(rows, 'smart', 'credit', limit)
}

async function getMerchantAggregationRows(
  filters: TransactionFilters,
  ignoredIds: string[],
  excludeTransactionIds: string[],
): Promise<{ description: string; amount: number }[]> {
  const { where, params } = buildFilterWhere(filters, ignoredIds, { excludeTransactionIds })
  const rows = await runQuery(
    `
    SELECT description, amount
    FROM transactions t
    WHERE ${where}
  `,
    params,
  )
  return rows.map((row) => ({
    description: String(row.description),
    amount: Number(row.amount),
  }))
}

export async function searchPayeeNames(
  query: string,
  filters: TransactionFilters,
  ignoredIds: string[] = [],
  limit = 12,
): Promise<PayeeSearchResult[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []

  const { where, params } = buildFilterWhere(filters, ignoredIds, { includeSearch: false })
  const rows = await runQuery(
    `
    SELECT
      description as name,
      COUNT(*) as count,
      SUM(amount) as total_amount
    FROM transactions t
    WHERE ${where}
      AND LOWER(t.description) LIKE LOWER(?)
    GROUP BY description
    ORDER BY count DESC, ABS(SUM(amount)) DESC
    LIMIT ${Number(limit)}
  `,
    [...params, `%${trimmed}%`],
  )
  return rows.map((row) => ({
    name: String(row.name),
    count: Number(row.count),
    total_amount: Number(row.total_amount),
  }))
}

export async function getAccountBreakdown(
  filters: TransactionFilters,
  ignoredIds: string[] = [],
  excludeTransactionIds: string[] = [],
): Promise<AccountBreakdown[]> {
  const { where, params } = buildFilterWhere(filters, ignoredIds, { excludeTransactionIds })
  const rows = await runQuery(
    `
    SELECT
      t.account_id,
      a.name as account_name,
      COALESCE(SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END), 0) as income,
      COALESCE(SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END), 0) as expenses,
      COALESCE(SUM(t.amount), 0) as net
    FROM transactions t
    LEFT JOIN accounts a ON t.account_id = a.id
    WHERE ${where}
    GROUP BY t.account_id, a.name
    ORDER BY a.name
  `,
    params,
  )
  return rows.map((row) => ({
    account_id: String(row.account_id),
    account_name: String(row.account_name ?? row.account_id),
    income: Number(row.income),
    expenses: Number(row.expenses),
    net: Number(row.net),
  }))
}

export async function saveDuplicateGroups(groups: DuplicateGroup[]): Promise<void> {
  const conn = await getConnection()
  await conn.query('DELETE FROM duplicate_groups')
  await conn.query('DELETE FROM duplicate_members')

  if (groups.length === 0) {
    schedulePersist()
    return
  }

  const groupStmt = await conn.prepare(
    `INSERT INTO duplicate_groups (id, fingerprint, status) VALUES (?, ?, ?)`,
  )
  const memberStmt = await conn.prepare(
    `INSERT INTO duplicate_members (group_id, transaction_id) VALUES (?, ?)`,
  )
  try {
    for (const group of groups) {
      await groupStmt.query(group.id, group.fingerprint, group.status)
      for (const txId of group.transaction_ids) {
        await memberStmt.query(group.id, txId)
      }
    }
  } finally {
    await groupStmt.close()
    await memberStmt.close()
  }
  schedulePersist()
}

export async function getDuplicateGroups(): Promise<DuplicateGroup[]> {
  const groupRows = await runQuery('SELECT id, fingerprint, status FROM duplicate_groups')
  const groups: DuplicateGroup[] = []

  for (const row of groupRows) {
    const memberRows = await runQuery(
      `SELECT transaction_id FROM duplicate_members WHERE group_id = ?`,
      [String(row.id)],
    )
    groups.push({
      id: String(row.id),
      fingerprint: String(row.fingerprint),
      status: String(row.status) as DuplicateGroup['status'],
      transaction_ids: memberRows.map((m) => String(m.transaction_id)),
    })
  }

  return groups
}

export async function getIgnoredTransactionIds(): Promise<string[]> {
  const rows = await runQuery(`
    WITH ranked AS (
      SELECT
        dm.transaction_id,
        dm.group_id,
        ROW_NUMBER() OVER (PARTITION BY dm.group_id ORDER BY dm.transaction_id) AS rn
      FROM duplicate_members dm
    )
    SELECT r.transaction_id
    FROM ranked r
    JOIN duplicate_groups dg ON r.group_id = dg.id
    WHERE dg.status = 'ignored' AND r.rn > 1
  `)
  return rows.map((row) => String(row.transaction_id))
}

export async function getTransactionCount(): Promise<number> {
  const rows = await runQuery('SELECT COUNT(*) as cnt FROM transactions')
  return Number(rows[0]?.cnt ?? 0)
}

export async function getRejectedTransferPairIds(): Promise<string[]> {
  const rows = await runQuery('SELECT pair_id FROM transfer_rejections')
  return rows.map((row) => String(row.pair_id))
}

export async function rejectTransferPair(pairId: string): Promise<void> {
  await runQuery(`INSERT OR REPLACE INTO transfer_rejections (pair_id) VALUES (?)`, [pairId])
  schedulePersist()
}

export async function unrejectTransferPair(pairId: string): Promise<void> {
  await runQuery(`DELETE FROM transfer_rejections WHERE pair_id = ?`, [pairId])
  schedulePersist()
}

type DatabaseSnapshot = {
  accounts: Account[]
  transactions: Transaction[]
  duplicateGroups: DuplicateGroup[]
  rejectedPairs: string[]
}

async function snapshotDatabase(): Promise<DatabaseSnapshot> {
  const [accounts, transactions, duplicateGroups, rejectedPairs] = await Promise.all([
    getAccounts(),
    getAllTransactions(),
    getDuplicateGroups(),
    getRejectedTransferPairIds(),
  ])
  return { accounts, transactions, duplicateGroups, rejectedPairs }
}

async function restoreDatabase(snapshot: DatabaseSnapshot): Promise<void> {
  for (const account of snapshot.accounts) {
    await upsertAccount(account)
  }
  await insertTransactions(snapshot.transactions)
  await saveDuplicateGroups(snapshot.duplicateGroups)
  for (const pairId of snapshot.rejectedPairs) {
    await rejectTransferPair(pairId)
  }
}

/**
 * Toggle on-device persistence. The in-memory database is untouched; enabling
 * writes the current data to IndexedDB (and keeps it in sync afterwards), while
 * disabling removes the stored copy so nothing is left on the device.
 */
export async function setPersistenceEnabled(enabled: boolean): Promise<void> {
  if (enabled === isPersistenceEnabled()) return
  if (enabled && !isPersistenceSupported()) {
    throw new Error('On-device persistence is not supported in this browser')
  }

  setPersistFlag(enabled)

  if (enabled) {
    await persistNow()
  } else {
    if (persistTimer) {
      clearTimeout(persistTimer)
      persistTimer = null
    }
    await clearPersistedSnapshot()
  }
}
