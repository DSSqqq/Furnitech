import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import type { FacadeOrder, FacadeOrderStatus } from './api'
import { fetchFacadeOrders } from './api'
import { openFacadeOrderPdf } from './calculator/orderPdfFromSnapshot'
import type { Me } from './auth'
import { HintButton } from './HintButton'
import './PublicClientPages.css'

export type PublicAuthState =
  | { phase: 'loading' }
  | { phase: 'guest' }
  | { phase: 'authed'; user: Me }

export type PublicShellOutletContext = {
  auth: PublicAuthState
}

/** Маршруты сценария калькулятора на публичном сайте (вкладка «Калькулятор»). */
export function isPublicCalculatorRoute(pathname: string): boolean {
  const p = pathname.replace(/\/$/, '') || '/'
  if (p === '/') return true
  if (p === '/mdf' || p === '/pvc') return true
  if (p.startsWith('/frame')) return true
  if (p.startsWith('/mdf/') || p.startsWith('/pvc/')) return true
  return false
}

/** Статус в карточке (коротко); пояснение — через кнопку «i» (HintButton), как в админке. */
const CLIENT_ORDER_STATUS: Record<FacadeOrderStatus, { label: string; hint: string }> = {
  not_confirmed: {
    label: 'Ожидает подтверждения',
    hint: 'Менеджер свяжется с вами для подтверждения',
  },
  confirmed: {
    label: 'Подтверждён',
    hint: 'Заказ согласован с клиентом',
  },
  in_production: {
    label: 'В процессе сборки',
    hint: 'Изделие собирают',
  },
  ready: {
    label: 'Готов к выдаче',
    hint: 'Можно забирать заказ',
  },
  completed: {
    label: 'Завершён',
    hint: 'Заказ выдан, работа по нему закрыта',
  },
}

function clientOrderStatusUi(o: FacadeOrder): { label: string; hint: string } {
  const c = CLIENT_ORDER_STATUS[o.status]
  if (c) return c
  return { label: o.status_display, hint: o.status_display }
}

function formatOrderDt(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function ClientMyOrdersPage() {
  const { auth } = useOutletContext<PublicShellOutletContext>()
  const [orders, setOrders] = useState<FacadeOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [pdfPendingId, setPdfPendingId] = useState<number | null>(null)

  useEffect(() => {
    if (auth.phase !== 'authed') return
    setLoading(true)
    setErr(null)
    fetchFacadeOrders()
      .then((d) => setOrders(d.results ?? []))
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [auth])

  if (auth.phase === 'loading') {
    return (
      <main className="public-page public-page--orders">
        <p className="public-page__muted">Загрузка…</p>
      </main>
    )
  }

  if (auth.phase === 'guest') {
    return (
      <main className="public-page public-page--orders">
        <div className="public-page__inner">
          <h1 className="public-page__title">Мои заказы</h1>
          <p className="public-page__lead">Войдите в аккаунт, чтобы видеть список своих заказов.</p>
          <Link to="/login" state={{ from: '/my-orders' }} className="public-page__cta">
            Войти
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="public-page public-page--orders">
      <div className="public-page__inner">
        <h1 className="public-page__title">Мои заказы</h1>
        {loading ? <p className="public-page__muted">Загрузка списка…</p> : null}
        {err ? <p className="public-orders-error">{err}</p> : null}
        {!loading && !err && orders.length === 0 ? (
          <p className="public-page__muted">Пока нет заказов.</p>
        ) : null}
        {!loading && !err && orders.length > 0 ? (
          <ul className="public-orders-list">
            {orders.map((o) => {
              const st = clientOrderStatusUi(o)
              return (
              <li key={o.id} className="public-orders-card">
                <div className="public-orders-card__row">
                  <span className="public-orders-card__num">{o.order_number}</span>
                  <div className="public-orders-card__status-wrap">
                    <span className="public-orders-card__status">{st.label}</span>
                    <HintButton text={st.hint} />
                  </div>
                </div>
                <p className="public-orders-card__date">{formatOrderDt(o.created_at)}</p>
                {o.snapshot && Object.keys(o.snapshot).length > 0 ? (
                  <button
                    type="button"
                    className="public-orders-card__pdf"
                    disabled={pdfPendingId === o.id}
                    onClick={() => {
                      setPdfPendingId(o.id)
                      openFacadeOrderPdf(o)
                        .catch((e) => {
                          if (e instanceof Error && e.message === 'popup_blocked') return
                          setErr(e instanceof Error ? e.message : String(e))
                        })
                        .finally(() => setPdfPendingId(null))
                    }}
                  >
                    {pdfPendingId === o.id ? 'Формируем PDF…' : 'Открыть PDF расчёта'}
                  </button>
                ) : o.pdf_url ? (
                  <a
                    className="public-orders-card__pdf"
                    href={o.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    PDF (архив)
                  </a>
                ) : (
                  <span className="public-page__muted">PDF недоступен</span>
                )}
              </li>
            )})}
          </ul>
        ) : null}
        <Link to="/" className="public-page__cta public-page__cta--secondary">
          В калькулятор
        </Link>
      </div>
    </main>
  )
}
