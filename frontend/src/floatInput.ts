/** Максимальная длина дробной части (после запятой/точки) в полях массы и цены */
export const DECIMAL_FRACTION_DIGITS = 3

/**
 * Можно стереть; только цифры и одна точка/запятая; после разделителя — не больше
 * `maxFractionDigits` знаков. Одна «.» в начале -> «0.».
 */
export function filterDecimalInput(
  raw: string,
  maxFractionDigits: number = DECIMAL_FRACTION_DIGITS
): string {
  if (raw === '') return ''
  let t = raw.replace(',', '.')
  t = t.replace(/[^\d.]/g, '')
  const d = t.indexOf('.')
  if (d >= 0) {
    const a = t.slice(0, d)
    let b = t.slice(d + 1).replace(/\./g, '')
    if (b.length > maxFractionDigits) b = b.slice(0, maxFractionDigits)
    t = a + '.' + b
  } else {
    t = t.replace(/\./g, '')
  }
  if (t === '' || t === '.') {
    if (t === '.') return '0.'
    return ''
  }
  if (t.startsWith('.')) t = '0' + t
  return t
}

/** Blur: пусто/только «.» -> «0»; снять хвостовую точку. */
export function normalizeDecimalOnBlur(s: string): string {
  const t = s.trim()
  if (t === '' || t === '.') return '0'
  let n = t.replace(',', '.')
  if (n.startsWith('.')) n = '0' + n
  if (n.endsWith('.')) n = n.slice(0, -1)
  return n === '' ? '0' : n
}

/** Сохранение: дробь не длиннее `maxFractionDigits`. */
export function commitDecimalForApi(
  s: string,
  maxFractionDigits: number = DECIMAL_FRACTION_DIGITS
): string {
  let t = s.trim()
  if (t === '' || t === '.') return '0'
  t = t.replace(',', '.')
  if (t.startsWith('.')) t = '0' + t
  if (t.endsWith('.')) t = t.slice(0, -1) || '0'
  const d = t.indexOf('.')
  if (d < 0) return t
  const intPart = t.slice(0, d) || '0'
  const frac = t.slice(d + 1, d + 1 + maxFractionDigits)
  if (frac.length === 0) return intPart
  return intPart + '.' + frac
}

/** Значение с сервера в поле: не больше `maxFractionDigits` после разделителя. */
export function capDecimalString(
  s: string | null | undefined,
  maxFractionDigits: number = DECIMAL_FRACTION_DIGITS
): string {
  if (s == null || String(s).trim() === '') return '0'
  const t = String(s).replace(',', '.').trim()
  const d = t.indexOf('.')
  if (d < 0) return t
  return t.slice(0, d + 1 + maxFractionDigits)
}
