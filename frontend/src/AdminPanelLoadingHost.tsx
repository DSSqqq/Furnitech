import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from 'react'
import { AdminPanelLoadingOverlay, adminPanelBodyClass } from './AdminPanelLoadingOverlay'

type PanelLoadingCtx = {
  setLoading: (key: string, active: boolean) => void
}

const PanelLoadingContext = createContext<PanelLoadingCtx | null>(null)

type AdminPanelLoadingHostProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
  ariaLabel?: string
}

/** Оболочка панели админки: оверлей на всю область, пока хоть один дочерний блок грузится. */
export const AdminPanelLoadingHost = forwardRef<HTMLDivElement, AdminPanelLoadingHostProps>(
  function AdminPanelLoadingHost(
    { children, ariaLabel = 'Загрузка', className = 'admin-body', ...rest },
    ref,
  ) {
  const [flags, setFlags] = useState<Record<string, boolean>>({})

  const setLoading = useCallback((key: string, active: boolean) => {
    setFlags((prev) => {
      if (active) {
        if (prev[key]) return prev
        return { ...prev, [key]: true }
      }
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [])

  const active = useMemo(() => Object.values(flags).some(Boolean), [flags])
  const ctx = useMemo(() => ({ setLoading }), [setLoading])

  return (
    <div ref={ref} className={adminPanelBodyClass(active, className)} {...rest}>
      <AdminPanelLoadingOverlay active={active} ariaLabel={ariaLabel} />
      <PanelLoadingContext.Provider value={ctx}>{children}</PanelLoadingContext.Provider>
    </div>
  )
  },
)

/** Регистрирует флаг загрузки внутри AdminPanelLoadingHost (или no-op вне хоста). */
export function usePanelLoading(key: string, loading: boolean) {
  const ctx = useContext(PanelLoadingContext)
  useEffect(() => {
    if (!ctx) return
    ctx.setLoading(key, loading)
    return () => ctx.setLoading(key, false)
  }, [ctx, key, loading])
}

/** Несколько именованных флагов без дублирования usePanelLoading в каждом экране. */
export function PanelLoadingFlags({
  tree = false,
  list = false,
  items = false,
  route = false,
  data = false,
}: {
  tree?: boolean
  list?: boolean
  items?: boolean
  route?: boolean
  data?: boolean
}) {
  usePanelLoading('tree', tree)
  usePanelLoading('list', list)
  usePanelLoading('items', items)
  usePanelLoading('route', route)
  usePanelLoading('data', data)
  return null
}
