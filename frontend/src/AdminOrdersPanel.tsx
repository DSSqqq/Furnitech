import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AdminPanelLoadingOverlay, adminPanelBodyClass } from './AdminPanelLoadingOverlay'
import type { FacadeOrder, FacadeOrderPaymentStatus, FacadeOrderStatus } from './api'
import { deleteFacadeOrder, fetchFacadeOrders, patchFacadeOrderPaymentStatus, patchFacadeOrderStatus } from './api'
import { openFacadeOrderPdf } from './calculator/orderPdfFromSnapshot'
import { FtSelect, type FtSelectOption } from './FtSelect'

const STATUS_OPTIONS: FtSelectOption[] = [
  { value: 'not_confirmed', label: 'Не подтверждён' },
  { value: 'confirmed', label: 'Подтверждён' },
  { value: 'in_production', label: 'В процессе сборки' },
  { value: 'ready', label: 'Готов к выдаче' },
  { value: 'completed', label: 'Завершён' },
]

const PAYMENT_STATUS_OPTIONS: FtSelectOption[] = [
  { value: 'unpaid', label: 'Не оплачен' },
  { value: 'partial', label: 'Частично оплачен' },
  { value: 'paid', label: 'Оплачен' },
]

function orderStatusClass(status: FacadeOrderStatus): string {
  switch (status) {
    case 'not_confirmed':
      return 'admin-orders-status-ft--status-not-confirmed'
    case 'confirmed':
      return 'admin-orders-status-ft--status-confirmed'
    case 'in_production':
      return 'admin-orders-status-ft--status-in-production'
    case 'ready':
      return 'admin-orders-status-ft--status-ready'
    case 'completed':
      return 'admin-orders-status-ft--status-completed'
    default:
      return ''
  }
}

function orderPaymentStatusClass(paymentStatus: FacadeOrderPaymentStatus): string {
  switch (paymentStatus) {
    case 'unpaid':
      return 'admin-orders-status-ft--pay-unpaid'
    case 'partial':
      return 'admin-orders-status-ft--pay-partial'
    case 'paid':
      return 'admin-orders-status-ft--pay-paid'
    default:
      return ''
  }
}

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

type AdminOrdersPanelProps = {
  canDelete?: boolean
}

