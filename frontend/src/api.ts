/** HTTP-клиент к Django API: Bearer, пагинация, справочники и заказы. */
import type {
  CalculationFormula,
  CalculationFormulaCategory,
  CalculatorFillingType,
  CalculatorHandleHoleDiameter,
  CalculatorHingeType,
  CalculatorProfile,
  CalculatorProfileType,
  Material,
  MaterialCategory,
  MaterialClass,
  MaterialClassCategory,
  TextureCategory,
  TextureItem,
  UnitOfMeasure,
} from './types'
import { getAccessToken, refreshAccessToken } from './auth'
import { apiUrl } from './apiBase'
import { cachedJson, clearApiCache, CATALOG_TTL_MS } from './apiCache'

const SAFE_HTTP_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

const FIELD_LABELS: Record<string, string> = {
  article: 'Артикул',
  name: 'Наименование',
  non_field_errors: '',
  /** Без префикса «code:» — сообщение и так однозначное */
  code: '',
}

const IMAGE_FIELD_LABELS: Record<string, string> = {
  image: 'Изображение',
  texture_image: 'Изображение',
}

/** Перевод типовых сообщений DRF/Django в понятный русский текст. */
function localizeFieldMessage(field: string, raw: string): string {
  const t = raw.trim()
  if (
    field === 'non_field_errors' ||
    field === 'name' ||
    field === 'article'
  ) {
    if (/category.*name|name.*category|уникальн/i.test(t) && /name|наименован/i.test(t)) {
      return 'В этой папке уже есть материал с таким наименованием. Укажите другое наименование.'
    }
    if (/article|артикул/i.test(t) && /unique|уникальн|already exists|уже/i.test(t)) {
      return 'Материал с таким артикулом уже есть. Укажите другой артикул.'
    }
    if (/must make a unique set|уникальн.*набор|массив с уникальными/i.test(t)) {
      if (/category.*name|name.*category/i.test(t)) {
        return 'В этой папке уже есть материал с таким наименованием. Укажите другое наименование.'
      }
      return 'Укажите уникальные артикул и наименование — такая комбинация уже есть в каталоге.'
    }
  }
  if (field === 'image' || field === 'texture_image') {
    if (/not a valid image|corrupted image|valid image/i.test(t)) {
      return 'Файл не распознан как изображение. Используйте JPG, PNG или WebP (форматы вроде HEIC с iPhone не поддерживаются — пересохраните в JPG/PNG).'
    }
    if (/too large|maximum.*length|ensure this filename/i.test(t)) {
      return 'Слишком длинное имя файла. Переименуйте файл короче и повторите.'
    }
  }
  return t
}

function formatFieldErrors(j: Record<string, unknown>): string {
  const parts: string[] = []
  for (const [k, v] of Object.entries(j)) {
    if (k === 'detail') continue
    const label = IMAGE_FIELD_LABELS[k] ?? FIELD_LABELS[k] ?? k
    if (Array.isArray(v)) {
      for (const line of v) {
        const msg = localizeFieldMessage(k, String(line))
        if (label) parts.push(`${label}: ${msg}`)
        else parts.push(msg)
      }
    } else if (typeof v === 'string') {
      const msg = localizeFieldMessage(k, v)
      if (label) parts.push(`${label}: ${msg}`)
      else parts.push(msg)
    }
  }
  return parts.join(' ')
}

/** Понятные сообщения по HTTP-статусу, когда тело ответа не дало конкретики. */
function statusFallbackMessage(status: number): string | null {
  if (status === 401) {
    return 'Сессия истекла или вы не вошли. Войдите в систему заново и повторите.'
  }
  if (status === 403) {
    return 'Недостаточно прав для этого действия. Нужна роль «Администратор» с правами на справочники — обратитесь к владельцу, чтобы выдать доступ (роль на вкладке «Пользователи»).'
  }
  if (status === 413) {
    return 'Файл слишком большой. Уменьшите размер изображения (например до 2–5 МБ) и повторите загрузку.'
  }
  if (status === 502 || status === 503 || status === 504) {
    return 'Сервер сейчас недоступен или просыпается после простоя (это занимает 30–60 секунд на бесплатном плане). Подождите минуту и повторите попытку.'
  }
  return null
}

export type PaginatedResult<T> = {
  count?: number
  next: string | null
  previous?: string | null
  results: T[]
}

