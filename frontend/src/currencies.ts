/** Базовая валюта учёта (фиксирована). */
export const BASE_CURRENCY = 'KZT' as const

/**
 * Альтернативы для отображения цены; KZT в список не включён.
 */
export const ALTERNATIVE_CURRENCIES: { code: string; label: string }[] = [
  { code: 'RUB', label: 'RUB — российский рубль' },
  { code: 'USD', label: 'USD — доллар США' },
  { code: 'EUR', label: 'EUR — евро' },
  { code: 'CNY', label: 'CNY — юань' },
  { code: 'TRY', label: 'TRY — лира' },
  { code: 'GBP', label: 'GBP — фунт' },
  { code: 'AZN', label: 'AZN — манат' },
  { code: 'UZS', label: 'UZS — сум' },
  { code: 'KGS', label: 'KGS — сом' },
]
