import * as duckdb from '@duckdb/duckdb-wasm'
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url'
import mvp_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url'
import duckdb_wasm_eh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url'
import eh_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url'
import { aggregateMerchants } from '@/lib/merchant'
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

let dbInstance: duckdb.AsyncDuckDB | null = null
let connInstance: duckdb.AsyncDuckDBConnection | null = null

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

  return connInstance
}

function buildFilterWhere(
  filters: TransactionFilters,
  ignoredIds: string[],
  options?: { includeSearch?: boolean; excludeTransactionIds?: string[] },
): string {
  const conditions: string[] = ['1=1']
  const includeSearch = options?.includeSearch !== false
  const excludeTransactionIds = options?.excludeTransactionIds ?? []

  if (filters.account_id !== 'all') {
    conditions.push(`t.account_id = '${filters.account_id}'`)
  }
  if (filters.date_from) {
    conditions.push(`t.date >= '${filters.date_from}'`)
  }
  if (filters.date_to) {
    conditions.push(`t.date <= '${filters.date_to}'`)
  }
  if (filters.amount_min) {
    conditions.push(`t.amount >= ${Number.parseFloat(filters.amount_min)}`)
  }
  if (filters.amount_max) {
    conditions.push(`t.amount <= ${Number.parseFloat(filters.amount_max)}`)
  }
  if (filters.type === 'debit') {
    conditions.push('t.amount < 0')
  }
  if (filters.type === 'credit') {
    conditions.push('t.amount > 0')
  }
  if (includeSearch && filters.search) {
    const escaped = filters.search.replace(/'/g, "''")
    conditions.push(`LOWER(t.description) LIKE LOWER('%${escaped}%')`)
  }
  if (ignoredIds.length > 0) {
    conditions.push(`t.id NOT IN (${ignoredIds.map((id) => `'${id}'`).join(',')})`)
  }
  if (excludeTransactionIds.length > 0) {
    conditions.push(`t.id NOT IN (${excludeTransactionIds.map((id) => `'${id}'`).join(',')})`)
  }

  return conditions.join(' AND ')
}

export async function initDatabase(): Promise<void> {
  await getConnection()
  void dbInstance
}

export async function upsertAccount(account: Account): Promise<void> {
  const conn = await getConnection()
  await conn.query(`
    INSERT OR REPLACE INTO accounts (id, name, currency)
    VALUES ('${account.id}', '${account.name.replace(/'/g, "''")}', '${account.currency}')
  `)
}

export async function getAccounts(): Promise<Account[]> {
  const conn = await getConnection()
  const result = await conn.query('SELECT id, name, currency FROM accounts ORDER BY name')
  return result.toArray().map((row) => ({
    id: String(row.id),
    name: String(row.name),
    currency: String(row.currency),
  }))
}

export async function insertTransactions(transactions: Transaction[]): Promise<void> {
  if (transactions.length === 0) return
  const conn = await getConnection()

  const batchSize = 500
  for (let i = 0; i < transactions.length; i += batchSize) {
    const batch = transactions.slice(i, i + batchSize)
    const values = batch
      .map(
        (t) =>
          `('${t.id}', '${t.account_id}', '${t.date}', '${t.description.replace(/'/g, "''")}', ${t.amount}, ${t.balance ?? 'NULL'}, ${t.currency ? `'${t.currency}'` : 'NULL'}, '${t.raw_source.replace(/'/g, "''")}', '${t.import_batch_id}')`,
      )
      .join(',\n')

    await conn.query(`
      INSERT OR REPLACE INTO transactions
      (id, account_id, date, description, amount, balance, currency, raw_source, import_batch_id)
      VALUES ${values}
    `)
  }
}

export async function getAllTransactions(): Promise<Transaction[]> {
  const conn = await getConnection()
  const result = await conn.query('SELECT * FROM transactions ORDER BY date DESC')
  return result.toArray().map((row) => ({
    id: String(row.id),
    account_id: String(row.account_id),
    date: normalizeRowDate(row.date),
    description: String(row.description),
    amount: Number(row.amount),
    balance: row.balance != null ? Number(row.balance) : undefined,
    currency: row.currency != null ? String(row.currency) : undefined,
    raw_source: String(row.raw_source),
    import_batch_id: String(row.import_batch_id),
  }))
}

export async function queryTransactions(
  filters: TransactionFilters,
  ignoredIds: string[] = [],
  limit = 10000,
  offset = 0,
): Promise<Transaction[]> {
  const conn = await getConnection()
  const where = buildFilterWhere(filters, ignoredIds)
  const result = await conn.query(`
    SELECT t.* FROM transactions t
    WHERE ${where}
    ORDER BY t.date DESC, t.description
    LIMIT ${limit} OFFSET ${offset}
  `)
  return result.toArray().map((row) => ({
    id: String(row.id),
    account_id: String(row.account_id),
    date: normalizeRowDate(row.date),
    description: String(row.description),
    amount: Number(row.amount),
    balance: row.balance != null ? Number(row.balance) : undefined,
    currency: row.currency != null ? String(row.currency) : undefined,
    raw_source: String(row.raw_source),
    import_batch_id: String(row.import_batch_id),
  }))
}

export async function countTransactions(
  filters: TransactionFilters,
  ignoredIds: string[] = [],
): Promise<number> {
  const conn = await getConnection()
  const where = buildFilterWhere(filters, ignoredIds)
  const result = await conn.query(`SELECT COUNT(*) as cnt FROM transactions t WHERE ${where}`)
  const row = result.toArray()[0]
  return Number(row?.cnt ?? 0)
}

export async function getDashboardStats(
  filters: TransactionFilters,
  ignoredIds: string[] = [],
  excludeTransactionIds: string[] = [],
): Promise<DashboardStats> {
  const conn = await getConnection()
  const where = buildFilterWhere(filters, ignoredIds, { excludeTransactionIds })
  const result = await conn.query(`
    SELECT
      COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as total_income,
      COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as total_expenses,
      COALESCE(SUM(amount), 0) as net_flow,
      COUNT(*) as transaction_count
    FROM transactions t
    WHERE ${where}
  `)
  const row = result.toArray()[0]
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
  const conn = await getConnection()
  const where = buildFilterWhere(filters, ignoredIds, { excludeTransactionIds })
  const result = await conn.query(`
    SELECT
      strftime(date, '%Y-%m') as month,
      COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as income,
      COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as expenses,
      COALESCE(SUM(amount), 0) as net
    FROM transactions t
    WHERE ${where}
    GROUP BY 1
    ORDER BY 1
  `)
  return result.toArray().map((row) => ({
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
    const conn = await getConnection()
    const where = buildFilterWhere(filters, ignoredIds, { excludeTransactionIds })
    const result = await conn.query(`
      SELECT
        description as merchant,
        SUM(ABS(amount)) as total,
        COUNT(*) as count
      FROM transactions t
      WHERE ${where} AND amount < 0
      GROUP BY description
      ORDER BY total DESC
      LIMIT ${limit}
    `)
    return result.toArray().map((row) => ({
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
    const conn = await getConnection()
    const where = buildFilterWhere(filters, ignoredIds, { excludeTransactionIds })
    const result = await conn.query(`
      SELECT
        description as merchant,
        SUM(amount) as total,
        COUNT(*) as count
      FROM transactions t
      WHERE ${where} AND amount > 0
      GROUP BY description
      ORDER BY total DESC
      LIMIT ${limit}
    `)
    return result.toArray().map((row) => ({
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
  const conn = await getConnection()
  const where = buildFilterWhere(filters, ignoredIds, { excludeTransactionIds })
  const result = await conn.query(`
    SELECT description, amount
    FROM transactions t
    WHERE ${where}
  `)
  return result.toArray().map((row) => ({
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

  const conn = await getConnection()
  const where = buildFilterWhere(filters, ignoredIds, { includeSearch: false })
  const escaped = trimmed.replace(/'/g, "''")
  const result = await conn.query(`
    SELECT
      description as name,
      COUNT(*) as count,
      SUM(amount) as total_amount
    FROM transactions t
    WHERE ${where}
      AND LOWER(t.description) LIKE LOWER('%${escaped}%')
    GROUP BY description
    ORDER BY count DESC, ABS(SUM(amount)) DESC
    LIMIT ${limit}
  `)
  return result.toArray().map((row) => ({
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
  const conn = await getConnection()
  const where = buildFilterWhere(filters, ignoredIds, { excludeTransactionIds })
  const result = await conn.query(`
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
  `)
  return result.toArray().map((row) => ({
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

  for (const group of groups) {
    await conn.query(`
      INSERT INTO duplicate_groups (id, fingerprint, status)
      VALUES ('${group.id}', '${group.fingerprint.replace(/'/g, "''")}', '${group.status}')
    `)
    for (const txId of group.transaction_ids) {
      await conn.query(`
        INSERT INTO duplicate_members (group_id, transaction_id)
        VALUES ('${group.id}', '${txId}')
      `)
    }
  }
}

export async function getDuplicateGroups(): Promise<DuplicateGroup[]> {
  const conn = await getConnection()
  const groupsResult = await conn.query('SELECT id, fingerprint, status FROM duplicate_groups')
  const groups: DuplicateGroup[] = []

  for (const row of groupsResult.toArray()) {
    const membersResult = await conn.query(
      `SELECT transaction_id FROM duplicate_members WHERE group_id = '${row.id}'`,
    )
    groups.push({
      id: String(row.id),
      fingerprint: String(row.fingerprint),
      status: String(row.status) as DuplicateGroup['status'],
      transaction_ids: membersResult.toArray().map((m) => String(m.transaction_id)),
    })
  }

  return groups
}

export async function getIgnoredTransactionIds(): Promise<string[]> {
  const conn = await getConnection()
  const result = await conn.query(`
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
  return result.toArray().map((row) => String(row.transaction_id))
}

export async function getTransactionCount(): Promise<number> {
  const conn = await getConnection()
  const result = await conn.query('SELECT COUNT(*) as cnt FROM transactions')
  return Number(result.toArray()[0]?.cnt ?? 0)
}

export async function getRejectedTransferPairIds(): Promise<string[]> {
  const conn = await getConnection()
  const result = await conn.query('SELECT pair_id FROM transfer_rejections')
  return result.toArray().map((row) => String(row.pair_id))
}

export async function rejectTransferPair(pairId: string): Promise<void> {
  const conn = await getConnection()
  await conn.query(`
    INSERT OR REPLACE INTO transfer_rejections (pair_id)
    VALUES ('${pairId.replace(/'/g, "''")}')
  `)
}

export async function unrejectTransferPair(pairId: string): Promise<void> {
  const conn = await getConnection()
  await conn.query(`DELETE FROM transfer_rejections WHERE pair_id = '${pairId.replace(/'/g, "''")}'`)
}