async function parseJsonError(r: Response): Promise<never> {
  let msg = r.statusText || `HTTP ${r.status}`
  const raw = await r.text().catch(() => '')
  const trimmed = raw.trim()
  const ct = (r.headers.get('content-type') || '').toLowerCase()
  const looksHtml =
    ct.includes('text/html') ||
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<html')

  if (looksHtml) {
    const u = r.url || String(r)
    // Прокси/веб-сервер (Render и т.п.) часто отдаёт HTML на 401/403/413 — переводим
    // в понятное сообщение, не сбивая на «перезапустите backend».
    const statusMsg = statusFallbackMessage(r.status)
    if (statusMsg) throw new Error(statusMsg)

    // В production-сборке (Vercel) пользователь — не разработчик: инструкции про
    // runserver/migrate его только пугают. Показываем человекочитаемое сообщение.
    if (!import.meta.env.DEV) {
      if (r.status >= 500) {
        throw new Error(
          'Не удалось сохранить: на сервере произошла ошибка. Чаще всего при загрузке файлов это значит, что не настроено постоянное хранилище изображений (Supabase Storage) или не применены обновления базы. Сообщите администратору сайта — нужно проверить настройки бэкенда на сервере.'
        )
      }
      if (r.status === 404) {
        throw new Error(
          'Запрос не найден на сервере (404). Возможно, бэкенд недоступен или развёрнута устаревшая версия. Сообщите администратору сайта.'
        )
      }
      throw new Error(
        `Сервер вернул неожиданный ответ (${r.status}). Повторите попытку позже или сообщите администратору сайта.`
      )
    }

    if (r.status === 404 && u.includes('calculator-profile-types')) {
      throw new Error(
        'На сервере :8000 нет маршрута /api/calculator-profile-types/ (запущен старый Django или другая копия проекта). Сделайте: 1) Ctrl+C — остановить все runserver; 2) из корня Furnitech: .\\.venv\\Scripts\\python.exe backend\\manage.py migrate; 3) .\\.venv\\Scripts\\python.exe backend\\manage.py runserver; 4) проверка: py scripts\\check_calculator_api_route.py (должно вывести /api/calculator-profile-types/).'
      )
    }
    if (r.status === 404) {
      throw new Error(`Запрос не найден (404): ${u}. Перезапустите backend с актуальным кодом репозитория.`)
    }
    const migrateHint =
      r.status === 500
        ? ' Сначала выполните из корня проекта: py backend\\manage.py migrate, затем снова py backend\\manage.py runserver.'
        : ''
    throw new Error(
      `Сервер вернул HTML вместо JSON (${r.status}). Остановите все старые runserver на :8000, поднимите backend из актуального кода репозитория и перезапустите сервер.${migrateHint}`
    )
  }

  const statusMsg = statusFallbackMessage(r.status)
  if (statusMsg) msg = statusMsg

  try {
    const j = (trimmed ? JSON.parse(trimmed) : {}) as Record<string, unknown>
    const d = j.detail
    if (typeof d === 'string') {
      // DRF отдаёт англоязычный detail для 403 — оставляем понятное RU-сообщение.
      const isGenericDeny = /do not have permission/i.test(d)
      if (!(r.status === 403 && isGenericDeny && statusMsg)) msg = d
    } else if (Array.isArray(d)) msg = d.map(String).join(', ')
    else if (j.non_field_errors && Array.isArray(j.non_field_errors)) {
      msg = j.non_field_errors
        .map((line) => localizeFieldMessage('non_field_errors', String(line)))
        .join(' ')
    } else {
      const flat = formatFieldErrors(j)
      if (flat) msg = flat
    }
  } catch {
    if (trimmed && !statusMsg) msg = trimmed
  }
  throw new Error(msg)
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const resolved: RequestInfo | URL =
    typeof input === 'string' ? apiUrl(input) : input instanceof URL ? input : input

  const withAuth = async (token: string | null) => {
    const h = new Headers(init.headers)
    const isForm = typeof FormData !== 'undefined' && init.body instanceof FormData
    if (init.body != null && !isForm) {
      h.set('Content-Type', h.get('Content-Type') || 'application/json')
    }
    if (token) h.set('Authorization', `Bearer ${token}`)
    return fetch(resolved, { ...init, headers: h })
  }
  let acc = getAccessToken()
  if (!acc) await refreshAccessToken()
  acc = getAccessToken()
  let r = await withAuth(acc)
  if (r.status === 401) {
    const ok = await refreshAccessToken()
    if (ok) {
      acc = getAccessToken()
      r = await withAuth(acc)
    }
  }
  const method = (init.method || 'GET').toUpperCase()
  if (r.ok && !SAFE_HTTP_METHODS.has(method)) {
    clearApiCache()
  }
  return r
}

async function json<T>(r: Response): Promise<T> {
  if (!r.ok) await parseJsonError(r)
  return r.json() as Promise<T>
}

