import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  const locale = currency === 'NGN' ? 'en-NG' : currency === 'EUR' ? 'de-DE' : currency === 'GBP' ? 'en-GB' : 'en-US'
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    signDisplay: 'auto',
  }).format(amount)
}

export function formatDate(date: string): string {
  if (!date) return '—'
  const normalized = date.slice(0, 10)
  const parsed = new Date(`${normalized}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return date
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(parsed)
}

export function generateId(): string {
  return crypto.randomUUID()
}
