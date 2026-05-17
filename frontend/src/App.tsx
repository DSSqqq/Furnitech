import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import AdminApp from './AdminApp'
import { CalculatorPage } from './CalculatorPage'
import { clearTokens, type Me, fetchMe, hasValidSession } from './auth'
import { LoginPage } from './LoginPage'
import {
  ClientMyOrdersPage,
  isPublicCalculatorRoute,
  type PublicShellOutletContext,
} from './PublicClientPages'
import { RegisterPage } from './RegisterPage'
import './App.css'

type AuthState = { phase: 'loading' } | { phase: 'guest' } | { phase: 'authed'; user: Me }

function safePostLoginTarget(rawFrom: string | undefined, isStaff: boolean): string {
  const fallback = isStaff ? '/materials' : '/'
  if (rawFrom == null || rawFrom === '') return fallback
  const trimmed = rawFrom.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return fallback
  if (trimmed.includes('://') || trimmed.includes('\\')) return fallback
  const noHash = trimmed.split('#')[0] ?? ''
  const pathname = (noHash.split('?')[0] ?? '').replace(/\/$/, '') || '/'
  if (isPublicCalculatorRoute(pathname) || pathname.replace(/\/$/, '') === '/my-orders') {
    return noHash || '/'
  }
    if (isStaff) {
      if (
        pathname.startsWith('/materials') ||
        pathname.startsWith('/textures') ||
        pathname.startsWith('/calculator') ||
        pathname.startsWith('/classes') ||
        pathname.startsWith('/calculations') ||
        pathname.startsWith('/orders') ||
        pathname.startsWith('/users')
      ) {
        return noHash
      }
    }
  return fallback
}

function LoginRoute({ auth, onAfterLogin }: { auth: AuthState; onAfterLogin: () => Promise<Me | null> }) {
  const nav = useNavigate()
  const loc = useLocation()
  const rawFrom = (loc.state as { from?: string } | null)?.from

  if (auth.phase === 'loading') {
    return <p className="app-loading">Проверка сессии…</p>
  }
  if (auth.phase === 'authed') {
    const staff = auth.user.is_staff || auth.user.is_superuser
    return <Navigate to={safePostLoginTarget(rawFrom, staff)} replace />
  }

  return (
    <LoginPage
      onSuccess={() => {
        void onAfterLogin().then((me) => {
          const staff = Boolean(me && (me.is_staff || me.is_superuser))
          nav(safePostLoginTarget(rawFrom, staff), { replace: true })
        })
      }}
    />
  )
}

function AdminRoute({ auth, children }: { auth: AuthState; children: (user: Me) => ReactNode }) {
  const loc = useLocation()
  if (auth.phase === 'loading') {
    return <p className="app-loading">Проверка сессии…</p>
  }
  if (auth.phase === 'guest') {
    return <Navigate to="/login" replace state={{ from: `${loc.pathname}${loc.search}` }} />
  }
  if (!auth.user.is_staff && !auth.user.is_superuser) {
    return <Navigate to="/" replace />
  }
  return <>{children(auth.user)}</>
}

