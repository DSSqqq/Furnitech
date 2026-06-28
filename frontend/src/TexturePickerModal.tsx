import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { API_ORIGIN, apiUrl } from './apiBase'
import { fetchTextureCategoryTree, fetchTextureItemsPage } from './api'
import type { TextureCategory, TextureItem } from './types'
import './AdminApp.css'

const MODAL_CLOSE_X_SVG = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

const DEV_MEDIA_ORIGIN = 'http://127.0.0.1:8000'

export function resolveTextureImageUrl(pathOrUrl: string | null | undefined): string {
  if (!pathOrUrl) return ''
  if (pathOrUrl.startsWith('http')) return pathOrUrl
  const p = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`
  return API_ORIGIN ? apiUrl(p) : `${DEV_MEDIA_ORIGIN}${p}`
}

type Picked = { id: number; name: string; image: string | null }

const TEX_LIST_COLUMNS = ['Превью', 'Наименование'] as const

function collectIdsWithChildren(tree: TextureCategory[]): Set<number> {
  const out = new Set<number>()
  const walk = (nodes: TextureCategory[]) => {
    for (const n of nodes) {
      const kids = n.children ?? []
      if (kids.length > 0) out.add(n.id)
      if (kids.length > 0) walk(kids)
    }
  }
  walk(tree)
  return out
}

function findPathToId(tree: TextureCategory[], id: number): number[] | null {
  const walk = (nodes: TextureCategory[], path: number[]): number[] | null => {
    for (const n of nodes) {
      const nextPath = [...path, n.id]
      if (n.id === id) return nextPath
      const kids = n.children ?? []
      if (kids.length > 0) {
        const r = walk(kids, nextPath)
        if (r) return r
      }
    }
    return null
  }
  return walk(tree, [])
}

function findCategoryNode(nodes: TextureCategory[], id: number): TextureCategory | null {
  for (const n of nodes) {
    if (n.id === id) return n
    const kids = n.children ?? []
    if (kids.length > 0) {
      const f = findCategoryNode(kids, id)
      if (f) return f
    }
  }
  return null
}

function PickerTextureTreeRow({
  c,
  depth,
  selectedId,
  expandedIds,
  onToggleExpanded,
  onSelect,
}: {
  c: TextureCategory
  depth: number
  selectedId: number | null
  expandedIds: Set<number>
  onToggleExpanded: (id: number) => void
  onSelect: (id: number) => void
}) {
  const isSel = c.id === selectedId
  const hasKids = (c.children?.length ?? 0) > 0
  const isExpanded = hasKids ? expandedIds.has(c.id) : false
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
            aria-label={isExpanded ? 'Свернуть папку' : 'Развернуть папку'}
            aria-expanded={isExpanded}
            onClick={(e) => {
              e.stopPropagation()
              onToggleExpanded(c.id)
            }}
          >
            <span aria-hidden>{isExpanded ? '▾' : '▸'}</span>
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
          onClick={() => onSelect(c.id)}
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
            <PickerTextureTreeRow
              key={ch.id}
              c={ch}
              depth={depth + 1}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onToggleExpanded={onToggleExpanded}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

type Props = {
  onClose: () => void
  onPick: (item: Picked) => void
}

export function TexturePickerModal({ onClose, onPick }: Props) {
  const [tree, setTree] = useState<TextureCategory[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<number | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const [texturesRootTreeExpanded, setTexturesRootTreeExpanded] = useState(true)
  const [items, setItems] = useState<TextureItem[]>([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [itemsHasMore, setItemsHasMore] = useState(false)
  const [itemsPage, setItemsPage] = useState(1)
  const [highlightId, setHighlightId] = useState<number | null>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  useLayoutEffect(() => {
    closeBtnRef.current?.focus()
  }, [])

  const reloadItems = useCallback((categoryId: number | null, page = 1, append = false) => {
    setErr(null)
    setItemsLoading(true)
    const params = categoryId == null ? undefined : { category: categoryId, subtree: true }
    return fetchTextureItemsPage(params, page)
      .then((r) => {
        const rows = r.results ?? []
        setItems((prev) => (append ? [...prev, ...rows] : rows))
        setItemsPage(page)
        setItemsHasMore(Boolean(r.next))
      })
      .catch((e) => setErr(String(e)))
      .finally(() => setItemsLoading(false))
  }, [])

  useEffect(() => {
    fetchTextureCategoryTree()
      .then((t) => {
        setTree(t)
        setExpandedIds((prev) => (prev.size > 0 ? prev : collectIdsWithChildren(t)))
      })
      .catch((e) => setErr(String(e)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    void reloadItems(selected, 1, false)
    setHighlightId(null)
  }, [selected, reloadItems])

  useEffect(() => {
    if (selected == null) return
    const path = findPathToId(tree, selected)
    if (!path || path.length < 2) return
    setExpandedIds((prev) => {
      const next = new Set(prev)
      for (const id of path.slice(0, -1)) next.add(id)
      return next
    })
  }, [selected, tree])

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

  const toggleExpanded = useCallback((id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const loadMoreItems = useCallback(() => {
    if (itemsLoading || !itemsHasMore) return
    void reloadItems(selected, itemsPage + 1, true)
  }, [itemsHasMore, itemsLoading, itemsPage, reloadItems, selected])

  const texturesHeading = useMemo(() => {
    if (selected == null) return 'Текстуры: база текстур'
    const node = findCategoryNode(tree, selected)
    return `Текстуры в папке: ${node?.name?.trim() || '—'}`
  }, [selected, tree])

  const pickedItem = useMemo(
    () => (highlightId == null ? null : items.find((x) => x.id === highlightId) ?? null),
    [highlightId, items],
  )

  const runPick = () => {
    if (!pickedItem) return
    onPick({ id: pickedItem.id, name: pickedItem.name, image: pickedItem.image })
  }

  const pickTexture = (it: TextureItem) => {
    onPick({ id: it.id, name: it.name, image: it.image })
  }

  return createPortal(
    <div
      className="admin-modal-backdrop admin-modal-backdrop--elevated"
      role="dialog"
      aria-modal="true"
      aria-labelledby="texture-picker-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="admin-modal admin-modal--explorer admin-calculations-modal-surface texture-picker-modal"
        role="document"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="admin-modal-head-row">
          <h4 id="texture-picker-title" className="admin-modal-title">
            Выбор текстуры из базы
          </h4>
          <button
            ref={closeBtnRef}
            type="button"
            className="admin-primary admin-modal-head-icon-close"
            aria-label="Закрыть"
            title="Закрыть"
            onClick={onClose}
          >
            {MODAL_CLOSE_X_SVG}
          </button>
        </div>

        {loading ? (
          <p className="admin-muted">Загрузка папок…</p>
        ) : (
          <>
            {err && <div className="admin-error admin-error--compact">{err}</div>}
            <div className="admin-body texture-picker-modal-body" id="texture-picker-modal">
              <aside className="admin-aside" aria-label="Папки текстур">
                <div className="admin-heading-row">
                  <h2 className="admin-h2">Папки текстур</h2>
                </div>
                <ul
                  className="folder-explorer-tree-root admin-materials-tree-root"
                  aria-label="Дерево папок"
                >
                  <li className="folder-explorer-tree-item folder-explorer-tree-item--materials-root">
                    <div
                      className={
                        selected == null
                          ? 'folder-explorer-tree-line folder-explorer-tree-line--active'
                          : 'folder-explorer-tree-line'
                      }
                    >
                      {tree.length > 0 ? (
                        <button
                          type="button"
                          className="folder-explorer-tree-expander"
                          aria-label={
                            texturesRootTreeExpanded
                              ? 'Свернуть список папок'
                              : 'Развернуть список папок'
                          }
                          aria-expanded={texturesRootTreeExpanded}
                          onClick={(e) => {
                            e.stopPropagation()
                            setTexturesRootTreeExpanded((v) => !v)
                          }}
                        >
                          <span aria-hidden>{texturesRootTreeExpanded ? '▾' : '▸'}</span>
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
                        onClick={() => setSelected(null)}
                        title="База текстур — все текстуры базы"
                      >
                        <span className="folder-explorer-icon" aria-hidden>
                          🗂️
                        </span>
                        <span className="folder-explorer-tree-name">База текстур</span>
                      </button>
                    </div>
                    {texturesRootTreeExpanded && tree.length > 0 ? (
                      <ul className="folder-explorer-tree-children">
                        {tree.map((c) => (
                          <PickerTextureTreeRow
                            key={c.id}
                            c={c}
                            depth={0}
                            selectedId={selected}
                            expandedIds={expandedIds}
                            onToggleExpanded={toggleExpanded}
                            onSelect={setSelected}
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
                      <h2 className="admin-h2">{texturesHeading}</h2>
                    </div>
                    <div
                      className="mat-list-table mat-list-table--textures"
                      aria-label={
                        selected == null
                          ? 'Список всех текстур'
                          : 'Список текстур в выбранной папке и вложенных'
                      }
                    >
                      <div className="mat-list-item-inner mat-list-item-inner--legend" role="row">
                        <div className="mat-list-legend" role="presentation">
                          {TEX_LIST_COLUMNS.map((label) => (
                            <span key={label} role="columnheader">
                              {label}
                            </span>
                          ))}
                        </div>
                      </div>
                      <ul className="mat-list">
                        {items.map((it) => {
                          const url = resolveTextureImageUrl(it.image)
                          const rowActive = highlightId === it.id
                          return (
                            <li key={it.id} className="mat-list-item">
                              <div className="mat-list-item-inner">
                                <div
                                  role="button"
                                  tabIndex={0}
                                  className={
                                    rowActive
                                      ? 'mat-list-row mat-list-row--texture mat-list-row--active'
                                      : 'mat-list-row mat-list-row--texture'
                                  }
                                  aria-current={rowActive ? 'true' : undefined}
                                  aria-label={`Текстура: ${it.name || 'текстура'}. Щелчок — выбрать для подтверждения, двойной щелчок — сразу применить.`}
                                  onClick={() => setHighlightId(it.id)}
                                  onDoubleClick={() => pickTexture(it)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault()
                                      if (rowActive) pickTexture(it)
                                      else setHighlightId(it.id)
                                    }
                                  }}
                                >
                                  <span className="mat-list-cell mat-list-cell-tex-prev">
                                    {url ? (
                                      <span
                                        className="mat-list-tex-thumb"
                                        style={{ backgroundImage: `url(${url})` }}
                                      />
                                    ) : (
                                      <span className="mat-list-tex-thumb mat-list-tex-thumb--empty">
                                        —
                                      </span>
                                    )}
                                  </span>
                                  <span className="mat-list-cell mat-list-cell-name">{it.name}</span>
                                </div>
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                    {itemsLoading ? <p className="admin-muted">Загрузка списка…</p> : null}
                    {!itemsLoading && items.length === 0 ? (
                      <p className="admin-muted admin-calculations-classes-empty">
                        {selected == null
                          ? 'Нет текстур в справочнике.'
                          : 'В этой папке (и вложенных) пока нет текстур.'}
                      </p>
                    ) : null}
                    {itemsHasMore ? (
                      <button
                        type="button"
                        className="admin-secondary"
                        disabled={itemsLoading}
                        onClick={loadMoreItems}
                      >
                        {itemsLoading ? 'Загрузка…' : 'Загрузить ещё'}
                      </button>
                    ) : null}
                  </div>
                </main>
              </div>
            </div>
            <div className="admin-row mat-form-actions">
              <button type="button" className="admin-secondary" onClick={onClose}>
                Отмена
              </button>
              <button
                type="button"
                className="admin-primary"
                disabled={highlightId == null}
                onClick={runPick}
              >
                Выбрать
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
