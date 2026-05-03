import { FormEvent, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { registerAccount } from './api'
import './LoginPage.css'
import './RegisterPage.css'

export function RegisterPage() {
  const nav = useNavigate()
  const loc = useLocation()
  const returnTo = (loc.state as { from?: string } | null)?.from
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    if (password !== password2) {
      setErr('Пароли не совпадают.')
      return
    }
    setLoading(true)
    registerAccount({
      username: username.trim(),
      password,
      email: email.trim() || undefined,
    })
      .then(() =>
        nav('/login', {
          replace: true,
          state: returnTo ? { from: returnTo } : undefined,
        }),
      )
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1 className="login-title">Регистрация</h1>
        <form className="login-form" onSubmit={submit}>
          {err && <div className="login-error">{err}</div>}
          <label className="login-field">
            <span>Имя пользователя</span>
            <input
              className="login-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label className="login-field">
            <span>Email (необязательно)</span>
            <input
              className="login-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          <label className="login-field">
            <span>Пароль (не короче 8 символов)</span>
            <input
              className="login-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
            />
          </label>
          <label className="login-field">
            <span>Пароль ещё раз</span>
            <input
              className="login-input"
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
            />
          </label>
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Регистрация…' : 'Зарегистрироваться'}
          </button>
        </form>
        <div className="register-page__actions register-page__actions--after-form">
          <Link
            to="/login"
            state={returnTo ? { from: returnTo } : undefined}
            className="register-page__link register-page__link--secondary"
          >
            Уже есть аккаунт — вход
          </Link>
          <Link to="/" className="register-page__link register-page__link--secondary">
            На главную
          </Link>
        </div>
      </div>
    </div>
  )
}
