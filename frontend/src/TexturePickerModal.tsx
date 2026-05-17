import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { API_ORIGIN, apiUrl } from './apiBase'
import { fetchTextureCategoryTree, fetchTextureItems } from './api'
import type { TextureCategory, TextureItem } from './types'

const DEV_MEDIA_ORIGIN = 'http://127.0.0.1:8000'

export function resolveTextureImageUrl(pathOrUrl: string | null | undefined): string {
  if (!pathOrUrl) return ''
  if (pathOrUrl.startsWith('http')) return pathOrUrl
  const p = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`
  return API_ORIGIN ? apiUrl(p) : `${DEV_MEDIA_ORIGIN}${p}`
}

type Picked = { id: number; name: string; image: string | null }

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

function TreeRow({
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
    <li className="tree-item">
      <div className="tree-line" style={{ paddingLeft: 8 + depth * 12 }}>
        {hasKids ? (
          <button
            type="button"
            className="tree-expander"
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
          <span className="tree-expander tree-expander--spacer" aria-hidden />
        )}
        <button
          type="button"
          className={isSel ? 'tree-link tree-link-active' : 'tree-link'}
          onClick={() => onSelect(c.id)}
          title={c.path}
        >
          {c.name}
        </button>
      </div>
      {hasKids && isExpanded && (
        <ul className="tree-children">
          {(c.children ?? []).map((ch) => (
            <TreeRow
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
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const [items, setItems] = useState<TextureItem[]>([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [highlightId, setHighlightId] = useState<number | null>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  useLayoutEffect(() => {
    closeBtnRef.current?.focus()
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
    if (selectedFolderId == null) {
      setItems([])
      return
    }
    setItemsLoading(true)
    fetchTextureItems({ category: selectedFolderId })
      .then((r) => setItems(r.results))
      .catch((e) => setErr(String(e)))
      .finally(() => setItemsLoading(false))
  }, [selectedFolderId])

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

  useEffect(() => {
    if (selectedFolderId == null) return
    const path = findPathToId(tree, selectedFolderId)
    if (!path || path.length < 2) return
    setExpandedIds((prev) => {
      const next = new Set(prev)
      for (const id of path.slice(0, -1)) next.add(id)
      return next
    })
  }, [selectedFolderId, tree])

  const canPick = highlightId != null
  const pickedItem = useMemo(
    () => (highlightId == null ? null : items.find((x) => x.id === highlightId) ?? null),
    [highlightId, items]
  )

  const runPick = () => {
    if (!pickedItem) return
    onPick({ id: pickedItem.id, name: pickedItem.name, image: pickedItem.image })
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
      <div className="admin-modal admin-modal--explorer" role="document" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-head-row">
          <h4 id="texture-picker-title" className="admin-modal-title">
            Выбор текстуры из базы
          </h4>
          <button ref={closeBtnRef} type="button" className="admin-secondary" onClick={onClose}>
            Закрыть
          </button>
        </div>
        {err && <div className="admin-error admin-error--compact">{err}</div>}
        {loading ? (
          <p className="admin-muted">Загрузка папок…</p>
        ) : (
          <div className="texture-picker-split">
            <aside className="texture-picker-aside" aria-label="Папки текстур">
              <h5 className="texture-picker-subh">Папки</h5>
              <ul className="tree-root">
                {tree.map((c) => (
                  <TreeRow
                    key={c.id}
                    c={c}
                    depth={0}
                    selectedId={selectedFolderId}
                    expandedIds={expandedIds}
                    onToggleExpanded={toggleExpanded}
                    onSelect={setSelectedFolderId}
                  />
                ))}
              </ul>
            </aside>
            <section className="texture-picker-main" aria-label="Текстуры в папке">
              <h5 className="texture-picker-subh">Текстуры</h5>
              {selectedFolderId == null ? (
                <p className="admin-muted">Выберите папку слева.</p>
              ) : itemsLoading ? (
                <p className="admin-muted">Загрузка…</p>
              ) : items.length === 0 ? (
                <p className="admin-muted">В папке нет текстур.</p>
              ) : (
                <ul className="texture-picker-grid">
                  {items.map((it) => {
                    const url = resolveTextureImageUrl(it.image)
                    const active = highlightId === it.id
                    return (
                      <li key={it.id}>
                        <button
                          type="button"
                          className={
                            active ? 'texture-picker-tile texture-picker-tile--active' : 'texture-picker-tile'
                          }
                          onClick={() => setHighlightId(it.id)}
                          onDoubleClick={() => onPick({ id: it.id, name: it.name, image: it.image })}
                        >
                          {url ? (
                            <span className="texture-picker-thumb" style={{ backgroundImage: `url(${url})` }} />
                          ) : (
                            <span className="texture-picker-thumb texture-picker-thumb--empty">Нет файла</span>
                          )}
                          <span className="texture-picker-tile-name">{it.name}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
              <div className="texture-picker-actions">
                <button type="button" className="admin-primary" disabled={!canPick} onClick={runPick}>
                  Выбрать
                </button>
                <button type="button" className="admin-secondary" onClick={onClose}>
                  Отмена
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
