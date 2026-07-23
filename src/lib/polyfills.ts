/**
 * APIs that pdf.js (and a few other libs) expect, but mobile Safari may lack.
 * Must run before any pdf.js import.
 */
export function installPolyfills(scope: typeof globalThis = globalThis): void {
  const g = scope as typeof globalThis & {
    Promise: PromiseConstructor & {
      withResolvers?: <T = unknown>() => {
        promise: Promise<T>
        resolve: (value: T | PromiseLike<T>) => void
        reject: (reason?: unknown) => void
      }
    }
    Math: Math & { sumPrecise?: (values: ArrayLike<number> | Iterable<number>) => number }
    URL: typeof URL & { parse?: (url: string, base?: string | URL) => URL | null }
  }

  if (typeof g.Promise.withResolvers !== 'function') {
    g.Promise.withResolvers = function withResolvers<T = unknown>() {
      let resolve!: (value: T | PromiseLike<T>) => void
      let reject!: (reason?: unknown) => void
      const promise = new Promise<T>((res, rej) => {
        resolve = res
        reject = rej
      })
      return { promise, resolve, reject }
    }
  }

  if (typeof g.Math.sumPrecise !== 'function') {
    // Avoid for-of here — some older WebKits throw oddly on non-iterables.
    g.Math.sumPrecise = function sumPrecise(values: ArrayLike<number> | Iterable<number>) {
      const list = Array.isArray(values)
        ? values
        : Array.from(values as ArrayLike<number> | Iterable<number>)
      let sum = 0
      for (let i = 0; i < list.length; i++) sum += Number(list[i])
      return sum
    }
  }

  if (typeof g.URL.parse !== 'function') {
    g.URL.parse = function parse(url: string, base?: string | URL) {
      try {
        return base !== undefined ? new URL(url, base) : new URL(url)
      } catch {
        return null
      }
    }
  }
}

installPolyfills()
