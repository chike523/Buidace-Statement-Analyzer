import { register } from 'node:module'

// Registers the "@/..." alias resolver for the test runner.
register('./alias-resolver.mjs', import.meta.url)