export function fetchCategoryTree() {
  return apiFetch('/api/categories/?tree=1').then((r) => json<MaterialCategory[]>(r))
}

export function createCategory(data: { parent: number | null; name: string; sort_order?: number }) {
  return apiFetch('/api/categories/', {
    method: 'POST',
    body: JSON.stringify(data),
  }).then((r) => json<MaterialCategory>(r))
}

export function updateCategory(
  id: number,
  data: Partial<{ parent: number | null; name: string; code: string; sort_order: number }>
) {
  return apiFetch(`/api/categories/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }).then((r) => json<MaterialCategory>(r))
}

export function deleteCategory(id: number) {
  return apiFetch(`/api/categories/${id}/`, { method: 'DELETE' }).then(async (r) => {
    if (!r.ok) await parseJsonError(r)
  })
}

export function fetchTextureCategoryTree() {
  return apiFetch('/api/texture-categories/?tree=1').then((r) => json<TextureCategory[]>(r))
}

export function createTextureCategory(data: { parent: number | null; name: string; sort_order?: number }) {
  return apiFetch('/api/texture-categories/', {
    method: 'POST',
    body: JSON.stringify(data),
  }).then((r) => json<TextureCategory>(r))
}

export function updateTextureCategory(
  id: number,
  data: Partial<{ parent: number | null; name: string; code: string; sort_order: number }>
) {
  return apiFetch(`/api/texture-categories/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }).then((r) => json<TextureCategory>(r))
}

export function deleteTextureCategory(id: number) {
  return apiFetch(`/api/texture-categories/${id}/`, { method: 'DELETE' }).then(async (r) => {
    if (!r.ok) await parseJsonError(r)
  })
}

/** Все страницы списка текстур; без `category` — вся база; с `category` + `subtree` — папка и вложенные. */
export async function fetchTextureItems(
  params?: { category?: number; subtree?: boolean }
): Promise<{ results: TextureItem[] }> {
  const sp = new URLSearchParams()
  if (params?.category != null && params.category !== undefined) {
    sp.set('category', String(params.category))
  }
  if (params?.subtree) sp.set('subtree', '1')
  const q = sp.toString()
  let path: string | null = `/api/texture-items/${q ? `?${q}` : ''}`
  const collected: TextureItem[] = []
  while (path) {
    const r = await apiFetch(path)
    const data = await json<{ results: TextureItem[]; next: string | null }>(r)
    for (const row of data.results ?? []) collected.push(row)
    const nxt = data.next
    if (!nxt) {
      path = null
    } else {
      try {
        const u = new URL(nxt)
        path = u.pathname + u.search
      } catch {
        path = null
      }
    }
  }
  return { results: collected }
}

/** Одна страница списка текстур для быстрых админских списков. */
export function fetchTextureItemsPage(
  params?: { category?: number; subtree?: boolean },
  page = 1
): Promise<PaginatedResult<TextureItem>> {
  const sp = new URLSearchParams()
  if (params?.category != null && params.category !== undefined) {
    sp.set('category', String(params.category))
  }
  if (params?.subtree) sp.set('subtree', '1')
  sp.set('page', String(Math.max(1, page)))
  return apiFetch(`/api/texture-items/?${sp.toString()}`).then((r) => json<PaginatedResult<TextureItem>>(r))
}

export function createTextureItem(data: Record<string, unknown> | FormData) {
  return apiFetch('/api/texture-items/', {
    method: 'POST',
    body: data instanceof FormData ? data : JSON.stringify(data),
  }).then((r) => json<TextureItem>(r))
}

export function updateTextureItem(id: number, data: Record<string, unknown> | FormData) {
  return apiFetch(`/api/texture-items/${id}/`, {
    method: 'PATCH',
    body: data instanceof FormData ? data : JSON.stringify(data),
  }).then((r) => json<TextureItem>(r))
}

export function deleteTextureItem(id: number) {
  return apiFetch(`/api/texture-items/${id}/`, { method: 'DELETE' }).then(async (r) => {
    if (!r.ok) await parseJsonError(r)
  })
}

/** @param options.subtree — материалы выбранной папки и всех вложенных (для дерева в админке). */
export function fetchMaterials(categoryId: number, options?: { subtree?: boolean }) {
  const sp = new URLSearchParams()
  sp.set('category', String(categoryId))
  if (options?.subtree) sp.set('subtree', '1')
  return apiFetch(`/api/materials/?${sp.toString()}`).then((r) => json<{ results: Material[] }>(r))
}

