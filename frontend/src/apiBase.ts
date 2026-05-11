/** Базовый URL бэкенда для production (Vercel). В dev пусто — запросы идут на тот же origin, Vite проксирует /api и /media. */
const raw = import.meta.env.VITE_API_ORIGIN as string | undefined
export const API_ORIGIN = raw?.trim() ? raw.trim().replace(/\/$/, '') : ''

export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  return API_ORIGIN ? `${API_ORIGIN}${p}` : p
}
