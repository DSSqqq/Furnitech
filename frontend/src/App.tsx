import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import AdminApp from './AdminApp'
import { CalculatorPage } from './CalculatorPage'
import { clearTokens, type Me, fetchMe, hasValidSession } from './auth'
import { LoginPage } from './LoginPage'
import './App.css'

type AuthState = { phase: 'loading' } | { phase: 'guest' } | { phase: 'authed'; user: Me }

function LoginRoute({ onAfterLogin }: { onAfterLogin: () => Promise<void> }) {
  const nav = useNavigate()
  const loc = useLocation()
  const from = (loc.state as { from?: string } | null)?.from ?? '/materials'
  return (
    <LoginPage
      onSuccess={() => {
        void onAfterLogin().then(() => nav(from, { replace: true }))
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
  return <>{children(auth.user)}</>
}

function PublicShell() {
  const [auth, setAuth] = useState<AuthState>({ phase: 'loading' })

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

  return (
    <div className="public-shell">
      <header className="public-shell__header">
        <Link to="/" className="public-shell__brand">
          Фурнитех
        </Link>
        <nav className="public-shell__nav" aria-label="Служебные ссылки">
          {auth.phase === 'authed' ? (
            <Link to="/materials" className="public-shell__link">
              Админка
            </Link>
          ) : (
            <Link to="/login" className="public-shell__link">
              Вход для сотрудников
            </Link>
          )}
        </nav>
      </header>
      <CalculatorPage variant="public" />
    </div>
  )
}

function App() {
  const [auth, setAuth] = useState<AuthState>({ phase: 'loading' })

  const refreshAuth = useCallback(async () => {
    setAuth({ phase: 'loading' })
    const ok = await hasValidSession()
    if (!ok) {
      setAuth({ phase: 'guest' })
      return
    }
    const m = await fetchMe()
    if (!m) setAuth({ phase: 'guest' })
    else setAuth({ phase: 'authed', user: m })
  }, [])

  const logout = useCallback(() => {
    clearTokens()
    setAuth({ phase: 'guest' })
  }, [])

  useEffect(() => {
    void refreshAuth()
  }, [refreshAuth])

  return (
    <Routes>
      <Route path="/login" element={<LoginRoute onAfterLogin={refreshAuth} />} />
      <Route
        path="/materials/*"
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
        path="/orders/*"
        element={
          <AdminRoute auth={auth}>
            {(user) => <AdminApp user={user} onLogout={logout} />}
          </AdminRoute>
        }
      />
      <Route path="/*" element={<PublicShell />} />
    </Routes>
  )
}

export default App
