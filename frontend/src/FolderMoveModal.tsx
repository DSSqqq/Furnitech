import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { createPortal } from 'react-dom'
import { fetchMaterials } from './api'
import type { MaterialCategory, TextureCategory } from './types'

const ROOT_LABEL = 'Все папки (корень)'
const DND_TYPE = 'application/x-furnitech-folder-move'

type FolderItemRow = { id: number; name: string; article?: string }

function isOurDrag(e: DragEvent) {
  const types = e.dataTransfer.types
  return types.includes(DND_TYPE) || types.includes('text/plain')
}

type Props = {
  tree: MaterialCategory[] | TextureCategory[]
  folderToMove: MaterialCategory | TextureCategory
  onClose: () => void
  /** movingId — явно, чтобы родитель не зависел от стейта при закрытии модалки во время запроса */
  onMove: (newParentId: number | null, movingId: number) => Promise<void>
  /** Если задано — справа подгружаются эти элементы вместо материалов (например текстуры). */
  fetchItemsInFolder?: (categoryId: number) => Promise<{ results: FolderItemRow[] }>
  /** Подпись при загрузке списка справа (по умолчанию про материалы). */
  itemsLoadingLabel?: string
  /** Фраза «нет вложенных папок и …» */
  itemsEmptySuffix?: string
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

function collectSubtreeIds(node: MaterialCategory): Set<number> {
  const ids = new Set<number>()
  const walk = (n: MaterialCategory) => {
    ids.add(n.id)
    for (const ch of n.children ?? []) walk(ch)
  }
  walk(node)
  return ids
}

function MoveTreeRow({
  c,
  depth,
  selectedId,
  expandedIds,
  onToggle,
  onSelect,
  forbiddenIds,
  dragging,
  movingId,
  submitting,
  onDragStartMove,
  onDragEndMove,
  onDropOn,
}: {
  c: MaterialCategory
  depth: number
  selectedId: number | null
  expandedIds: Set<number>
  onToggle: (id: number) => void
  onSelect: (id: number | null) => void
  forbiddenIds: Set<number>
  dragging: boolean
  movingId: number
  submitting: boolean
  onDragStartMove: (e: DragEvent) => void
  onDragEndMove: () => void
  onDropOn: (targetParentId: number | null) => void
}) {
  const hasKids = (c.children?.length ?? 0) > 0
  const isExpanded = hasKids ? expandedIds.has(c.id) : false
  const isSel = selectedId === c.id
  const canDrop = !forbiddenIds.has(c.id)
  const isMovingSource = c.id === movingId

  const onDragOverRow = (e: DragEvent) => {
    if (!isOurDrag(e) || !canDrop) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
  }

  const onDropRow = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isOurDrag(e) || !canDrop) return
    onDropOn(c.id)
  }

  const lineClass =
    (isSel ? 'folder-explorer-tree-line folder-explorer-tree-line--active' : 'folder-explorer-tree-line') +
    (dragging && !canDrop ? ' folder-explorer-tree-line--move-blocked' : '') +
    (isMovingSource ? ' folder-explorer-tree-line--drag-source' : '')

  return (
    <li className="folder-explorer-tree-item">
      <div
        className={lineClass}
        style={{ paddingLeft: 6 + depth * 14 }}
        draggable={isMovingSource && !submitting}
        onDragStart={isMovingSource ? onDragStartMove : undefined}
        onDragEnd={isMovingSource ? onDragEndMove : undefined}
        onDragOver={canDrop ? onDragOverRow : undefined}
        onDrop={canDrop ? onDropRow : undefined}
        title={isMovingSource ? 'Удерживайте и перетащите на другую папку или на «Все папки (корень)»' : c.path}
      >
        {hasKids ? (
          <button
            type="button"
            className="folder-explorer-tree-expander"
            draggable={false}
            aria-label={isExpanded ? 'Свернуть' : 'Развернуть'}
            aria-expanded={isExpanded}
            onClick={(ev) => {
              ev.stopPropagation()
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
            <MoveTreeRow
              key={ch.id}
              c={ch}
              depth={depth + 1}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onSelect={onSelect}
              forbiddenIds={forbiddenIds}
              dragging={dragging}
              movingId={movingId}
              submitting={submitting}
              onDragStartMove={onDragStartMove}
              onDragEndMove={onDragEndMove}
              onDropOn={onDropOn}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

export function FolderMoveModal({
  tree,
  folderToMove,
  onClose,
  onMove,
  fetchItemsInFolder,
  itemsLoadingLabel = 'Загрузка материалов…',
  itemsEmptySuffix = 'материалов',
}: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => {
    const ids = new Set<number>()
    for (const n of pathToRoot(tree, folderToMove.id)) ids.add(n.id)
    return ids
  })
  const [materialsByFolder, setMaterialsByFolder] = useState<Record<number, FolderItemRow[]>>({})
  const [loadingFolderIds, setLoadingFolderIds] = useState<Set<number>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [localErr, setLocalErr] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const moveInflight = useRef(false)

  const forbiddenIds = useMemo(() => collectSubtreeIds(folderToMove), [folderToMove])

  const selectedFolder = useMemo(
    () => (selectedId == null ? null : findInTree(tree, selectedId)),
    [tree, selectedId]
  )

  const breadcrumb = useMemo<MaterialCategory[]>(
    () => (selectedId == null ? [] : pathToRoot(tree, selectedId)),
    [tree, selectedId]
  )

  const childFolders: MaterialCategory[] = selectedFolder ? selectedFolder.children ?? [] : tree

  const currentParentId = folderToMove.parent

  const isAllowedTarget = useCallback(
    (targetParentId: number | null) => {
      if (targetParentId !== null && forbiddenIds.has(targetParentId)) return false
      if (targetParentId === currentParentId) return false
      return true
    },
    [forbiddenIds, currentParentId]
  )

  useEffect(() => {
    if (selectedId == null) return
    if (materialsByFolder[selectedId] || loadingFolderIds.has(selectedId)) return
    setLoadingFolderIds((prev) => {
      const next = new Set(prev)
      next.add(selectedId)
      return next
    })
    ;(fetchItemsInFolder
      ? fetchItemsInFolder(selectedId)
      : fetchMaterials(selectedId).then((r) => ({
          results: r.results.map((m) => ({ id: m.id, name: m.name, article: m.article })),
        }))
    )
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
      if (e.key === 'Escape' && !submitting && !dragging) {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, submitting, dragging])

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

  const runMove = useCallback(
    (newParentId: number | null) => {
      if (moveInflight.current) return
      if (!isAllowedTarget(newParentId)) {
        if (newParentId === currentParentId) {
          setLocalErr('Папка уже находится в этом расположении.')
        } else {
          setLocalErr('Сюда перенести нельзя (сама папка или её вложенность).')
        }
        return
      }
      moveInflight.current = true
      setSubmitting(true)
      setLocalErr(null)
      onMove(newParentId, folderToMove.id)
        .then(() => {
          moveInflight.current = false
          setSubmitting(false)
          onClose()
        })
        .catch((e) => {
          moveInflight.current = false
          setLocalErr(e instanceof Error ? e.message : String(e))
          setSubmitting(false)
        })
    },
    [isAllowedTarget, currentParentId, onMove, onClose, folderToMove.id]
  )

  const onDragStartSource = (e: DragEvent) => {
    e.dataTransfer.setData(DND_TYPE, String(folderToMove.id))
    e.dataTransfer.setData('text/plain', String(folderToMove.id))
    e.dataTransfer.effectAllowed = 'move'
    setDragging(true)
  }

  const onDragEndSource = () => {
    setDragging(false)
  }

  const onDropOn = useCallback(
    (targetId: number | null) => {
      runMove(targetId)
      setDragging(false)
    },
    [runMove]
  )

  const rootDragOver = (e: DragEvent) => {
    if (!isOurDrag(e) || !isAllowedTarget(null)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const rootDrop = (e: DragEvent) => {
    e.preventDefault()
    if (!isOurDrag(e)) return
    onDropOn(null)
  }

  const folderItems = selectedId == null ? [] : materialsByFolder[selectedId] ?? []
  const isFolderLoading = selectedId != null && loadingFolderIds.has(selectedId)
  const canCommitSelection = isAllowedTarget(selectedId)

  return createPortal(
    <div
      className="admin-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="folder-move-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting && !dragging) onClose()
      }}
    >
      <div className="admin-modal admin-modal--explorer" role="document" onClick={(e) => e.stopPropagation()}>
        <h4 id="folder-move-title" className="admin-modal-title">
          Переместить папку «{folderToMove.name}»
        </h4>

        <p className="folder-move-hint">
          В левом дереве найдите эту папку (подсвечена) и перетащите её строку на папку назначения или на «Все папки
          (корень)». Справа можно бросить на плитку папки.
        </p>

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
                  selectedId === c.id ? 'folder-explorer-crumb folder-explorer-crumb--active' : 'folder-explorer-crumb'
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
              draggable={false}
              onClick={() => onSelectFolder(null)}
              onDragOver={rootDragOver}
              onDrop={rootDrop}
            >
              <span className="folder-explorer-icon" aria-hidden>
                🗂️
              </span>
              {ROOT_LABEL}
            </button>
            <ul className="folder-explorer-tree-root">
              {tree.map((c) => (
                <MoveTreeRow
                  key={c.id}
                  c={c}
                  depth={0}
                  selectedId={selectedId}
                  expandedIds={expandedIds}
                  onToggle={onToggle}
                  onSelect={onSelectFolder}
                  forbiddenIds={forbiddenIds}
                  dragging={dragging}
                  movingId={folderToMove.id}
                  submitting={submitting}
                  onDragStartMove={onDragStartSource}
                  onDragEndMove={onDragEndSource}
                  onDropOn={onDropOn}
                />
              ))}
            </ul>
          </aside>

          <section className="folder-explorer-content" aria-label="Содержимое выбранной папки">
            {childFolders.length === 0 && folderItems.length === 0 && !isFolderLoading ? (
              <p className="folder-explorer-empty">
                {selectedId == null
                  ? 'В корне нет вложенных элементов — перетащите сюда строку папки из дерева слева или выберите папку в дереве.'
                  : `В этой папке пока нет вложенных папок и ${itemsEmptySuffix}.`}
              </p>
            ) : (
              <ul className="folder-explorer-grid">
                {childFolders.map((f) => {
                  const dropOk = !forbiddenIds.has(f.id)
                  const onTileDragOver = (e: DragEvent) => {
                    if (!isOurDrag(e) || !dropOk) return
                    e.preventDefault()
                    e.stopPropagation()
                    e.dataTransfer.dropEffect = 'move'
                  }
                  const onTileDrop = (e: DragEvent) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (!isOurDrag(e) || !dropOk) return
                    onDropOn(f.id)
                  }
                  return (
                    <li key={`f-${f.id}`}>
                      <button
                        type="button"
                        className="folder-explorer-tile folder-explorer-tile--folder"
                        draggable={false}
                        onClick={() => onSelectFolder(f.id)}
                        onDoubleClick={() => onOpenFolder(f.id)}
                        title={f.path}
                        onDragOver={onTileDragOver}
                        onDrop={onTileDrop}
                      >
                        <span className="folder-explorer-tile-icon" aria-hidden>
                          📁
                        </span>
                        <span className="folder-explorer-tile-name">{f.name}</span>
                      </button>
                    </li>
                  )
                })}
                {selectedId != null && isFolderLoading ? (
                  <li className="folder-explorer-tile folder-explorer-tile--info">{itemsLoadingLabel}</li>
                ) : null}
                {folderItems.map((m) => (
                  <li key={`m-${m.id}`}>
                    <div className="folder-explorer-tile folder-explorer-tile--material" title={m.name}>
                      <span className="folder-explorer-tile-icon" aria-hidden>
                        📄
                      </span>
                      <span className="folder-explorer-tile-name">{m.name}</span>
                      {m.article ? <span className="folder-explorer-tile-sub">{m.article}</span> : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {localErr ? <div className="admin-error admin-error--compact">{localErr}</div> : null}

        <div className="admin-modal-actions">
          <button type="button" className="admin-secondary" disabled={submitting} onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className="admin-primary admin-modal-confirm"
            disabled={submitting || !canCommitSelection}
            onClick={() => runMove(selectedId)}
          >
            {submitting ? 'Перенос…' : 'Переместить сюда'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