export function AdminOrdersPanel({ canDelete = true }: AdminOrdersPanelProps) {
  const [rows, setRows] = useState<FacadeOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [statusPending, setStatusPending] = useState<number | null>(null)
  const [orderToDelete, setOrderToDelete] = useState<FacadeOrder | null>(null)
  const [deletePending, setDeletePending] = useState(false)
  const [pdfPendingId, setPdfPendingId] = useState<number | null>(null)

  const load = useCallback(() => {
    setErr(null)
    setLoading(true)
    return fetchFacadeOrders({ scope: 'admin' })
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

  const onPaymentStatusChange = (id: number, payment_status: FacadeOrderPaymentStatus) => {
    setStatusPending(id)
    patchFacadeOrderPaymentStatus(id, payment_status)
      .then((updated) => {
        setRows((prev) => prev.map((r) => (r.id === id ? updated : r)))
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setStatusPending(null))
  }

  const onOpenOrderPdf = (order: FacadeOrder) => {
    setPdfPendingId(order.id)
    setErr(null)
    openFacadeOrderPdf(order)
      .catch((e) => {
        if (e instanceof Error && e.message === 'popup_blocked') return
        setErr(e instanceof Error ? e.message : String(e))
      })
      .finally(() => setPdfPendingId(null))
  }

  const confirmDeleteOrder = () => {
    if (!orderToDelete) return
    const id = orderToDelete.id
    setDeletePending(true)
    setErr(null)
    deleteFacadeOrder(id)
      .then(() => {
        setRows((prev) => prev.filter((r) => r.id !== id))
        setOrderToDelete(null)
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setDeletePending(false))
  }

  return (
    <>
    <div className={adminPanelBodyClass(loading, 'admin-orders-layout')}>
      <AdminPanelLoadingOverlay active={loading} ariaLabel="Загрузка заказов" />
      <div className="admin-heading-row">
        <h2 className="admin-h2">Заказы</h2>
        <div className="admin-orders-toolbar">
          <button type="button" className="admin-secondary admin-secondary--sm" onClick={() => void load()}>
            Обновить
          </button>
        </div>
      </div>
      {err ? <div className="admin-error admin-error--compact">{err}</div> : null}
      {!loading && rows.length === 0 ? (
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
                <th scope="col">Статус оплаты</th>
                <th scope="col">PDF</th>
                <th scope="col" className="admin-orders-actions-th">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id}>
                  <td className="admin-orders-mono" data-label="Номер">{o.order_number}</td>
                  <td data-label="Дата">{formatDt(o.created_at)}</td>
                  <td data-label="Клиент">
                    <span className="admin-orders-cell-strong">{o.client_username}</span>
                    {o.client_email ? (
                      <span className="admin-orders-cell-sub">{o.client_email}</span>
                    ) : null}
                  </td>
                  <td className="admin-orders-contacts" data-label="Контакты">
                    <div>{o.contact_name || '—'}</div>
                    <div className="admin-orders-cell-sub">{o.contact_phone || '—'}</div>
                    <div className="admin-orders-cell-sub">{o.contact_email || '—'}</div>
                  </td>
                  <td className="admin-orders-status-cell" data-label="Статус">
                    <FtSelect
                      className={`admin-orders-status-ft ${orderStatusClass(o.status)}`}
                      value={o.status}
                      options={STATUS_OPTIONS}
                      disabled={statusPending === o.id}
                      onChange={(v) => onStatusChange(o.id, v as FacadeOrderStatus)}
                      aria-label={`Статус заказа ${o.order_number}`}
                    />
                  </td>
                  <td className="admin-orders-status-cell" data-label="Статус оплаты">
                    <FtSelect
                      className={`admin-orders-status-ft ${orderPaymentStatusClass(o.payment_status)}`}
                      value={o.payment_status}
                      options={PAYMENT_STATUS_OPTIONS}
                      disabled={statusPending === o.id}
                      onChange={(v) => onPaymentStatusChange(o.id, v as FacadeOrderPaymentStatus)}
                      aria-label={`Статус оплаты заказа ${o.order_number}`}
                    />
                  </td>
                  <td className="admin-orders-pdf-cell" data-label="PDF">
                    {o.snapshot && Object.keys(o.snapshot).length > 0 ? (
                      <button
                        type="button"
                        className="admin-orders-pdf-link"
                        disabled={pdfPendingId === o.id}
                        onClick={() => onOpenOrderPdf(o)}
                      >
                        {pdfPendingId === o.id ? 'Формируем…' : 'Открыть PDF'}
                      </button>
                    ) : o.pdf_url ? (
                      <a
                        className="admin-orders-pdf-link"
                        href={o.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        PDF (архив)
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="admin-orders-actions-cell" data-label="Действия">
                    {canDelete ? (
                      <button
                        type="button"
                        className="admin-secondary admin-secondary--sm admin-danger"
                        disabled={statusPending === o.id || deletePending}
                        onClick={() => setOrderToDelete(o)}
                      >
                        Удалить
                      </button>
                    ) : (
                      <span className="admin-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
    {orderToDelete
      ? createPortal(
          <div
            className="admin-modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-delete-title"
            onClick={(e) => {
              if (e.target === e.currentTarget && !deletePending) setOrderToDelete(null)
            }}
          >
            <div className="admin-modal" role="document" onClick={(e) => e.stopPropagation()}>
              <h4 id="order-delete-title" className="admin-modal-title">
                Удалить заказ?
              </h4>
              <p className="admin-modal-text">
                Заказ «{orderToDelete.order_number}» будет удалён безвозвратно (включая PDF). Клиент больше не увидит его в «Мои заказы». Продолжить?
              </p>
              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="admin-secondary"
                  disabled={deletePending}
                  onClick={() => setOrderToDelete(null)}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="admin-primary admin-modal-confirm"
                  disabled={deletePending}
                  onClick={confirmDeleteOrder}
                >
                  {deletePending ? 'Удаление…' : 'Удалить'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null}
    </>
  )
}
