import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import './AdminApp.css'
import { fetchMaterials, fetchMaterialsFiltered } from './api'

const MODAL_CLOSE_X_SVG = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)
import { BASE_CURRENCY } from './currencies'
import { DECIMAL_FRACTION_DIGITS, formatDecimalStringForUi } from './floatInput'
import type { Material, MaterialCategory, MaterialClass } from './types'

type BaseProps = {
  tree: MaterialCategory[]
  mclasses: MaterialClass[]
  onClose: () => void
}

export type MultiPickMaterialSearchProps = BaseProps & {
  mode?: 'multiPick'
  /** Калькулятор (шаги 2, 4 и 5): флажки и кнопка «Добавить». */
  onPick: (materials: Material[]) => void
}

export type NavigateMaterialSearchProps = BaseProps & {
  mode: 'navigate'
  /** Админка материалов: выбор строки кликом и кнопка «Перейти». */
  onNavigate: (material: Material) => void
}

export type MaterialSearchModalProps = MultiPickMaterialSearchProps | NavigateMaterialSearchProps

const MAT_LIST_COLUMNS = [
  'Артикул',
  'Наименование материала',
  'Ед. измерения',
  'Цена',
] as const

function dashIfEmpty(s: string | undefined | null) {
  const t = (s ?? '').trim()
  return t ? t : '—'
}

function formatListBasePrice(m: Material) {
  const p = formatDecimalStringForUi(String(m.base_price), DECIMAL_FRACTION_DIGITS)
  return `${p} ${m.base_currency || BASE_CURRENCY}`
}

function findPathToId(nodes: MaterialCategory[], id: number): number[] | null {
  const walk = (list: MaterialCategory[], path: number[]): number[] | null => {
    for (const n of list) {
      const nextPath = [...path, n.id]
      if (n.id === id) return nextPath
      const r = walk(n.children ?? [], nextPath)
      if (r) return r
    }
    return null
  }
  return walk(nodes, [])
}

function findCategoryNode(nodes: MaterialCategory[], id: number): MaterialCategory | null {
  for (const n of nodes) {
    if (n.id === id) return n
    const r = findCategoryNode(n.children ?? [], id)
    if (r) return r
  }
  return null
}

