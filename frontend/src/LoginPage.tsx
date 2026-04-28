import { FormEvent, useState } from 'react'
import { login } from './auth'
import './LoginPage.css'

type Props = {
  onSuccess: () => void
}

export function LoginPage({ onSuccess }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    setLoading(true)
    login(username.trim(), password)
      .then(() => onSuccess())
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1 className="login-title">Фурнитех</h1>
        <form onSubmit={submit} className="login-form">
          {err && <div className="login-error">{err}</div>}
          <label className="login-field">
            <span>Логин (email / имя)</span>
            <input
              className="login-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label className="login-field">
            <span>Пароль</span>
            <input
              type="password"
              className="login-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Вход…' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default LoginPage
