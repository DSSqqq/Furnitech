import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { fetchMaterials, fetchMaterialsFiltered, searchMaterials } from './api'
import { BASE_CURRENCY } from './currencies'
import { DECIMAL_FRACTION_DIGITS, formatDecimalStringForUi } from './floatInput'
import type { Material, MaterialCategory } from './types'

const ROOT_LABEL = 'База материалов'

const RELATED_MAT_LIST_COLUMNS = ['Артикул', 'Наименование материала', 'Ед. измерения', 'Цена'] as const

function dashIfEmpty(s: string | undefined | null) {
  const t = (s ?? '').trim()
  return t ? t : '—'
}

function formatRelatedPickPrice(m: Material) {
  const p = formatDecimalStringForUi(String(m.base_price), DECIMAL_FRACTION_DIGITS)
  return `${p} ${m.base_currency || BASE_CURRENCY}`
}

function RelatedPickMatListTable({
  items,
  loading,
  emptyText,
  onPickRow,
}: {
  items: Material[]
  loading: boolean
  emptyText: string
  onPickRow: (m: Material) => void
}) {
  return (
    <div className="mat-list-table material-related-pick-mat-list" aria-label="Список материалов для выбора">
      <div className="mat-list-item-inner mat-list-item-inner--legend" role="row">
        <div className="mat-list-legend" role="presentation">
          {RELATED_MAT_LIST_COLUMNS.map((label) => (
            <span key={label} role="columnheader">
              {label}
            </span>
          ))}
        </div>
      </div>
      {loading ? (
        <p className="admin-muted material-related-pick-mat-list-loading">Загрузка материалов…</p>
      ) : items.length === 0 ? (
        <p className="folder-explorer-empty">{emptyText}</p>
      ) : (
        <ul className="mat-list">
          {items.map((m) => (
            <li key={m.id} className="mat-list-item">
              <button
                type="button"
                className="mat-list-row"
                title={m.name}
                aria-label={`Выбрать: ${m.name || 'материал'}`}
                onClick={() => onPickRow(m)}
              >
                <span className="mat-list-cell mat-list-cell-article">{dashIfEmpty(m.article)}</span>
                <span className="mat-list-cell mat-list-cell-name">{m.name}</span>
                <span className="mat-list-cell mat-list-cell-uom">{m.uom?.short_name || m.uom?.name || '—'}</span>
                <span className="mat-list-cell mat-list-cell-price">{formatRelatedPickPrice(m)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

type Props = {
  tree: MaterialCategory[]
  excludedIds: ReadonlySet<number>
  onPick: (m: Material) => void
  onClose: () => void
}

function findInTree(nodes: MaterialCategory[], id: number): MaterialCategory | null {
  for (const n of nodes) {
    if (n.id === id) return n
    const r = findInTree(n.children ?? [], id)
    if (r) return r
  }
  return null
}

function pathToRoot(tree: MaterialCategory[], id: number): MaterialCategory[] {
  const out: MaterialCategory[] = []
  const walk = (nodes: MaterialCategory[], chain: MaterialCategory[]): boolean => {
    for (const n of nodes) {
      const next = [...chain, n]
      if (n.id === id) {
        out.push(...next)
        return true
      }
      if (walk(n.children ?? [], next)) return true
    }
    return false
  }
  walk(tree, [])
  return out
}

function FolderTreeRow({
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
  onSelect: (id: number) => void
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
            <FolderTreeRow
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

export function MaterialRelatedPickModal({ tree, excludedIds, onPick, onClose }: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set())
  const [materials, setMaterials] = useState<Material[]>([])
  const [loadingMaterials, setLoadingMaterials] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const [searchHit, setSearchHit] = useState<Material[]>([])
  const [searching, setSearching] = useState(false)

  const searchActive = searchQ.trim().length > 0

  const selectedFolder = useMemo(
    () => (selectedId == null ? null : findInTree(tree, selectedId)),
    [tree, selectedId],
  )

  const breadcrumb = useMemo<MaterialCategory[]>(
    () => (selectedId == null ? [] : pathToRoot(tree, selectedId)),
    [tree, selectedId],
  )

  useEffect(() => {
    if (searchActive) return
    let cancelled = false
    setLoadingMaterials(true)
    const p =
      selectedId == null
        ? fetchMaterialsFiltered({})
        : fetchMaterials(selectedId, { subtree: true })
    p.then((r) => {
      if (!cancelled) setMaterials(r.results.filter((m) => !excludedIds.has(m.id)))
    })
      .catch(() => {
        if (!cancelled) setMaterials([])
      })
      .finally(() => {
        if (!cancelled) setLoadingMaterials(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedId, excludedIds, searchActive])

  const doSearch = useCallback(
    (q: string) => {
      if (!q.trim()) {
        setSearchHit([])
        return
      }
      setSearching(true)
      searchMaterials(q)
        .then((r) => {
          setSearchHit(r.results.filter((m) => !excludedIds.has(m.id)))
        })
        .catch(() => setSearchHit([]))
        .finally(() => setSearching(false))
    },
    [excludedIds],
  )

  useEffect(() => {
    if (!searchActive) {
      setSearchHit([])
      return
    }
    const t = window.setTimeout(() => doSearch(searchQ), 250)
    return () => clearTimeout(t)
  }, [searchQ, searchActive, doSearch])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const onToggle = useCallback((id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const onSelectFolder = useCallback((id: number | null) => {
    setSelectedId(id)
  }, [])

  const pick = (m: Material) => {
    if (excludedIds.has(m.id)) return
    onPick(m)
  }

  const targetLabel = selectedFolder ? selectedFolder.path || selectedFolder.name : ROOT_LABEL

  return createPortal(
    <div
      className="admin-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="material-related-pick-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="admin-modal admin-modal--explorer" role="document" onClick={(e) => e.stopPropagation()}>
        <h4 id="material-related-pick-title" className="admin-modal-title">
          Сопутствующий материал
        </h4>

        <label className="material-related-pick-search field">
          <span className="admin-muted">Поиск по названию, артикулу, ФНП…</span>
          <input
            autoFocus
            className="admin-input"
            value={searchQ}
            placeholder="Введите запрос или выберите папку слева"
            aria-label="Поиск материала"
            onChange={(e) => setSearchQ(e.target.value)}
          />
        </label>

        {!searchActive ? (
          <>
            <div className="folder-explorer-breadcrumb" aria-label="Путь к выбранной папке">
              <button
                type="button"
                className={
                  selectedId == null
                    ? 'folder-explorer-crumb folder-explorer-crumb--active'
                    : 'folder-explorer-crumb'
                }
                onClick={() => onSelectFolder(null)}
              >
                <span className="folder-explorer-icon" aria-hidden>
                  🗂️
                </span>
                {ROOT_LABEL}
              </button>
              {breadcrumb.map((c) => (
                <span key={c.id} className="folder-explorer-crumb-row">
                  <span className="folder-explorer-crumb-sep" aria-hidden>
                    ›
                  </span>
                  <button
                    type="button"
                    className={
                      selectedId === c.id
                        ? 'folder-explorer-crumb folder-explorer-crumb--active'
                        : 'folder-explorer-crumb'
                    }
                    onClick={() => onSelectFolder(c.id)}
                  >
                    {c.name}
                  </button>
                </span>
              ))}
            </div>

            <div className="folder-explorer">
              <aside className="folder-explorer-tree" aria-label="Дерево папок">
                <button
                  type="button"
                  className={
                    selectedId == null ? 'folder-explorer-root folder-explorer-root--active' : 'folder-explorer-root'
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
                    <FolderTreeRow
                      key={c.id}
                      c={c}
                      depth={0}
                      selectedId={selectedId}
                      expandedIds={expandedIds}
                      onToggle={onToggle}
                      onSelect={onSelectFolder}
                    />
                  ))}
                </ul>
              </aside>

              <section className="folder-explorer-content" aria-label="Материалы в выбранной области">
                <p className="folder-explorer-target admin-muted" style={{ margin: '0 0 0.35rem' }}>
                  Показано: <strong>{targetLabel}</strong>
                </p>
                <RelatedPickMatListTable
                  items={materials}
                  loading={loadingMaterials}
                  emptyText="Нет материалов в этой области. Выберите другую папку слева или воспользуйтесь поиском."
                  onPickRow={pick}
                />
              </section>
            </div>
          </>
        ) : (
          <section className="folder-explorer-content material-related-pick-search-pane" aria-label="Результаты поиска">
            {searching ? <p className="admin-muted">Поиск…</p> : null}
            {!searching ? (
              <RelatedPickMatListTable
                items={searchHit}
                loading={false}
                emptyText="Ничего не найдено. Измените запрос или закройте поиск."
                onPickRow={pick}
              />
            ) : null}
          </section>
        )}

        <div className="admin-modal-actions">
          <button type="button" className="admin-secondary" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
