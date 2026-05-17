import type { ReactNode } from 'react'

export function AdminFolderToolbarIcon({
  label,
  disabled,
  onClick,
  className,
  children,
  ariaExpanded,
  ariaHasPopup,
}: {
  label: string
  disabled?: boolean
  onClick?: () => void
  className?: string
  children: ReactNode
  ariaExpanded?: boolean
  ariaHasPopup?: boolean | 'menu'
}) {
  return (
    <button
      type="button"
      className={className ? `admin-folder-toolbar-btn ${className}` : 'admin-folder-toolbar-btn'}
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      aria-expanded={ariaExpanded}
      aria-haspopup={ariaHasPopup}
    >
      {children}
    </button>
  )
}