function PublicShell() {
  const [auth, setAuth] = useState<AuthState>({ phase: 'loading' })
  const loc = useLocation()
  const calcTabActive = isPublicCalculatorRoute(loc.pathname)
  const ordersTabActive = loc.pathname.replace(/\/$/, '') === '/my-orders'

  const refresh = useCallback(async () => {
    const ok = await hasValidSession()
    if (!ok) {
      setAuth({ phase: 'guest' })
      return
    }
    const m = await fetchMe()
    if (!m) setAuth({ phase: 'guest' })
    else setAuth({ phase: 'authed', user: m })
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const outletCtx: PublicShellOutletContext = { auth }

  return (
    <div className="public-shell">
      <header className="public-shell__header">
        <Link to="/" className="public-shell__brand">
          Фурнитех
        </Link>
        <nav className="public-shell__nav" aria-label="Служебные ссылки">
          {auth.phase === 'loading' ? null : auth.phase === 'authed' &&
            (auth.user.is_staff || auth.user.is_superuser) ? (
            <div className="public-shell__user">
              <span className="public-shell__user-name" title={auth.user.username}>
                {auth.user.email || auth.user.username}
              </span>
              <Link to="/materials" className="public-shell__link">
                Админка
              </Link>
            </div>
          ) : auth.phase === 'authed' ? (
            <div className="public-shell__user">
              <span className="public-shell__user-name" title={auth.user.username}>
                {auth.user.email || auth.user.username}
              </span>
              <button
                type="button"
                className="public-shell__logout"
                onClick={() => {
                  clearTokens()
                  window.location.replace('/')
                }}
              >
                Выйти
              </button>
            </div>
          ) : (
            <>
              <Link to="/login" className="public-shell__link">
                Вход
              </Link>
              <Link to="/register" className="public-shell__link">
                Регистрация
              </Link>
            </>
          )}
        </nav>
      </header>
      <nav className="public-shell__section-tabs" aria-label="Разделы сайта">
        <Link
          to="/"
          className={calcTabActive ? 'public-shell__section-tab public-shell__section-tab--active' : 'public-shell__section-tab'}
        >
          Калькулятор
        </Link>
        <Link
          to="/my-orders"
          className={ordersTabActive ? 'public-shell__section-tab public-shell__section-tab--active' : 'public-shell__section-tab'}
        >
          Мои заказы
        </Link>
      </nav>
      <div className="public-shell__main">
        <Outlet context={outletCtx} />
      </div>
    </div>
  )
}

function App() {
  const [auth, setAuth] = useState<AuthState>({ phase: 'loading' })

  const refreshAuth = useCallback(async (): Promise<Me | null> => {
    setAuth({ phase: 'loading' })
    const ok = await hasValidSession()
    if (!ok) {
      setAuth({ phase: 'guest' })
      return null
    }
    const m = await fetchMe()
    if (!m) {
      setAuth({ phase: 'guest' })
      return null
    }
    setAuth({ phase: 'authed', user: m })
    return m
  }, [])

  const logout = useCallback(() => {
    clearTokens()
    // Не useNavigate: при guest AdminRoute сразу рендерит <Navigate to="/login" /> и в React 19
    // это может обойти SPA-переход на /. Полная замена URL — тот же приём, что replace:true
    // в истории, но без гонки с декларативными редиректами (см. reactrouter.com — useNavigate).
    window.location.replace('/')
  }, [])

  useEffect(() => {
    void refreshAuth()
  }, [refreshAuth])

  return (
    <Routes>
      <Route path="/login" element={<LoginRoute auth={auth} onAfterLogin={refreshAuth} />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/materials/*"
        element={
          <AdminRoute auth={auth}>
            {(user) => <AdminApp user={user} onLogout={logout} />}
          </AdminRoute>
        }
      />
      <Route
        path="/textures/*"
        element={
          <AdminRoute auth={auth}>
            {(user) => <AdminApp user={user} onLogout={logout} />}
          </AdminRoute>
        }
      />
      <Route
        path="/calculator/*"
        element={
          <AdminRoute auth={auth}>
            {(user) => <AdminApp user={user} onLogout={logout} />}
          </AdminRoute>
        }
      />
      <Route
        path="/classes/*"
        element={
          <AdminRoute auth={auth}>
            {(user) => <AdminApp user={user} onLogout={logout} />}
          </AdminRoute>
        }
      />
      <Route
        path="/calculations/*"
        element={
          <AdminRoute auth={auth}>
            {(user) => <AdminApp user={user} onLogout={logout} />}
          </AdminRoute>
        }
      />
      <Route
        path="/orders/*"
        element={
          <AdminRoute auth={auth}>
            {(user) => <AdminApp user={user} onLogout={logout} />}
          </AdminRoute>
        }
      />
      <Route
        path="/users/*"
        element={
          <AdminRoute auth={auth}>
            {(user) => <AdminApp user={user} onLogout={logout} />}
          </AdminRoute>
        }
      />
      <Route path="/" element={<PublicShell />}>
        <Route index element={<CalculatorPage variant="public" />} />
        <Route path="guide" element={<Navigate to="/" replace />} />
        <Route path="my-orders" element={<ClientMyOrdersPage />} />
        <Route path="*" element={<CalculatorPage variant="public" />} />
      </Route>
    </Routes>
  )
}

export default App
