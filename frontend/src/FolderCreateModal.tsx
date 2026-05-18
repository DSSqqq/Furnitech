import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { fetchMaterials } from './api'
import type { Material, MaterialCategory, TextureCategory } from './types'

const MODAL_CLOSE_X_SVG = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

type Props = {
  tree: MaterialCategory[] | TextureCategory[]
  initialParentId: number | null
  onClose: () => void
  onCreate: (parentId: number | null, name: string) => Promise<void>
}

const ROOT_LABEL = 'Все папки'

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
          <span className="folder-explorer-icon" aria-hidden>📁</span>
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

export function FolderCreateModal({ tree, initialParentId, onClose, onCreate }: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(initialParentId)
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => {
    if (initialParentId == null) return new Set()
    const ids = new Set<number>()
    for (const n of pathToRoot(tree, initialParentId)) ids.add(n.id)
    return ids
  })
  const [materialsByFolder, setMaterialsByFolder] = useState<Record<number, Material[]>>({})
  const [loadingFolderIds, setLoadingFolderIds] = useState<Set<number>>(new Set())
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [localErr, setLocalErr] = useState<string | null>(null)

  const selectedFolder = useMemo(
    () => (selectedId == null ? null : findInTree(tree, selectedId)),
    [tree, selectedId]
  )

  const breadcrumb = useMemo<MaterialCategory[]>(
    () => (selectedId == null ? [] : pathToRoot(tree, selectedId)),
    [tree, selectedId]
  )

  const childFolders: MaterialCategory[] = selectedFolder
    ? selectedFolder.children ?? []
    : tree

  useEffect(() => {
    if (selectedId == null) return
    if (materialsByFolder[selectedId] || loadingFolderIds.has(selectedId)) return
    setLoadingFolderIds((prev) => {
      const next = new Set(prev)
      next.add(selectedId)
      return next
    })
    fetchMaterials(selectedId)
      .then((r) => {
        setMaterialsByFolder((prev) => ({ ...prev, [selectedId]: r.results }))
      })
      .catch(() => {
        setMaterialsByFolder((prev) => ({ ...prev, [selectedId]: [] }))
      })
      .finally(() => {
        setLoadingFolderIds((prev) => {
          const next = new Set(prev)
          next.delete(selectedId)
          return next
        })
      })
  }, [selectedId, materialsByFolder, loadingFolderIds])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, submitting])

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
    setLocalErr(null)
  }, [])

  const onOpenFolder = useCallback(
    (id: number) => {
      onSelectFolder(id)
      setExpandedIds((prev) => {
        if (prev.has(id)) return prev
        const next = new Set(prev)
        next.add(id)
        return next
      })
    },
    [onSelectFolder]
  )

  const submit = useCallback(() => {
    const trimmed = name.trim()
    if (!trimmed) {
      setLocalErr('Укажите имя папки.')
      return
    }
    setSubmitting(true)
    setLocalErr(null)
    onCreate(selectedId, trimmed)
      .then(() => {
        setSubmitting(false)
        onClose()
      })
      .catch((e) => {
        setLocalErr(e instanceof Error ? e.message : String(e))
        setSubmitting(false)
      })
  }, [name, onCreate, onClose, selectedId])

  const materials = selectedId == null ? [] : materialsByFolder[selectedId] ?? []
  const isFolderLoading = selectedId != null && loadingFolderIds.has(selectedId)
  const targetLabel = selectedFolder ? selectedFolder.path || selectedFolder.name : ROOT_LABEL

  return createPortal(
    <div
      className="admin-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose()
      }}
    >
      <section
        className="admin-panel admin-panel--in-material-modal admin-calculations-modal-surface admin-modal--material-card admin-material-card-dialog folder-create-material-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="folder-create-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mat-form">
          <div className="mat-form-head">
            <div className="admin-heading-row mat-form-title-line">
              <h3 id="folder-create-title" className="admin-h2">
                Создать папку
              </h3>
            </div>
            <button
              type="button"
              className="admin-primary admin-modal-head-icon-close"
              aria-label="Закрыть"
              title="Закрыть"
              disabled={submitting}
              onClick={onClose}
            >
              {MODAL_CLOSE_X_SVG}
            </button>
          </div>

          {localErr ? <div className="admin-error">{localErr}</div> : null}

          <div
            className="mat-form-tab-panel folder-create-explorer-panel"
            role="region"
            aria-label="Выбор родительской папки и имя"
          >
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
                <span className="folder-explorer-icon" aria-hidden>🗂️</span>
                {ROOT_LABEL}
              </button>
              {breadcrumb.map((c) => (
                <span key={c.id} className="folder-explorer-crumb-row">
                  <span className="folder-explorer-crumb-sep" aria-hidden>›</span>
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
                    selectedId == null
                      ? 'folder-explorer-root folder-explorer-root--active'
                      : 'folder-explorer-root'
                  }
                  onClick={() => onSelectFolder(null)}
                >
                  <span className="folder-explorer-icon" aria-hidden>🗂️</span>
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

              <section className="folder-explorer-content" aria-label="Содержимое выбранной папки">
                {childFolders.length === 0 && materials.length === 0 && !isFolderLoading ? (
                  <p className="folder-explorer-empty">
                    {selectedId == null
                      ? 'Корень пуст. Введите имя ниже и нажмите «Создать», чтобы добавить первую папку.'
                      : 'В этой папке пока нет вложенных папок и материалов.'}
                  </p>
                ) : (
                  <ul className="folder-explorer-grid">
                    {childFolders.map((f) => (
                      <li key={`f-${f.id}`}>
                        <button
                          type="button"
                          className="folder-explorer-tile folder-explorer-tile--folder"
                          onClick={() => onSelectFolder(f.id)}
                          onDoubleClick={() => onOpenFolder(f.id)}
                          title={f.path}
                        >
                          <span className="folder-explorer-tile-icon" aria-hidden>📁</span>
                          <span className="folder-explorer-tile-name">{f.name}</span>
                        </button>
                      </li>
                    ))}
                    {selectedId != null && isFolderLoading ? (
                      <li className="folder-explorer-tile folder-explorer-tile--info">Загрузка материалов…</li>
                    ) : null}
                    {materials.map((m) => (
                      <li key={`m-${m.id}`}>
                        <div
                          className="folder-explorer-tile folder-explorer-tile--material"
                          title={m.name}
                        >
                          <span className="folder-explorer-tile-icon" aria-hidden>📄</span>
                          <span className="folder-explorer-tile-name">{m.name}</span>
                          {m.article ? (
                            <span className="folder-explorer-tile-sub">{m.article}</span>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <div className="folder-explorer-form">
              <label className="field folder-explorer-name-field">
                <span>Имя новой папки</span>
                <input
                  autoFocus
                  className="admin-input"
                  value={name}
                  placeholder="Например, «Профили»"
                  onChange={(e) => {
                    setName(e.target.value)
                    setLocalErr(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !submitting) {
                      e.preventDefault()
                      submit()
                    }
                  }}
                />
              </label>
              <p className="folder-explorer-target">
                Будет создана в: <strong>{targetLabel}</strong>
              </p>
            </div>

            <div className="admin-row mat-form-actions">
              <button type="button" className="admin-secondary" disabled={submitting} onClick={onClose}>
                Отмена
              </button>
              <button
                type="button"
                className="admin-primary admin-modal-confirm"
                disabled={submitting || !name.trim()}
                onClick={submit}
              >
                {submitting ? 'Создание…' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>,
    document.body
  )
}
