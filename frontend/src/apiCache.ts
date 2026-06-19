/**
 * Кэш ответов GET-справочников калькулятора в рамках сессии SPA + дедупликация
 * параллельных запросов. На шагах 2–8 одни и те же справочники (типы профиля,
 * наполнения, петли, классы, формулы, материалы) запрашивались по нескольку раз
 * на каждый шаг — на проде (Render + Supabase) это давало заметные задержки.
 * Любая запись (POST/PATCH/PUT/DELETE) сбрасывает кэш — см. `apiFetch` в `api.ts`.
 */

type CacheEntry<T> = { value: T; at: number }

const DEFAULT_TTL_MS = 60_000

const store = new Map<string, CacheEntry<unknown>>()
const inflight = new Map<string, Promise<unknown>>()

/**
 * Возвращает значение из кэша (если свежее), переиспользует выполняющийся запрос
 * или вызывает `loader` и кэширует результат.
 */
export function cachedJson<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<T> {
  const now = Date.now()
  const hit = store.get(key)
  if (hit && now - hit.at < ttlMs) {
    return Promise.resolve(hit.value as T)
  }
  const pending = inflight.get(key)
  if (pending) return pending as Promise<T>

  const p = loader()
    .then((value) => {
      store.set(key, { value, at: Date.now() })
      inflight.delete(key)
      return value
    })
    .catch((e) => {
      inflight.delete(key)
      throw e
    })
  inflight.set(key, p)
  return p as Promise<T>
}

/** Сброс кэша целиком (вызывается после любой записи в API). */
export function clearApiCache(): void {
  store.clear()
  inflight.clear()
}