/** Поиск по всей базе (категория не задана) — выбор сопутствующего материала. */
export function searchMaterials(query: string) {
  const q = query.trim()
  if (!q) return Promise.resolve({ results: [] as Material[] })
  return apiFetch(`/api/materials/?search=${encodeURIComponent(q)}`).then((r) =>
    json<{ results: Material[] }>(r)
  )
}

export type MaterialsListFilterParams = {
  category?: number | null
  /** Материалы категории и всех вложенных папок */
  subtree?: boolean
  folder_name?: string
  article?: string
  name?: string
  price?: string
  material_class_ids?: number[]
}

/** Список материалов с фильтрами (см. MaterialViewSet.get_queryset). */
export function fetchMaterialsFiltered(params: MaterialsListFilterParams) {
  const sp = new URLSearchParams()
  if (params.category != null && params.category !== undefined) {
    sp.set('category', String(params.category))
  }
  if (params.subtree) sp.set('subtree', '1')
  const fn = params.folder_name?.trim()
  if (fn) sp.set('folder_name', fn)
  const ar = params.article?.trim()
  if (ar) sp.set('article', ar)
  const nm = params.name?.trim()
  if (nm) sp.set('name', nm)
  const pr = params.price?.trim()
  if (pr) sp.set('price', pr)
  if (params.material_class_ids?.length) {
    sp.set('material_class_ids', params.material_class_ids.join(','))
  }
  const q = sp.toString()
  return apiFetch(`/api/materials/${q ? `?${q}` : ''}`).then((r) => json<{ results: Material[] }>(r))
}

/** Все единицы измерения из справочника (все страницы API). */
export async function fetchUom(): Promise<{ results: UnitOfMeasure[] }> {
  let path: string | null = '/api/uom/'
  const collected: UnitOfMeasure[] = []
  while (path) {
    const r = await apiFetch(path)
    const data = await json<{ results: UnitOfMeasure[]; next: string | null }>(r)
    for (const row of data.results ?? []) collected.push(row)
    const nxt = data.next
    if (!nxt) {
      path = null
    } else {
      try {
        const u = new URL(nxt)
        path = u.pathname + u.search
      } catch {
        path = null
      }
    }
  }
  return { results: collected }
}

export function createUom(data: { name: string; short_name?: string; code: string }) {
  return apiFetch('/api/uom/', {
    method: 'POST',
    body: JSON.stringify(data),
  }).then((r) => json<UnitOfMeasure>(r))
}

export function updateUom(
  id: number,
  data: Partial<{ name: string; short_name: string; code: string }>
) {
  return apiFetch(`/api/uom/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }).then((r) => json<UnitOfMeasure>(r))
}

export function deleteUom(id: number) {
  return apiFetch(`/api/uom/${id}/`, { method: 'DELETE' }).then(async (r) => {
    if (!r.ok) await parseJsonError(r)
  })
}

export function fetchMaterialClassCategoryTree() {
  return apiFetch('/api/material-class-categories/?tree=1').then((r) => json<MaterialClassCategory[]>(r))
}

export function createMaterialClassCategory(data: { parent: number | null; name: string; sort_order?: number }) {
  return apiFetch('/api/material-class-categories/', {
    method: 'POST',
    body: JSON.stringify({ ...data, sort_order: data.sort_order ?? 0 }),
  }).then((r) => json<MaterialClassCategory>(r))
}

export function updateMaterialClassCategory(
  id: number,
  data: Partial<{ parent: number | null; name: string; code: string; sort_order: number }>
) {
  return apiFetch(`/api/material-class-categories/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }).then((r) => json<MaterialClassCategory>(r))
}

export function deleteMaterialClassCategory(id: number) {
  return apiFetch(`/api/material-class-categories/${id}/`, { method: 'DELETE' }).then(async (r) => {
    if (!r.ok) await parseJsonError(r)
  })
}

/** Все страницы списка классов; при `category` + `subtree` — классы в папке и вложенных. */
export function fetchMaterialClasses(
  params?: { category?: number | null; subtree?: boolean }
): Promise<{ results: MaterialClass[] }> {
  const sp = new URLSearchParams()
  if (params?.category != null && params.category !== undefined) {
    sp.set('category', String(params.category))
  }
  if (params?.subtree) sp.set('subtree', '1')
  const q = sp.toString()
  const cacheKey = `material-classes:${q}`
  return cachedJson(cacheKey, async () => {
    let path: string | null = `/api/material-classes/${q ? `?${q}` : ''}`
    const collected: MaterialClass[] = []
    while (path) {
      const r = await apiFetch(path)
      const data = await json<{ results: MaterialClass[]; next: string | null }>(r)
      for (const row of data.results ?? []) collected.push(row)
      const nxt = data.next
      if (!nxt) {
        path = null
      } else {
        try {
          const u = new URL(nxt)
          path = u.pathname + u.search
        } catch {
          path = null
        }
      }
    }
    return { results: collected }
  }, CATALOG_TTL_MS)
}

