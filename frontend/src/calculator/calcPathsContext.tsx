import { createContext, useContext, useMemo, type ReactNode } from 'react'

export type CalcPathsContextValue = {
  /** '' для публичных URL (/frame), '/calculator' для админки */
  base: string
  home: string
  readOnly: boolean
  step: (rel: string) => string
}

const Ctx = createContext<CalcPathsContextValue | null>(null)

export function normalizedCalcPath(pathname: string, base: string): string {
  const b = base.replace(/\/$/, '')
  const path = (pathname.replace(/\/$/, '') || '/').toLowerCase()
  if (b && path.startsWith(b.toLowerCase())) {
    return path.slice(b.length) || '/'
  }
  return path
}

export function facadeFromNormalized(normalized: string): 'frame' | 'mdf' | 'pvc' | null {
  if (normalized === '/' || normalized === '') return null
  const n = normalized.toLowerCase()
  if (n.startsWith('/frame')) return 'frame'
  if (n.startsWith('/mdf')) return 'mdf'
  if (n.startsWith('/pvc')) return 'pvc'
  return null
}

export function CalcPathsProvider({
  base,
  readOnly,
  children,
}: {
  base: string
  readOnly: boolean
  children: ReactNode
}) {
  const value = useMemo<CalcPathsContextValue>(() => {
    const b = base.replace(/\/$/, '')
    const step = (rel: string) => {
      const r = rel.replace(/^\//, '')
      if (!r) return b || '/'
      return b ? `${b}/${r}` : `/${r}`
    }
    const home = step('')
    return { base: b, home, readOnly, step }
  }, [base, readOnly])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCalcPaths(): CalcPathsContextValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useCalcPaths: нет CalcPathsProvider')
  return v
}
