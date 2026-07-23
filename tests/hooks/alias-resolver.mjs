import { pathToFileURL } from 'node:url'
import { existsSync, statSync } from 'node:fs'
import path from 'node:path'

// Resolves the app's "@/..." path alias to files under ./src so the analysis
// modules can be imported directly by Node's built-in test runner.
const srcDir = path.resolve(import.meta.dirname, '../../src')

function resolveAlias(specifier) {
  const base = path.join(srcDir, specifier.slice(2))
  const candidates = [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return base
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    return nextResolve(pathToFileURL(resolveAlias(specifier)).href, context)
  }
  return nextResolve(specifier, context)
}