/** Одна страница списка классов для быстрых админских списков. */
export function fetchMaterialClassesPage(
  params?: { category?: number | null; subtree?: boolean },
  page = 1
): Promise<PaginatedResult<MaterialClass>> {
  const sp = new URLSearchParams()
  if (params?.category != null && params.category !== undefined) {
    sp.set('category', String(params.category))
  }
  if (params?.subtree) sp.set('subtree', '1')
  sp.set('page', String(Math.max(1, page)))
  return apiFetch(`/api/material-classes/?${sp.toString()}`).then((r) =>
    json<PaginatedResult<MaterialClass>>(r)
  )
}

export function createMaterialClass(data: { name: string; category: number; code: string }) {
  return apiFetch('/api/material-classes/', {
    method: 'POST',
    body: JSON.stringify(data),
  }).then((r) => json<MaterialClass>(r))
}

export function updateMaterialClass(id: number, data: Partial<{ name: string; code: string; category: number }>) {
  return apiFetch(`/api/material-classes/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }).then((r) => json<MaterialClass>(r))
}

export function deleteMaterialClass(id: number) {
  return apiFetch(`/api/material-classes/${id}/`, { method: 'DELETE' }).then(async (r) => {
    if (!r.ok) await parseJsonError(r)
  })
}

/** Корневая папка «База классов» после миграции или первый узел дерева. */
export function pickDefaultMaterialClassCategoryId(tree: MaterialClassCategory[]): number | null {
  const walk = (nodes: MaterialClassCategory[], name: string): MaterialClassCategory | null => {
    for (const n of nodes) {
      if (n.name.trim() === name) return n
      const inChildren = walk(n.children ?? [], name)
      if (inChildren) return inChildren
    }
    return null
  }
  const base = walk(tree, 'База классов')
  if (base) return base.id
  return tree[0]?.id ?? null
}

export function fetchCalculationFormulaCategoryTree() {
  return apiFetch('/api/calculation-formula-categories/?tree=1').then((r) =>
    json<CalculationFormulaCategory[]>(r)
  )
}

export function createCalculationFormulaCategory(data: {
  parent: number | null
  name: string
  sort_order?: number
}) {
  return apiFetch('/api/calculation-formula-categories/', {
    method: 'POST',
    body: JSON.stringify({ ...data, sort_order: data.sort_order ?? 0 }),
  }).then((r) => json<CalculationFormulaCategory>(r))
}

export function updateCalculationFormulaCategory(
  id: number,
  data: Partial<{ parent: number | null; name: string; code: string; sort_order: number }>
) {
  return apiFetch(`/api/calculation-formula-categories/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }).then((r) => json<CalculationFormulaCategory>(r))
}

export function deleteCalculationFormulaCategory(id: number) {
  return apiFetch(`/api/calculation-formula-categories/${id}/`, { method: 'DELETE' }).then(async (r) => {
    if (!r.ok) await parseJsonError(r)
  })
}

/** Корневая папка «База формул» или первый узел дерева. */
export function pickDefaultCalculationFormulaCategoryId(tree: CalculationFormulaCategory[]): number | null {
  const walk = (nodes: CalculationFormulaCategory[], name: string): CalculationFormulaCategory | null => {
    for (const n of nodes) {
      if (n.name.trim() === name) return n
      const inChildren = walk(n.children ?? [], name)
      if (inChildren) return inChildren
    }
    return null
  }
  const base = walk(tree, 'База формул')
  if (base) return base.id
  return tree[0]?.id ?? null
}

export function fetchCalculationFormulas(params?: {
  active?: boolean
  category?: number | null
  subtree?: boolean
}): Promise<{ results: CalculationFormula[] }> {
  const sp = new URLSearchParams()
  if (params?.active) sp.set('active', '1')
  if (params?.category != null && params.category !== undefined) {
    sp.set('category', String(params.category))
  }
  if (params?.subtree) sp.set('subtree', '1')
  const q = sp.toString()
  const basePath = `/api/calculation-formulas/${q ? `?${q}` : ''}`
  return cachedJson(`calculation-formulas:${q}`, async () => {
    let path: string | null = basePath
    const collected: CalculationFormula[] = []
    while (path) {
      const r = await apiFetch(path)
      const data = await json<{ results: CalculationFormula[]; next: string | null }>(r)
      for (const row of data.results ?? []) collected.push(row)
      const nxt = data.next
      if (!nxt) {
        path = null
      } else {
        try {
          const u = new URL(nxt)
          path = u.pathname + u.search
        } catch {
          path = null
        }
      }
    }
    return { results: collected }
  }, CATALOG_TTL_MS)
}

