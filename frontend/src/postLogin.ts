/** Безопасный путь после входа: только относительные URL без open redirect. */
import { isPublicCalculatorRoute } from './PublicClientPages'

export type PostLoginAccess = 'admin' | 'manager' | 'public'

export function safePostLoginTarget(
  rawFrom: string | undefined,
  access: PostLoginAccess,
): string {
  const fallback = access === 'admin' ? '/materials' : access === 'manager' ? '/orders' : '/'
  if (rawFrom == null || rawFrom === '') return fallback
  const trimmed = rawFrom.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return fallback
  if (trimmed.includes('://') || trimmed.includes('\\')) return fallback
  const noHash = trimmed.split('#')[0] ?? ''
  const pathname = (noHash.split('?')[0] ?? '').replace(/\/$/, '') || '/'
  if (isPublicCalculatorRoute(pathname) || pathname.replace(/\/$/, '') === '/my-orders') {
    return noHash || '/'
  }
  if (access === 'admin') {
    if (
      pathname.startsWith('/materials') ||
      pathname.startsWith('/textures') ||
      pathname.startsWith('/calculator') ||
      pathname.startsWith('/classes') ||
      pathname.startsWith('/uom') ||
      pathname.startsWith('/calculations') ||
      pathname.startsWith('/orders') ||
      pathname.startsWith('/users')
    ) {
      return noHash
    }
  } else if (access === 'manager') {
    if (pathname.startsWith('/orders') || pathname.startsWith('/calculator')) {
      return noHash
    }
  }
  return fallback
}

/** Проверка `state.from` до входа (регистрация → логин). */
export function safePreLoginReturnPath(rawFrom: string | undefined): string | undefined {
  const safe = safePostLoginTarget(rawFrom, 'public')
  if (rawFrom == null || rawFrom.trim() === '') return undefined
  const trimmed = rawFrom.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return undefined
  if (trimmed.includes('://') || trimmed.includes('\\')) return undefined
  return safe === '/' && trimmed !== '/' ? undefined : safe
}
