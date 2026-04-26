import { useCallback, useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import AdminApp from './AdminApp'
import { clearTokens, type Me, fetchMe, hasValidSession } from './auth'
import { LoginPage } from './LoginPage'
import './App.css'

type Gate = 'loading' | 'in' | 'out'

function App() {
  const [gate, setGate] = useState<Gate>('loading')
  const [user, setUser] = useState<Me | null>(null)

  const check = useCallback(() => {
    setGate('loading')
    hasValidSession().then((ok) => {
      if (!ok) {
        setUser(null)
        setGate('out')
        return
      }
      fetchMe().then((m) => {
        if (!m) {
          setUser(null)
          setGate('out')
          return
        }
        setUser(m)
        setGate('in')
      })
    })
  }, [])

  useEffect(() => {
    check()
  }, [check])

  if (gate === 'loading') {
    return <p className="app-loading">Проверка сессии…</p>
  }
  if (gate === 'out' || !user) {
    return <LoginPage onSuccess={check} />
  }
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/materials" replace />} />
      <Route
        path="/materials/*"
        element={
          <AdminApp
            user={user}
            onLogout={() => {
              clearTokens()
              setUser(null)
              setGate('out')
            }}
          />
        }
      />
      <Route
        path="/calculator/*"
        element={
          <AdminApp
            user={user}
            onLogout={() => {
              clearTokens()
              setUser(null)
              setGate('out')
            }}
          />
        }
      />
      <Route
        path="/orders/*"
        element={
          <AdminApp
            user={user}
            onLogout={() => {
              clearTokens()
              setUser(null)
              setGate('out')
            }}
          />
        }
      />
      <Route path="*" element={<Navigate to="/materials" replace />} />
    </Routes>
  )
}

export default App
