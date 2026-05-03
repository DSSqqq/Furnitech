import { useCallback, useEffect, useState } from 'react'
import type { FacadeOrder, FacadeOrderStatus } from './api'
import { fetchFacadeOrders, patchFacadeOrderStatus } from './api'
import { FtSelect, type FtSelectOption } from './FtSelect'
import { HintButton } from './HintButton'

const STATUS_OPTIONS: FtSelectOption[] = [
  { value: 'not_confirmed', label: 'Не подтверждён' },
  { value: 'confirmed', label: 'Подтверждён' },
  { value: 'in_production', label: 'В процессе сборки' },
  { value: 'ready', label: 'Готов к выдаче' },
  { value: 'completed', label: 'Завершён' },
]

function formatDt(iso: string): string {
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

export function AdminOrdersPanel() {
  const [rows, setRows] = useState<FacadeOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [statusPending, setStatusPending] = useState<number | null>(null)

  const load = useCallback(() => {
    setErr(null)
    setLoading(true)
    return fetchFacadeOrders()
      .then((data) => setRows(data.results ?? []))
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onStatusChange = (id: number, status: FacadeOrderStatus) => {
    setStatusPending(id)
    patchFacadeOrderStatus(id, status)
      .then((updated) => {
        setRows((prev) => prev.map((r) => (r.id === id ? updated : r)))
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setStatusPending(null))
  }

  return (
    <div className="admin-orders-layout">
      <div className="admin-heading-row">
        <h2 className="admin-h2">Заказы</h2>
        <div className="admin-orders-toolbar">
          <button type="button" className="admin-secondary admin-secondary--sm" onClick={() => void load()}>
            Обновить
          </button>
          <HintButton text="Заказы создаются, когда клиент на сайте на шаге «Итог» нажимает «Отправить менеджеру». Статус меняйте по мере работы: созвон, подтверждение, сборка, готовность к выдаче, после выдачи — «Завершён»." />
        </div>
      </div>
      {err ? <div className="admin-error admin-error--compact">{err}</div> : null}
      {loading ? (
        <p className="admin-muted">Загрузка заказов…</p>
      ) : rows.length === 0 ? (
        <p className="admin-muted">Пока нет заказов из калькулятора.</p>
      ) : (
        <div className="admin-orders-table-wrap">
          <table className="admin-orders-table">
            <thead>
              <tr>
                <th scope="col">Номер</th>
                <th scope="col">Дата</th>
                <th scope="col">Клиент</th>
                <th scope="col">Контакты в заявке</th>
                <th scope="col">Статус</th>
                <th scope="col">PDF</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id}>
                  <td className="admin-orders-mono">{o.order_number}</td>
                  <td>{formatDt(o.created_at)}</td>
                  <td>
                    <span className="admin-orders-cell-strong">{o.client_username}</span>
                    {o.client_email ? (
                      <span className="admin-orders-cell-sub">{o.client_email}</span>
                    ) : null}
                  </td>
                  <td className="admin-orders-contacts">
                    <div>{o.contact_name || '—'}</div>
                    <div className="admin-orders-cell-sub">{o.contact_phone || '—'}</div>
                    <div className="admin-orders-cell-sub">{o.contact_email || '—'}</div>
                  </td>
                  <td className="admin-orders-status-cell">
                    <FtSelect
                      className="admin-orders-status-ft"
                      value={o.status}
                      options={STATUS_OPTIONS}
                      disabled={statusPending === o.id}
                      onChange={(v) => onStatusChange(o.id, v as FacadeOrderStatus)}
                      aria-label={`Статус заказа ${o.order_number}`}
                    />
                  </td>
                  <td>
                    {o.pdf_url ? (
                      <a
                        className="admin-orders-pdf-link"
                        href={o.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Открыть PDF
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