export function createCalculationFormula(data: Partial<CalculationFormula>) {
  return apiFetch('/api/calculation-formulas/', {
    method: 'POST',
    body: JSON.stringify(data),
  }).then((r) => json<CalculationFormula>(r))
}

export function updateCalculationFormula(id: number, data: Partial<CalculationFormula>) {
  return apiFetch(`/api/calculation-formulas/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }).then((r) => json<CalculationFormula>(r))
}

export function deleteCalculationFormula(id: number) {
  return apiFetch(`/api/calculation-formulas/${id}/`, { method: 'DELETE' }).then(async (r) => {
    if (!r.ok) await parseJsonError(r)
  })
}

export function fetchMaterial(id: number) {
  return cachedJson(`material:${id}`, () =>
    apiFetch(`/api/materials/${id}/`).then((r) => json<Material>(r))
  )
}

export function createMaterial(data: Record<string, unknown> | FormData) {
  return apiFetch('/api/materials/', {
    method: 'POST',
    body: data instanceof FormData ? data : JSON.stringify(data),
  }).then((r) => json<Material>(r))
}

export function updateMaterial(id: number, data: Record<string, unknown> | FormData) {
  return apiFetch(`/api/materials/${id}/`, {
    method: 'PATCH',
    body: data instanceof FormData ? data : JSON.stringify(data),
  }).then((r) => json<Material>(r))
}

export function deleteMaterial(id: number) {
  return apiFetch(`/api/materials/${id}/`, { method: 'DELETE' }).then(async (r) => {
    if (!r.ok) await parseJsonError(r)
  })
}

export type MaterialsImportResult = {
  created: number
  updated: number
  skipped: number
  errors: string[]
}

/** Импорт материалов из таблицы (.xml или .xlsx): папки по пути группы, поля карточки. */
export function importMaterialsTable(file: File) {
  const fd = new FormData()
  fd.append('file', file)
  return apiFetch('/api/materials-import/', {
    method: 'POST',
    body: fd,
  }).then((r) => json<MaterialsImportResult>(r))
}

export type MaterialsExportFormat = 'xlsx' | 'xml'

/** Экспорт каталога материалов: XLSX (таблица) или XML (Database/Materials/Material). */
export async function downloadMaterialsExport(
  categoryId: number | null,
  format: MaterialsExportFormat = 'xlsx',
) {
  const params = new URLSearchParams()
  if (categoryId != null) params.set('category', String(categoryId))
  params.set('export_format', format)
  const exportUrl = `/api/materials-export/?${params.toString()}`
  const accept =
    format === 'xml'
      ? 'application/xml,*/*;q=0.9'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*;q=0.9'
  const r = await apiFetch(exportUrl, {
    headers: { Accept: accept },
  })
  if (!r.ok) await parseJsonError(r)
  const blob = await r.blob()
  const blobUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = format === 'xml' ? 'materials-catalog.xml' : 'materials-catalog.xlsx'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(blobUrl)
}

export function fetchCalculatorProfiles() {
  return apiFetch('/api/calculator-profiles/').then((r) => json<{ results: CalculatorProfile[] }>(r))
}

export function createCalculatorProfile(data: { material: number; is_active?: boolean; sort_order?: number }) {
  return apiFetch('/api/calculator-profiles/', {
    method: 'POST',
    body: JSON.stringify(data),
  }).then((r) => json<CalculatorProfile>(r))
}

export function updateCalculatorProfile(
  id: number,
  data: Partial<{
    material: number
    is_active: boolean
    sort_order: number
    colors: { color_material_id: number }[]
  }>
) {
  return apiFetch(`/api/calculator-profiles/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }).then((r) => json<CalculatorProfile>(r))
}

export function deleteCalculatorProfile(id: number) {
  return apiFetch(`/api/calculator-profiles/${id}/`, { method: 'DELETE' }).then(async (r) => {
    if (!r.ok) await parseJsonError(r)
  })
}

export function fetchCalculatorProfileTypes() {
  return cachedJson(
    'calculator-profile-types',
    () =>
      apiFetch('/api/calculator-profile-types/').then((r) => json<{ results: CalculatorProfileType[] }>(r)),
    CATALOG_TTL_MS,
  )
}

