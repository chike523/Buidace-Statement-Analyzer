/**
 * Lazy entry point for the DuckDB module. Keeps the ~35MB WASM payload out of
 * the critical path so the welcome screen can paint before analytics boots.
 */
export type DuckDbApi = typeof import('./duckdb')

let duckDbPromise: Promise<DuckDbApi> | null = null

export function loadDuckDb(): Promise<DuckDbApi> {
  if (!duckDbPromise) {
    duckDbPromise = import('./duckdb')
  }
  return duckDbPromise
}
