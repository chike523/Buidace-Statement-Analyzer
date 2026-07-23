/**
 * APIs that pdf.js (and a few other libs) expect, but mobile Safari may lack.
 * Must run in both the window and any Web Worker that loads pdf.js.
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
    Math: Math & { sumPrecise?: (values: Iterable<number>) => number }
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
    g.Math.sumPrecise = function sumPrecise(values: Iterable<number>) {
      let sum = 0
      for (const n of values) sum += Number(n)
      return sum
    }
  }
}

installPolyfills()
