import type {
  CalculatorFillingType,
  CalculatorProfile,
  CalculatorProfileType,
  Material,
  MaterialCategory,
  MaterialClass,
  UnitOfMeasure,
} from './types'
import { getAccessToken, refreshAccessToken } from './auth'

const FIELD_LABELS: Record<string, string> = {
  article: 'Артикул',
  name: 'Наименование',
  non_field_errors: '',
}

function formatFieldErrors(j: Record<string, unknown>): string {
  const parts: string[] = []
  for (const [k, v] of Object.entries(j)) {
    if (k === 'detail') continue
    const label = FIELD_LABELS[k] ?? k
    if (Array.isArray(v)) {
      for (const line of v) {
        if (label) parts.push(`${label}: ${String(line)}`)
        else parts.push(String(line))
      }
    } else if (typeof v === 'string') {
      if (label) parts.push(`${label}: ${v}`)
      else parts.push(v)
    }
  }
  return parts.join(' ')
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
        ? ' Сначала выполните из корня проекта: py backend\\manage.py migrate (нужна миграция materials.0021_*), затем снова py backend\\manage.py runserver.'
        : ''
    throw new Error(
      `Сервер вернул HTML вместо JSON (${r.status}). Остановите все старые runserver на :8000, поднимите backend из актуального кода репозитория и перезапустите сервер.${migrateHint}`
    )
  }

  try {
    const j = (trimmed ? JSON.parse(trimmed) : {}) as Record<string, unknown>
    const d = j.detail
    if (typeof d === 'string') msg = d
    else if (Array.isArray(d)) msg = d.map(String).join(', ')
    else if (j.non_field_errors && Array.isArray(j.non_field_errors)) {
      msg = j.non_field_errors.map(String).join(', ')
    } else {
      const flat = formatFieldErrors(j)
      if (flat) msg = flat
    }
  } catch {
    if (trimmed) msg = trimmed
  }
  throw new Error(msg)
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const withAuth = async (token: string | null) => {
    const h = new Headers(init.headers)
    const isForm = typeof FormData !== 'undefined' && init.body instanceof FormData
    if (init.body != null && !isForm) {
      h.set('Content-Type', h.get('Content-Type') || 'application/json')
    }
    if (token) h.set('Authorization', `Bearer ${token}`)
    return fetch(input, { ...init, headers: h })
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

export function fetchMaterials(categoryId: number) {
  return apiFetch(`/api/materials/?category=${categoryId}`).then((r) =>
    json<{ results: Material[] }>(r)
  )
}

/** Поиск по всей базе (категория не задана) — выбор сопутствующего материала. */
export function searchMaterials(query: string) {
  const q = query.trim()
  if (!q) return Promise.resolve({ results: [] as Material[] })
  return apiFetch(`/api/materials/?search=${encodeURIComponent(q)}`).then((r) =>
    json<{ results: Material[] }>(r)
  )
}

export function fetchUom() {
  return apiFetch('/api/uom/').then((r) => json<{ results: UnitOfMeasure[] }>(r))
}

export function fetchMaterialClasses() {
  return apiFetch('/api/material-classes/').then((r) => json<{ results: MaterialClass[] }>(r))
}

export function createMaterialClass(data: { name: string; code?: string }) {
  return apiFetch('/api/material-classes/', {
    method: 'POST',
    body: JSON.stringify(data),
  }).then((r) => json<MaterialClass>(r))
}

export function deleteMaterialClass(id: number) {
  return apiFetch(`/api/material-classes/${id}/`, { method: 'DELETE' }).then(async (r) => {
    if (!r.ok) await parseJsonError(r)
  })
}

export function fetchMaterial(id: number) {
  return apiFetch(`/api/materials/${id}/`).then((r) => json<Material>(r))
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
  return apiFetch('/api/calculator-profile-types/').then((r) => json<{ results: CalculatorProfileType[] }>(r))
}

export function createCalculatorProfileType(
  data:
    | FormData
    | {
        name: string
        image_url?: string
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
  return apiFetch('/api/calculator-filling-types/').then((r) => json<{ results: CalculatorFillingType[] }>(r))
}

export function createCalculatorFillingType(
  data:
    | FormData
    | {
        name: string
        image_url?: string
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
