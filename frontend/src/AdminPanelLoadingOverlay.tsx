type AdminPanelLoadingOverlayProps = {
  active: boolean
  /** Для screen readers, например «Загрузка папок материалов». */
  ariaLabel?: string
}

export function adminPanelBodyClass(loading: boolean, baseClass = 'admin-body') {
  return loading ? `${baseClass} admin-body--panel-loading-host` : baseClass
}

export function AdminPanelLoadingOverlay({ active, ariaLabel = 'Загрузка' }: AdminPanelLoadingOverlayProps) {
  if (!active) return null
  return (
    <div
      className="admin-panel-loading"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={ariaLabel}
    >
      <div className="admin-panel-loading__shade" aria-hidden />
      <div className="admin-panel-loading__card">
        <span className="admin-panel-loading__spinner" aria-hidden />
        <span className="admin-panel-loading__label">Загрузка</span>
      </div>
    </div>
  )
}
