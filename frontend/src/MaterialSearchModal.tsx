import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { fetchMaterialsFiltered, type MaterialsListFilterParams } from './api'
import { DECIMAL_FRACTION_DIGITS, filterDecimalInput, formatDecimalStringForUi } from './floatInput'
import type { Material, MaterialCategory, MaterialClass } from './types'

type BaseProps = {
  tree: MaterialCategory[]
  mclasses: MaterialClass[]
  onClose: () => void
}

export type MultiPickMaterialSearchProps = BaseProps & {
  mode?: 'multiPick'
  /** Калькулятор (шаги 2 и 4): флажки и кнопка «Добавить». */
  onPick: (materials: Material[]) => void
}

export type NavigateMaterialSearchProps = BaseProps & {
  mode: 'navigate'
  /** Админка материалов: выбор строки кликом и кнопка «Перейти». */
  onNavigate: (material: Material) => void
}

export type MaterialSearchModalProps = MultiPickMaterialSearchProps | NavigateMaterialSearchProps

const ROOT_LABEL = 'Все папки'

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

function categoryPathString(tree: MaterialCategory[], categoryId: number): string {
  const pathIds = findPathToId(tree, categoryId)
  if (!pathIds?.length) return ''
  const parts: string[] = []
  let level: MaterialCategory[] = tree
  for (const id of pathIds) {
    const node = level.find((n) => n.id === id)
    if (!node) break
    parts.push(node.name)
    level = node.children ?? []
  }
  return parts.join(' / ')
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

function classLabels(m: Material, mclasses: MaterialClass[]): string {
  const ids = m.material_class_ids ?? []
  if (!ids.length) return '—'
  const names = ids
    .map((id) => mclasses.find((c) => c.id === id)?.name)
    .filter((x): x is string => Boolean(x))
  return names.length ? names.join(', ') : '—'
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
  const { tree, mclasses, onClose } = props
  const isNavigate = props.mode === 'navigate'
  const onPick = !isNavigate ? props.onPick : undefined
  const onNavigate = isNavigate ? props.onNavigate : undefined
  const [filterFolderName, setFilterFolderName] = useState('')
  const [filterArticle, setFilterArticle] = useState('')
  const [filterName, setFilterName] = useState('')
  const [filterPrice, setFilterPrice] = useState('')
  const [classIds, setClassIds] = useState<number[]>([])
  const [selectedTreeId, setSelectedTreeId] = useState<number | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => collectIdsWithChildren(tree))

  const [results, setResults] = useState<Material[]>([])
  const [loading, setLoading] = useState(false)
  const [localErr, setLocalErr] = useState<string | null>(null)
  /** Накопление выбора при смене папки/фильтров (шаги 2 и 4 калькулятора). */
  const [pickedMaterials, setPickedMaterials] = useState<Map<number, Material>>(() => new Map())
  /** Админка: одна подсвеченная строка перед «Перейти». */
  const [navigateRowId, setNavigateRowId] = useState<number | null>(null)

  const sortedClasses = useMemo(
    () => [...mclasses].sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    [mclasses]
  )

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

  const onSelectFolder = useCallback((id: number | null) => {
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
  }, [tree])

  const toggleClassId = useCallback((id: number) => {
    setClassIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }, [])

  const hasCriteria = useMemo(() => {
    return (
      selectedTreeId != null ||
      filterFolderName.trim().length > 0 ||
      filterArticle.trim().length > 0 ||
      filterName.trim().length > 0 ||
      filterPrice.trim().length > 0 ||
      classIds.length > 0
    )
  }, [selectedTreeId, filterFolderName, filterArticle, filterName, filterPrice, classIds])

  useEffect(() => {
    if (!hasCriteria) {
      setResults([])
      setLoading(false)
      setLocalErr(null)
      return
    }
    setLoading(true)
    setLocalErr(null)
    const t = window.setTimeout(() => {
      const params: MaterialsListFilterParams = {}
      if (selectedTreeId != null) {
        params.category = selectedTreeId
      } else {
        const fn = filterFolderName.trim()
        if (fn) params.folder_name = fn
      }
      const ar = filterArticle.trim()
      if (ar) params.article = ar
      const nm = filterName.trim()
      if (nm) params.name = nm
      const pr = filterPrice.trim()
      if (pr) params.price = pr
      if (classIds.length) params.material_class_ids = classIds

      fetchMaterialsFiltered(params)
        .then((r) => setResults(r.results))
        .catch((e) => {
          setLocalErr(e instanceof Error ? e.message : String(e))
          setResults([])
        })
        .finally(() => setLoading(false))
    }, 360)
    return () => window.clearTimeout(t)
  }, [
    hasCriteria,
    selectedTreeId,
    filterFolderName,
    filterArticle,
    filterName,
    filterPrice,
    classIds,
  ])

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

  const allResultsPicked =
    results.length > 0 && results.every((m) => pickedMaterials.has(m.id))
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

  const folderFilterDisabled = selectedTreeId != null

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
      <div className="admin-modal admin-modal--explorer" role="document" onClick={(e) => e.stopPropagation()}>
        <h4 id="material-search-title" className="admin-modal-title">
          Поиск материалов
        </h4>

        <form
          className="material-search-filters"
          role="search"
          onSubmit={(e: FormEvent) => e.preventDefault()}
        >
          <label className="material-search-field">
            <span className="material-search-label">Название папки</span>
            <input
              type="text"
              className="admin-input"
              placeholder="Фильтр по имени папки"
              value={filterFolderName}
              disabled={folderFilterDisabled}
              title={
                folderFilterDisabled
                  ? 'Сбросьте выбор папки в дереве слева или выберите «Все папки», чтобы искать по имени папки'
                  : undefined
              }
              onChange={(e) => setFilterFolderName(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="material-search-field">
            <span className="material-search-label">Артикул</span>
            <input
              type="text"
              className="admin-input"
              placeholder="Содержит…"
              value={filterArticle}
              onChange={(e) => setFilterArticle(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="material-search-field">
            <span className="material-search-label">Наименование</span>
            <input
              type="text"
              className="admin-input"
              placeholder="Содержит…"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="material-search-field">
            <span className="material-search-label">Цена</span>
            <input
              type="text"
              className="admin-input"
              inputMode="decimal"
              placeholder={`Точное совпадение, до ${DECIMAL_FRACTION_DIGITS} зн.`}
              value={filterPrice}
              onChange={(e) => setFilterPrice(filterDecimalInput(e.target.value))}
              autoComplete="off"
            />
          </label>
          <fieldset className="material-search-field material-search-field--classes">
            <legend className="material-search-label">Классы материала</legend>
            <div className="material-search-class-chips">
              {sortedClasses.map((mc) => {
                const on = classIds.includes(mc.id)
                return (
                  <label key={mc.id} className="material-search-class-chip">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggleClassId(mc.id)}
                    />
                    <span>{mc.name}</span>
                  </label>
                )
              })}
            </div>
          </fieldset>
        </form>

        <div className="folder-explorer">
          <aside className="folder-explorer-tree" aria-label="Дерево папок">
            <button
              type="button"
              className={
                selectedTreeId == null
                  ? 'folder-explorer-root folder-explorer-root--active'
                  : 'folder-explorer-root'
              }
              onClick={() => onSelectFolder(null)}
            >
              <span className="folder-explorer-icon" aria-hidden>
                🗂️
              </span>
              {ROOT_LABEL}
            </button>
            <ul className="folder-explorer-tree-root">
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
          </aside>

          <section className="folder-explorer-content material-search-results-panel" aria-label="Результаты поиска">
            {!hasCriteria ? (
              <p className="folder-explorer-empty">
                Задайте фильтры сверху и/или выберите папку в дереве — список обновится автоматически.
              </p>
            ) : loading ? (
              <p className="admin-muted">Загрузка…</p>
            ) : localErr ? (
              <div className="admin-error admin-error--compact">{localErr}</div>
            ) : results.length === 0 ? (
              <p className="folder-explorer-empty">Ничего не найдено.</p>
            ) : (
              <div className="material-search-results-wrap">
                <p className="material-search-results-count admin-muted">
                  Найдено: {results.length}
                  {results.length >= 100 ? ' (не более 100 за запрос)' : ''}
                  {!isNavigate && pickedMaterials.size > 0
                    ? ` · Всего отмечено: ${pickedMaterials.size}${
                        [...pickedMaterials.keys()].some((id) => !results.some((m) => m.id === id))
                          ? ' (в т.ч. вне текущего списка)'
                          : ''
                      }`
                    : ''}
                  {isNavigate && results.length > 0 && navigateRowId == null
                    ? ' · Кликните по строке, затем «Перейти».'
                    : ''}
                </p>
                <div
                  className={[
                    'material-search-results-table',
                    isNavigate ? 'material-search-results-table--navigate' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  role="grid"
                  aria-label="Таблица результатов"
                >
                  <div className="material-search-results-legend" role="row">
                    <span role="columnheader">Артикул</span>
                    <span role="columnheader">Наименование</span>
                    <span role="columnheader">Цена</span>
                    <span role="columnheader">Классы</span>
                    <span role="columnheader">Папка</span>
                    {!isNavigate && (
                      <span role="columnheader" className="material-search-legend-pick">
                        <label className="material-search-result-check material-search-legend-check">
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
                    )}
                  </div>
                  <ul className="material-search-results-list">
                    {results.map((m) =>
                      isNavigate ? (
                        <li
                          key={m.id}
                          role="row"
                          tabIndex={0}
                          className={[
                            'material-search-result-line',
                            'material-search-result-line--navigate',
                            navigateRowId === m.id ? 'material-search-result-line--selected' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          onClick={() => setNavigateRowId(m.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              if (navigateRowId === m.id) confirmNavigate()
                              else setNavigateRowId(m.id)
                              return
                            }
                            if (e.key === ' ') {
                              e.preventDefault()
                              setNavigateRowId(m.id)
                            }
                          }}
                          aria-selected={navigateRowId === m.id}
                        >
                          <span className="material-search-result-cell">{m.article?.trim() || '—'}</span>
                          <span className="material-search-result-cell material-search-result-cell--name">
                            {m.name}
                          </span>
                          <span className="material-search-result-cell">
                            {formatDecimalStringForUi(String(m.base_price), DECIMAL_FRACTION_DIGITS)}{' '}
                            {m.base_currency || ''}
                          </span>
                          <span className="material-search-result-cell material-search-result-cell--classes">
                            {classLabels(m, mclasses)}
                          </span>
                          <span className="material-search-result-cell material-search-result-cell--path">
                            {categoryPathString(tree, m.category) || '—'}
                          </span>
                        </li>
                      ) : (
                        <li key={m.id} className="material-search-result-line" role="row">
                          <span className="material-search-result-cell">{m.article?.trim() || '—'}</span>
                          <span className="material-search-result-cell material-search-result-cell--name">
                            {m.name}
                          </span>
                          <span className="material-search-result-cell">
                            {formatDecimalStringForUi(String(m.base_price), DECIMAL_FRACTION_DIGITS)}{' '}
                            {m.base_currency || ''}
                          </span>
                          <span className="material-search-result-cell material-search-result-cell--classes">
                            {classLabels(m, mclasses)}
                          </span>
                          <span className="material-search-result-cell material-search-result-cell--path">
                            {categoryPathString(tree, m.category) || '—'}
                          </span>
                          <label className="material-search-result-check">
                            <input
                              type="checkbox"
                              checked={pickedMaterials.has(m.id)}
                              onChange={() => toggleRowPick(m)}
                              aria-label={`Выбрать: ${m.name}`}
                            />
                          </label>
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="admin-modal-actions">
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
          <button type="button" className="admin-secondary" disabled={loading} onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