export function createCalculatorProfileType(
  data:
    | FormData
    | {
        name: string
        image_url?: string
        card_texture?: number | null
        card_texture_2?: number | null
        card_texture_3?: number | null
        card_texture_4?: number | null
        is_active?: boolean
        sort_order?: number
        colors?: { color_material_id: number; is_new?: boolean; is_hit?: boolean; is_sale?: boolean }[]
      }
) {
  return apiFetch('/api/calculator-profile-types/', {
    method: 'POST',
    body: data instanceof FormData ? data : JSON.stringify(data),
  }).then((r) => json<CalculatorProfileType>(r))
}

export function updateCalculatorProfileType(
  id: number,
  data: Partial<{
    name: string
    image_url: string
    card_texture: number | null
    card_texture_2: number | null
    card_texture_3: number | null
    card_texture_4: number | null
    is_active: boolean
    sort_order: number
    colors: { color_material_id: number; is_new?: boolean; is_hit?: boolean; is_sale?: boolean }[]
  }> | FormData
) {
  return apiFetch(`/api/calculator-profile-types/${id}/`, {
    method: 'PATCH',
    body: data instanceof FormData ? data : JSON.stringify(data),
  }).then((r) => json<CalculatorProfileType>(r))
}

export function deleteCalculatorProfileType(id: number) {
  return apiFetch(`/api/calculator-profile-types/${id}/`, { method: 'DELETE' }).then(async (r) => {
    if (!r.ok) await parseJsonError(r)
  })
}

export function fetchCalculatorFillingTypes() {
  return cachedJson(
    'calculator-filling-types',
    () =>
      apiFetch('/api/calculator-filling-types/').then((r) => json<{ results: CalculatorFillingType[] }>(r)),
    CATALOG_TTL_MS,
  )
}

export function createCalculatorFillingType(
  data:
    | FormData
    | {
        name: string
        image_url?: string
        card_texture?: number | null
        card_texture_2?: number | null
        card_texture_3?: number | null
        card_texture_4?: number | null
        is_active?: boolean
        sort_order?: number
        materials?: { material_id: number }[]
      }
) {
  return apiFetch('/api/calculator-filling-types/', {
    method: 'POST',
    body: data instanceof FormData ? data : JSON.stringify(data),
  }).then((r) => json<CalculatorFillingType>(r))
}

export function updateCalculatorFillingType(
  id: number,
  data: Partial<{
    name: string
    image_url: string
    card_texture: number | null
    card_texture_2: number | null
    card_texture_3: number | null
    card_texture_4: number | null
    is_active: boolean
    sort_order: number
    materials: { material_id: number }[]
  }> | FormData
) {
  return apiFetch(`/api/calculator-filling-types/${id}/`, {
    method: 'PATCH',
    body: data instanceof FormData ? data : JSON.stringify(data),
  }).then((r) => json<CalculatorFillingType>(r))
}

export function deleteCalculatorFillingType(id: number) {
  return apiFetch(`/api/calculator-filling-types/${id}/`, { method: 'DELETE' }).then(async (r) => {
    if (!r.ok) await parseJsonError(r)
  })
}

export function fetchCalculatorHingeTypes() {
  return cachedJson(
    'calculator-hinge-types',
    () =>
      apiFetch('/api/calculator-hinge-types/').then((r) => json<{ results: CalculatorHingeType[] }>(r)),
    CATALOG_TTL_MS,
  )
}

export type CalculatorHandleHoleDiametersListResponse = {
  results: CalculatorHandleHoleDiameter[]
  catalog_scope?: 'full' | 'client'
  count?: number
  next?: string | null
  previous?: string | null
}

export function fetchCalculatorHandleHoleDiameters() {
  return apiFetch('/api/calculator-handle-hole-diameters/').then((r) => json<CalculatorHandleHoleDiametersListResponse>(r))
}

