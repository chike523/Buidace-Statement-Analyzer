declare global {
  interface Math {
    sumPrecise?: (values: number[]) => number
  }
}

if (typeof Math.sumPrecise !== 'function') {
  Math.sumPrecise = (values: number[]) => values.reduce((sum, n) => sum + n, 0)
}

export {}