function SearchFolderTreeRow({
  c,
  depth,
  selectedId,
  expandedIds,
  onToggle,
  onSelect,
}: {
  c: MaterialCategory
  depth: number
  selectedId: number | null
  expandedIds: Set<number>
  onToggle: (id: number) => void
  onSelect: (id: number | null) => void
}) {
  const hasKids = (c.children?.length ?? 0) > 0
  const isExpanded = hasKids ? expandedIds.has(c.id) : false
  const isSel = selectedId === c.id
  return (
    <li className="folder-explorer-tree-item">
      <div
        className={
          isSel ? 'folder-explorer-tree-line folder-explorer-tree-line--active' : 'folder-explorer-tree-line'
        }
        style={{ paddingLeft: 6 + depth * 14 }}
      >
        {hasKids ? (
          <button
            type="button"
            className="folder-explorer-tree-expander"
            aria-label={isExpanded ? 'Свернуть' : 'Развернуть'}
            aria-expanded={isExpanded}
            onClick={(e) => {
              e.stopPropagation()
              onToggle(c.id)
            }}
          >
            <span aria-hidden>{isExpanded ? '▾' : '▸'}</span>
          </button>
        ) : (
          <span className="folder-explorer-tree-expander folder-explorer-tree-expander--spacer" aria-hidden />
        )}
        <button
          type="button"
          className="folder-explorer-tree-link"
          onClick={() => onSelect(c.id)}
          onDoubleClick={() => {
            onSelect(c.id)
            if (hasKids) onToggle(c.id)
          }}
          title={c.path}
        >
          <span className="folder-explorer-icon" aria-hidden>
            📁
          </span>
          <span className="folder-explorer-tree-name">{c.name}</span>
        </button>
      </div>
      {hasKids && isExpanded && (
        <ul className="folder-explorer-tree-children">
          {(c.children ?? []).map((ch) => (
            <SearchFolderTreeRow
              key={ch.id}
              c={ch}
              depth={depth + 1}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

function collectIdsWithChildren(nodes: MaterialCategory[]): Set<number> {
  const out = new Set<number>()
  const walk = (list: MaterialCategory[]) => {
    for (const n of list) {
      const kids = n.children ?? []
      if (kids.length > 0) {
        out.add(n.id)
        walk(kids)
      }
    }
  }
  walk(nodes)
  return out
}

export function MaterialSearchModal(props: MaterialSearchModalProps) {
  const { tree, onClose } = props
  const isNavigate = props.mode === 'navigate'
  const onPick = !isNavigate ? props.onPick : undefined
  const onNavigate = isNavigate ? props.onNavigate : undefined
  const [selectedTreeId, setSelectedTreeId] = useState<number | null>(null)
  const [materialsRootTreeExpanded, setMaterialsRootTreeExpanded] = useState(true)
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => collectIdsWithChildren(tree))

  const [results, setResults] = useState<Material[]>([])
  const [loading, setLoading] = useState(false)
  const [localErr, setLocalErr] = useState<string | null>(null)
  /** Накопление выбора при смене папки (шаги 2, 4 и 5 калькулятора). */
  const [pickedMaterials, setPickedMaterials] = useState<Map<number, Material>>(() => new Map())
  /** Админка: одна подсвеченная строка перед «Перейти». */
  const [navigateRowId, setNavigateRowId] = useState<number | null>(null)

  useEffect(() => {
    setExpandedIds((prev) => {
      if (prev.size > 0) return prev
      return collectIdsWithChildren(tree)
    })
  }, [tree])

  const onToggle = useCallback((id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const onSelectFolder = useCallback(
    (id: number | null) => {
      setSelectedTreeId(id)
      setLocalErr(null)
      if (id != null) {
        const path = findPathToId(tree, id)
        if (path && path.length > 1) {
          setExpandedIds((prev) => {
            const next = new Set(prev)
            for (const pid of path.slice(0, -1)) next.add(pid)
            return next
          })
        }
      }
    },
    [tree],
  )

  useEffect(() => {
    setLoading(true)
    setLocalErr(null)
    const t = window.setTimeout(() => {
      const request =
        selectedTreeId != null
          ? fetchMaterials(selectedTreeId, { subtree: true })
          : fetchMaterialsFiltered({})
      request
        .then((r) => setResults(r.results))
        .catch((e) => {
          setLocalErr(e instanceof Error ? e.message : String(e))
          setResults([])
        })
        .finally(() => setLoading(false))
    }, 360)
    return () => window.clearTimeout(t)
  }, [selectedTreeId])

  useEffect(() => {
    if (isNavigate) {
      setNavigateRowId((prev) => {
        if (prev == null) return null
        return results.some((m) => m.id === prev) ? prev : null
      })
      return
    }
    if (results.length === 0) return
    setPickedMaterials((prev) => {
      if (prev.size === 0) return prev
      let changed = false
      const next = new Map(prev)
      for (const m of results) {
        if (next.has(m.id) && next.get(m.id) !== m) {
          next.set(m.id, m)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [results, isNavigate])

  const toggleRowPick = useCallback((m: Material) => {
    setPickedMaterials((prev) => {
      const next = new Map(prev)
      if (next.has(m.id)) next.delete(m.id)
      else next.set(m.id, m)
      return next
    })
  }, [])

  const allResultsPicked = results.length > 0 && results.every((m) => pickedMaterials.has(m.id))
  const someResultsPicked = results.some((m) => pickedMaterials.has(m.id))

  const pickAllHeaderRef = useRef<HTMLInputElement>(null)
  useLayoutEffect(() => {
    if (isNavigate) return
    const el = pickAllHeaderRef.current
    if (!el) return
    el.indeterminate = someResultsPicked && !allResultsPicked
  }, [isNavigate, someResultsPicked, allResultsPicked, results])

  const togglePickAllInResults = useCallback(() => {
    setPickedMaterials((prev) => {
      const next = new Map(prev)
      const every = results.length > 0 && results.every((m) => next.has(m.id))
      if (every) {
        for (const m of results) next.delete(m.id)
      } else {
        for (const m of results) next.set(m.id, m)
      }
      return next
    })
  }, [results])

  const confirmPick = useCallback(() => {
    if (!onPick || pickedMaterials.size === 0) return
    onPick([...pickedMaterials.values()])
  }, [pickedMaterials, onPick])

  const confirmNavigate = useCallback(() => {
    if (!onNavigate || navigateRowId == null) return
    const m = results.find((x) => x.id === navigateRowId)
    if (m) onNavigate(m)
  }, [results, navigateRowId, onNavigate])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, loading])

  const materialsHeading = useMemo(() => {
    if (selectedTreeId == null) return 'Материалы: база материалов'
    const node = findCategoryNode(tree, selectedTreeId)
    return `Материалы в папке: ${node?.name?.trim() || '—'}`
  }, [selectedTreeId, tree])

  return createPortal(
    <div
      className="admin-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="material-search-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose()
      }}
    >
      <div
        className="admin-modal admin-modal--explorer material-search-modal"
        role="document"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="admin-modal-head-row">
          <h4 id="material-search-title" className="admin-modal-title">
            Поиск материалов
          </h4>
          <button
            type="button"
            className="admin-primary admin-modal-head-icon-close"
            aria-label="Закрыть"
            title="Закрыть"
            disabled={loading}
            onClick={onClose}
          >
            {MODAL_CLOSE_X_SVG}
          </button>
        </div>

        <div className="admin-body material-search-modal-body" id="material-search-modal">
          <aside className="admin-aside">
            <div className="admin-heading-row">
              <h2 className="admin-h2">Папки материалов</h2>
            </div>
            <ul className="folder-explorer-tree-root admin-materials-tree-root" aria-label="Дерево папок">
              <li className="folder-explorer-tree-item folder-explorer-tree-item--materials-root">
                <div
                  className={
                    selectedTreeId == null
                      ? 'folder-explorer-tree-line folder-explorer-tree-line--active'
                      : 'folder-explorer-tree-line'
                  }
                >
                  {tree.length > 0 ? (
                    <button
                      type="button"
                      className="folder-explorer-tree-expander"
                      aria-label={
                        materialsRootTreeExpanded ? 'Свернуть список папок' : 'Развернуть список папок'
                      }
                      aria-expanded={materialsRootTreeExpanded}
                      onClick={(e) => {
                        e.stopPropagation()
                        setMaterialsRootTreeExpanded((v) => !v)
                      }}
                    >
                      <span aria-hidden>{materialsRootTreeExpanded ? '▾' : '▸'}</span>
                    </button>
                  ) : (
                    <span
                      className="folder-explorer-tree-expander folder-explorer-tree-expander--spacer"
                      aria-hidden
                    />
                  )}
                  <button
                    type="button"
                    className="folder-explorer-tree-link"
                    onClick={() => onSelectFolder(null)}
                    title="База материалов — показать материалы из всех категорий"
                  >
                    <span className="folder-explorer-icon" aria-hidden>
                      🗂️
                    </span>
                    <span className="folder-explorer-tree-name">База материалов</span>
                  </button>
                </div>
                {materialsRootTreeExpanded && tree.length > 0 ? (
                  <ul className="folder-explorer-tree-children">
                    {tree.map((c) => (
                      <SearchFolderTreeRow
                        key={c.id}
                        c={c}
                        depth={0}
                        selectedId={selectedTreeId}
                        expandedIds={expandedIds}
                        onToggle={onToggle}
                        onSelect={onSelectFolder}
                      />
                    ))}
                  </ul>
                ) : null}
              </li>
            </ul>
          </aside>

          <div className="admin-main-col">
            <main className="admin-main">
              <div className="admin-main-scroll">
                <div className="admin-heading-row">
                  <h2 className="admin-h2">{materialsHeading}</h2>
                </div>

                {!isNavigate && pickedMaterials.size > 0 ? (
                  <p className="material-search-picked-count admin-muted">
                    Отмечено: {pickedMaterials.size}
                    {[...pickedMaterials.keys()].some((id) => !results.some((m) => m.id === id))
                      ? ' (в т.ч. вне текущего списка)'
                      : ''}
                  </p>
                ) : null}

                {loading ? (
                  <p className="admin-muted">Загрузка…</p>
                ) : localErr ? (
                  <div className="admin-error admin-error--compact">{localErr}</div>
                ) : results.length === 0 ? (
                  <p className="folder-explorer-empty">Ничего не найдено.</p>
                ) : (
                  <div
                    className="mat-list-table material-search-mat-list"
                    aria-label={
                      selectedTreeId == null
                        ? 'Список всех материалов'
                        : 'Список материалов в папке и вложенных'
                    }
                  >
                    <div
                      className={[
                        'mat-list-item-inner',
                        'mat-list-item-inner--legend',
                        !isNavigate ? 'mat-list-item-inner--pick' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      role="row"
                    >
                      <div
                        className={[
                          'mat-list-legend',
                          !isNavigate ? 'mat-list-legend--pick' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        role="presentation"
                      >
                        {MAT_LIST_COLUMNS.map((label) => (
                          <span key={label} role="columnheader">
                            {label}
                          </span>
                        ))}
                        {!isNavigate ? (
                          <span role="columnheader" className="material-search-pick-legend">
                            <label className="material-search-pick-check material-search-pick-check--legend">
                              <input
                                ref={pickAllHeaderRef}
                                type="checkbox"
                                checked={allResultsPicked}
                                disabled={loading || results.length === 0}
                                onChange={togglePickAllInResults}
                                aria-label="Выбрать все в текущем списке"
                              />
                            </label>
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <ul className="mat-list">
                      {results.map((m) =>
                        isNavigate ? (
                          <li key={m.id} className="mat-list-item">
                            <div className="mat-list-item-inner">
                              <div
                                role="button"
                                tabIndex={0}
                                className={
                                  navigateRowId === m.id
                                    ? 'mat-list-row mat-list-row--active'
                                    : 'mat-list-row'
                                }
                                aria-selected={navigateRowId === m.id}
                                onClick={() => setNavigateRowId(m.id)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault()
                                    if (navigateRowId === m.id) confirmNavigate()
                                    else setNavigateRowId(m.id)
                                  }
                                  if (e.key === ' ') {
                                    e.preventDefault()
                                    setNavigateRowId(m.id)
                                  }
                                }}
                              >
                                <span className="mat-list-cell mat-list-cell-article">
                                  {dashIfEmpty(m.article)}
                                </span>
                                <span className="mat-list-cell mat-list-cell-name">{m.name}</span>
                                <span className="mat-list-cell mat-list-cell-uom">
                                  {m.uom?.short_name || m.uom?.name || '—'}
                                </span>
                                <span className="mat-list-cell mat-list-cell-price">
                                  {formatListBasePrice(m)}
                                </span>
                              </div>
                            </div>
                          </li>
                        ) : (
                          <li key={m.id} className="mat-list-item">
                            <div className="mat-list-item-inner mat-list-item-inner--pick">
                              <div className="mat-list-row mat-list-row--pick">
                                <span className="mat-list-cell mat-list-cell-article">
                                  {dashIfEmpty(m.article)}
                                </span>
                                <span className="mat-list-cell mat-list-cell-name">{m.name}</span>
                                <span className="mat-list-cell mat-list-cell-uom">
                                  {m.uom?.short_name || m.uom?.name || '—'}
                                </span>
                                <span className="mat-list-cell mat-list-cell-price">
                                  {formatListBasePrice(m)}
                                </span>
                                <label className="material-search-pick-check">
                                  <input
                                    type="checkbox"
                                    checked={pickedMaterials.has(m.id)}
                                    onChange={() => toggleRowPick(m)}
                                    aria-label={`Выбрать: ${m.name}`}
                                  />
                                </label>
                              </div>
                            </div>
                          </li>
                        ),
                      )}
                    </ul>
                    {results.length >= 100 ? (
                      <p className="material-search-results-limit admin-muted">
                        Показано не более 100 материалов за запрос.
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            </main>
          </div>
        </div>

        <div className="admin-row mat-form-actions">
          <button type="button" className="admin-secondary" disabled={loading} onClick={onClose}>
            Отмена
          </button>
          {isNavigate ? (
            <button
              type="button"
              className="admin-primary"
              disabled={loading || navigateRowId == null}
              onClick={confirmNavigate}
            >
              Перейти
            </button>
          ) : (
            <button
              type="button"
              className="admin-primary"
              disabled={loading || pickedMaterials.size === 0}
              onClick={confirmPick}
            >
              Добавить
              {pickedMaterials.size > 0 ? ` (${pickedMaterials.size})` : ''}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