export function updateCalculatorHandleHoleDiameter(
  id: number,
  data: Partial<{ client_visible: boolean; sort_order: number }>,
) {
  return apiFetch(`/api/calculator-handle-hole-diameters/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }).then((r) => json<CalculatorHandleHoleDiameter>(r))
}

export function createCalculatorHandleHoleDiameter(data: {
  diameter_mm: number
  client_visible?: boolean
  sort_order?: number
}) {
  return apiFetch('/api/calculator-handle-hole-diameters/', {
    method: 'POST',
    body: JSON.stringify(data),
  }).then((r) => json<CalculatorHandleHoleDiameter>(r))
}

export function deleteCalculatorHandleHoleDiameter(id: number) {
  return apiFetch(`/api/calculator-handle-hole-diameters/${id}/`, { method: 'DELETE' }).then(async (r) => {
    if (!r.ok) await parseJsonError(r)
  })
}

export function createCalculatorHingeType(
  data:
    | FormData
    | {
        name: string
        image_url?: string
        card_texture?: number | null
        card_texture_2?: number | null
        card_texture_3?: number | null
        card_texture_4?: number | null
        is_active?: boolean
        sort_order?: number
        materials?: { material_id: number }[]
      }
) {
  return apiFetch('/api/calculator-hinge-types/', {
    method: 'POST',
    body: data instanceof FormData ? data : JSON.stringify(data),
  }).then((r) => json<CalculatorHingeType>(r))
}

export function updateCalculatorHingeType(
  id: number,
  data: Partial<{
    name: string
    image_url: string
    card_texture: number | null
    card_texture_2: number | null
    card_texture_3: number | null
    card_texture_4: number | null
    is_active: boolean
    sort_order: number
    materials: { material_id: number }[]
  }> | FormData
) {
  return apiFetch(`/api/calculator-hinge-types/${id}/`, {
    method: 'PATCH',
    body: data instanceof FormData ? data : JSON.stringify(data),
  }).then((r) => json<CalculatorHingeType>(r))
}

export function deleteCalculatorHingeType(id: number) {
  return apiFetch(`/api/calculator-hinge-types/${id}/`, { method: 'DELETE' }).then(async (r) => {
    if (!r.ok) await parseJsonError(r)
  })
}

export type AdminUserRow = {
  id: number
  username: string
  email: string
  is_staff: boolean
  is_superuser: boolean
  is_manager: boolean
}

export function fetchAdminUsers() {
  return apiFetch('/api/auth/admin-users/').then((r) => json<AdminUserRow[]>(r))
}

export function patchAdminUserStaff(id: number, is_staff: boolean) {
  return apiFetch(`/api/auth/admin-users/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({ is_staff }),
  }).then((r) => json<AdminUserRow>(r))
}

export function patchAdminUserRole(id: number, role: 'user' | 'manager' | 'admin') {
  return apiFetch(`/api/auth/admin-users/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  }).then((r) => json<AdminUserRow>(r))
}

export function deleteAdminUser(id: number) {
  return apiFetch(`/api/auth/admin-users/${id}/`, { method: 'DELETE' }).then(async (r) => {
    if (!r.ok) await parseJsonError(r)
  })
}

export type FacadeOrderStatus =
  | 'not_confirmed'
  | 'confirmed'
  | 'in_production'
  | 'ready'
  | 'completed'

export type FacadeOrderPaymentStatus = 'unpaid' | 'partial' | 'paid'

export type FacadeOrder = {
  id: number
  order_number: string
  status: FacadeOrderStatus
  status_display: string
  payment_status: FacadeOrderPaymentStatus
  payment_status_display: string
  client_username: string
  client_email: string
  contact_name: string
  contact_phone: string
  contact_email: string
  contact_comment: string
  snapshot: Record<string, unknown>
  pdf_url: string | null
  created_at: string
  updated_at: string
}

export function fetchFacadeOrders(options?: { scope?: 'admin' }) {
  const url = options?.scope === 'admin' ? '/api/facade-orders/?scope=admin' : '/api/facade-orders/'
  return apiFetch(url).then((r) => json<{ results: FacadeOrder[] }>(r))
}

export function createFacadeOrder(formData: FormData) {
  return apiFetch('/api/facade-orders/', {
    method: 'POST',
    body: formData,
  }).then((r) => json<FacadeOrder>(r))
}

export function patchFacadeOrderStatus(id: number, status: FacadeOrderStatus) {
  return patchFacadeOrder(id, { status })
}

export function patchFacadeOrderPaymentStatus(id: number, payment_status: FacadeOrderPaymentStatus) {
  return patchFacadeOrder(id, { payment_status })
}

export function patchFacadeOrder(
  id: number,
  patch: Partial<{ status: FacadeOrderStatus; payment_status: FacadeOrderPaymentStatus }>,
) {
  return apiFetch(`/api/facade-orders/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  }).then((r) => json<FacadeOrder>(r))
}

/** Удаление заказа (только staff); у клиента запись пропадает из списка. */
export function deleteFacadeOrder(id: number) {
  return apiFetch(`/api/facade-orders/${id}/`, { method: 'DELETE' }).then(async (r) => {
    if (!r.ok) await parseJsonError(r)
  })
}

/** Публичная регистрация (без JWT). */
export async function registerAccount(body: { username: string; password: string; email?: string }) {
  const r = await fetch(apiUrl('/api/auth/register/'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) await parseJsonError(r)
  return (await r.json()) as { detail?: string }
}
