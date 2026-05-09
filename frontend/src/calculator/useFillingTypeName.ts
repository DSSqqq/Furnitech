import { useEffect, useState } from 'react'
import { fetchCalculatorFillingTypes } from '../api'

/** Имя типа наполнения по `calc_filling_type_id` в localStorage; перезагрузка при смене ключа сессии. */
export function useFillingTypeName(cfgKey: string): string {
  const [name, setName] = useState('')
  useEffect(() => {
    let cancel = false
    let tid: string | null = null
    try {
      tid = localStorage.getItem('calc_filling_type_id')
    } catch {
      tid = null
    }
    if (!tid) {
      setName('')
      return
    }
    void fetchCalculatorFillingTypes()
      .then((r) => {
        if (cancel) return
        const t = (r.results ?? []).find((x) => x.id === Number(tid))
        setName((t?.name ?? '').trim())
      })
      .catch(() => {
        if (!cancel) setName('')
      })
    return () => {
      cancel = true
    }
  }, [cfgKey])
  return name
}
