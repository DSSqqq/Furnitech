const KEY_ACCESS = 'furnitech_access'
const KEY_REFRESH = 'furnitech_refresh'

export function getAccessToken(): string | null {
  return localStorage.getItem(KEY_ACCESS)
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem(KEY_ACCESS, access)
  localStorage.setItem(KEY_REFRESH, refresh)
}

export function setAccessToken(access: string) {
  localStorage.setItem(KEY_ACCESS, access)
}

export function clearTokens() {
  localStorage.removeItem(KEY_ACCESS)
  localStorage.removeItem(KEY_REFRESH)
}

export type Me = {
  id: number
  username: string
  email: string
  is_superuser: boolean
  is_staff: boolean
}

export async function refreshAccessToken(): Promise<boolean> {
  const ref = localStorage.getItem(KEY_REFRESH)
  if (!ref) return false
  const r = await fetch('/api/auth/token/refresh/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh: ref }),
  })
  if (!r.ok) {
    clearTokens()
    return false
  }
  const j = (await r.json()) as { access: string }
  setAccessToken(j.access)
  return true
}

export async function loginRequest(username: string, password: string) {
  const r = await fetch('/api/auth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!r.ok) {
    let msg = r.statusText
    const raw = await r.text().catch(() => '')
    const trimmed = raw.trim()
    try {
      const j = (trimmed ? JSON.parse(trimmed) : {}) as {
        detail?: string
        non_field_errors?: string[]
      }
      if (j.detail) msg = j.detail
      else if (j.non_field_errors?.length) msg = j.non_field_errors.join(' ')
    } catch {
      if (trimmed) msg = trimmed
    }
    throw new Error(msg)
  }
  return (await r.json()) as { access: string; refresh: string }
}

export function login(username: string, password: string) {
  return loginRequest(username, password).then((t) => {
    setTokens(t.access, t.refresh)
  })
}

export async function fetchMe(): Promise<Me | null> {
  const read = async (token: string | null) => {
    if (!token) return null
    const r = await fetch('/api/auth/me/', { headers: { Authorization: `Bearer ${token}` } })
    if (!r.ok) return null
    return r.json() as Promise<Me>
  }
  let acc = getAccessToken()
  if (!acc) {
    if (!(await refreshAccessToken())) return null
    acc = getAccessToken()
  }
  let me = await read(acc)
  if (!me) {
    if (!(await refreshAccessToken())) return null
    me = await read(getAccessToken())
  }
  return me
}

export async function hasValidSession(): Promise<boolean> {
  if (!getAccessToken() && !localStorage.getItem(KEY_REFRESH)) return false
  if (!getAccessToken()) {
    if (!(await refreshAccessToken())) return false
  }
  const m = await fetchMe()
  return m != null
}
