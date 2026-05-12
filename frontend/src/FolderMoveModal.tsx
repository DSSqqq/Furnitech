import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { createPortal } from 'react-dom'
import { fetchMaterials } from './api'
import { DND_FOLDER, DND_MATERIAL, isFolderDrag, isMaterialDrag } from './folderMoveDnD'
import type { MaterialCategory, TextureCategory } from './types'

const ROOT_LABEL = 'Все папки'

type FolderItemRow = { id: number; name: string; article?: string }

type Props = {
  tree: MaterialCategory[] | TextureCategory[]
  folderToMove: MaterialCategory | TextureCategory
  onClose: () => void
  /** movingId — явно, чтобы родитель не зависел от стейта при закрытии модалки во время запроса */
  onMove: (newParentId: number | null, movingId: number) => Promise<void>
  /** Перенос материала в другую папку (плитка 📄 → папка в дереве или справа). Только для дерева материалов. */
  onMoveMaterial?: (materialId: number, newCategoryId: number) => Promise<void>
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
  forbiddenIdsForDrag,
  draggingFolder,
  draggingFolderId,
  submitting,
  onFolderDragStart,
  onFolderDragEnd,
  onFolderDropOnFolder,
  onDropMaterial,
}: {
  c: MaterialCategory
  depth: number
  selectedId: number | null
  expandedIds: Set<number>
  onToggle: (id: number) => void
  onSelect: (id: number | null) => void
  forbiddenIdsForDrag: Set<number>
  draggingFolder: boolean
  draggingFolderId: number | null
  submitting: boolean
  onFolderDragStart: (e: DragEvent, folderId: number) => void
  onFolderDragEnd: () => void
  onFolderDropOnFolder: (e: DragEvent, targetFolderId: number) => void
  onDropMaterial?: (materialId: number, targetFolderId: number) => void
}) {
  const hasKids = (c.children?.length ?? 0) > 0
  const isExpanded = hasKids ? expandedIds.has(c.id) : false
  const isSel = selectedId === c.id
  const canDropFolderHere = !forbiddenIdsForDrag.has(c.id)
  const isDragSource = c.id === draggingFolderId

  const onDragOverRow = (e: DragEvent) => {
    if (onDropMaterial && isMaterialDrag(e)) {
      e.preventDefault()
      e.stopPropagation()
      e.dataTransfer.dropEffect = 'move'
      return
    }
    if (!isFolderDrag(e) || !canDropFolderHere) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
  }

  const onDropRow = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (onDropMaterial && isMaterialDrag(e)) {
      const raw = e.dataTransfer.getData(DND_MATERIAL)
      const mid = parseInt(raw, 10)
      if (Number.isFinite(mid)) onDropMaterial(mid, c.id)
      return
    }
    if (!isFolderDrag(e) || !canDropFolderHere) return
    onFolderDropOnFolder(e, c.id)
  }

  const lineClass =
    (isSel ? 'folder-explorer-tree-line folder-explorer-tree-line--active' : 'folder-explorer-tree-line') +
    (draggingFolder && !canDropFolderHere ? ' folder-explorer-tree-line--move-blocked' : '') +
    (isDragSource ? ' folder-explorer-tree-line--drag-source' : '')

  return (
    <li className="folder-explorer-tree-item">
      <div
        className={lineClass}
        style={{ paddingLeft: 6 + depth * 14 }}
        draggable={!submitting}
        onDragStart={(e) => onFolderDragStart(e, c.id)}
        onDragEnd={onFolderDragEnd}
        onDragOver={onDragOverRow}
        onDrop={onDropRow}
        title={isDragSource ? 'Удерживайте и перетащите на другую папку или на «Все папки»' : c.path}
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
              forbiddenIdsForDrag={forbiddenIdsForDrag}
              draggingFolder={draggingFolder}
              draggingFolderId={draggingFolderId}
              submitting={submitting}
              onFolderDragStart={onFolderDragStart}
              onFolderDragEnd={onFolderDragEnd}
              onFolderDropOnFolder={onFolderDropOnFolder}
              onDropMaterial={onDropMaterial}
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
  onMoveMaterial,
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
  const [draggingFolder, setDraggingFolder] = useState(false)
  const [draggingFolderId, setDraggingFolderId] = useState<number | null>(null)
  const [draggingMaterial, setDraggingMaterial] = useState(false)
  const moveInflight = useRef(false)
  const folderDragIdRef = useRef<number | null>(null)

  const matTree = tree as MaterialCategory[]

  const forbiddenIdsForDrag = useMemo(() => {
    if (draggingFolderId == null) return new Set<number>()
    const node = findInTree(matTree, draggingFolderId)
    return node ? collectSubtreeIds(node) : new Set<number>()
  }, [draggingFolderId, matTree])

  const selectedFolder = useMemo(
    () => (selectedId == null ? null : findInTree(tree, selectedId)),
    [tree, selectedId]
  )

  const breadcrumb = useMemo<MaterialCategory[]>(
    () => (selectedId == null ? [] : pathToRoot(tree, selectedId)),
    [tree, selectedId]
  )

  const childFolders: MaterialCategory[] = selectedFolder ? selectedFolder.children ?? [] : tree

  const isAllowedTarget = useCallback((targetParentId: number | null, movingId: number) => {
    const node = findInTree(matTree, movingId)
    if (!node) return false
    const forb = collectSubtreeIds(node)
    if (targetParentId !== null && forb.has(targetParentId)) return false
    if (targetParentId === node.parent) return false
    return true
  }, [matTree])

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
      if (e.key === 'Escape' && !submitting && !draggingFolder && !draggingMaterial) {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, submitting, draggingFolder, draggingMaterial])

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

  const executeFolderMove = useCallback(
    (newParentId: number | null, movingId: number) => {
      if (moveInflight.current) return
      if (!isAllowedTarget(newParentId, movingId)) {
        const node = findInTree(matTree, movingId)
        if (node && newParentId === node.parent) {
          setLocalErr('Папка уже находится в этом расположении.')
        } else {
          setLocalErr('Сюда перенести нельзя (сама папка или её вложенность).')
        }
        return
      }
      moveInflight.current = true
      setSubmitting(true)
      setLocalErr(null)
      onMove(newParentId, movingId)
        .then(() => {
          moveInflight.current = false
          setSubmitting(false)
          setMaterialsByFolder({})
        })
        .catch((e) => {
          moveInflight.current = false
          setLocalErr(e instanceof Error ? e.message : String(e))
          setSubmitting(false)
        })
    },
    [isAllowedTarget, matTree, onMove]
  )

  const resetFolderDragState = useCallback(() => {
    folderDragIdRef.current = null
    setDraggingFolderId(null)
    setDraggingFolder(false)
  }, [])

  const onFolderDragStart = (e: DragEvent, id: number) => {
    e.dataTransfer.setData(DND_FOLDER, String(id))
    e.dataTransfer.setData('text/plain', String(id))
    e.dataTransfer.effectAllowed = 'move'
    folderDragIdRef.current = id
    setDraggingFolderId(id)
    setDraggingFolder(true)
  }

  const onFolderDragEnd = resetFolderDragState

  const onFolderDropOnFolder = useCallback(
    (e: DragEvent, targetFolderId: number) => {
      if (!isFolderDrag(e)) return
      const raw = e.dataTransfer.getData(DND_FOLDER)
      const movingId = Number.parseInt(raw, 10)
      if (!Number.isFinite(movingId)) return
      resetFolderDragState()
      executeFolderMove(targetFolderId, movingId)
    },
    [executeFolderMove, resetFolderDragState]
  )

  const onFolderDropOnRoot = useCallback(
    (e: DragEvent) => {
      if (!isFolderDrag(e)) return
      const raw = e.dataTransfer.getData(DND_FOLDER)
      const movingId = Number.parseInt(raw, 10)
      if (!Number.isFinite(movingId)) return
      resetFolderDragState()
      executeFolderMove(null, movingId)
    },
    [executeFolderMove, resetFolderDragState]
  )

  const rootDragOver = (e: DragEvent) => {
    if (onMoveMaterial && isMaterialDrag(e)) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'none'
      return
    }
    const mid = folderDragIdRef.current
    if (!isFolderDrag(e) || mid == null || !isAllowedTarget(null, mid)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const rootDrop = (e: DragEvent) => {
    e.preventDefault()
    if (onMoveMaterial && isMaterialDrag(e)) {
      setLocalErr('Материал можно перенести только в папку — выберите папку в дереве или плитку справа.')
      return
    }
    if (!isFolderDrag(e)) return
    onFolderDropOnRoot(e)
  }

  const onMaterialDragStart = (e: DragEvent, materialId: number) => {
    if (!onMoveMaterial || submitting) return
    e.dataTransfer.setData(DND_MATERIAL, String(materialId))
    e.dataTransfer.effectAllowed = 'move'
    setDraggingMaterial(true)
  }

  const onMaterialDragEnd = () => {
    setDraggingMaterial(false)
  }

  const handleDropMaterial = useCallback(
    (materialId: number, targetFolderId: number) => {
      if (!onMoveMaterial) return
      if (selectedId == null) {
        setLocalErr('Откройте папку-источник справа (хлебные крошки), откуда переносите материал.')
        return
      }
      if (targetFolderId === selectedId) {
        setLocalErr('Материал уже в этой папке.')
        return
      }
      if (moveInflight.current) return
      moveInflight.current = true
      setSubmitting(true)
      setLocalErr(null)
      onMoveMaterial(materialId, targetFolderId)
        .then(() => {
          setMaterialsByFolder((prev) => {
            const next = { ...prev }
            delete next[selectedId]
            delete next[targetFolderId]
            return next
          })
        })
        .catch((err) => {
          setLocalErr(err instanceof Error ? err.message : String(err))
        })
        .finally(() => {
          moveInflight.current = false
          setSubmitting(false)
        })
    },
    [onMoveMaterial, selectedId]
  )

  const folderItems = selectedId == null ? [] : materialsByFolder[selectedId] ?? []
  const isFolderLoading = selectedId != null && loadingFolderIds.has(selectedId)

  return createPortal(
    <div
      className="admin-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="folder-move-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting && !draggingFolder && !draggingMaterial) onClose()
      }}
    >
      <div className="admin-modal admin-modal--explorer" role="document" onClick={(e) => e.stopPropagation()}>
        <h4 id="folder-move-title" className="admin-modal-title">
          Перемещение папок
        </h4>

        <p className="folder-move-hint">
          Перетащите <strong>любую</strong> строку папки в дереве на цель или на «Все папки». Справа можно бросить на
          плитку 📁.           Хлебные крошки переключают просмотр содержимого папки; плитки 📁 справа тоже можно тащить, как строки
          дерева. После переноса окно остаётся открытым — нажмите «Закрыть», когда закончите.
          {onMoveMaterial ? (
            <>
              {' '}
              Материалы (📄) в открытой папке можно перетащить на другую папку в дереве или на плитку 📁 справа.
            </>
          ) : null}
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
                  forbiddenIdsForDrag={forbiddenIdsForDrag}
                  draggingFolder={draggingFolder}
                  draggingFolderId={draggingFolderId}
                  submitting={submitting}
                  onFolderDragStart={onFolderDragStart}
                  onFolderDragEnd={onFolderDragEnd}
                  onFolderDropOnFolder={onFolderDropOnFolder}
                  onDropMaterial={onMoveMaterial ? handleDropMaterial : undefined}
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
                  const onTileDragOver = (e: DragEvent) => {
                    if (onMoveMaterial && isMaterialDrag(e)) {
                      e.preventDefault()
                      e.stopPropagation()
                      e.dataTransfer.dropEffect = 'move'
                      return
                    }
                    const mid = folderDragIdRef.current
                    if (!isFolderDrag(e) || mid == null || !isAllowedTarget(f.id, mid)) return
                    e.preventDefault()
                    e.stopPropagation()
                    e.dataTransfer.dropEffect = 'move'
                  }
                  const onTileDrop = (e: DragEvent) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (onMoveMaterial && isMaterialDrag(e)) {
                      const raw = e.dataTransfer.getData(DND_MATERIAL)
                      const mid = Number.parseInt(raw, 10)
                      if (Number.isFinite(mid)) handleDropMaterial(mid, f.id)
                      return
                    }
                    if (!isFolderDrag(e)) return
                    onFolderDropOnFolder(e, f.id)
                  }
                  return (
                    <li key={`f-${f.id}`}>
                      <button
                        type="button"
                        className={
                          'folder-explorer-tile folder-explorer-tile--folder' +
                          (draggingFolderId === f.id ? ' folder-explorer-tile--drag-source' : '')
                        }
                        draggable={!submitting}
                        onDragStart={(e) => onFolderDragStart(e, f.id)}
                        onDragEnd={onFolderDragEnd}
                        onClick={() => onSelectFolder(f.id)}
                        onDoubleClick={() => onOpenFolder(f.id)}
                        title={`${f.path} — перетащите на другую папку или «Все папки»`}
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
                    <div
                      className={
                        onMoveMaterial
                          ? 'folder-explorer-tile folder-explorer-tile--material folder-explorer-tile--draggable'
                          : 'folder-explorer-tile folder-explorer-tile--material'
                      }
                      title={onMoveMaterial ? `${m.name} — перетащите на папку` : m.name}
                      draggable={Boolean(onMoveMaterial) && !submitting}
                      onDragStart={(e) => onMaterialDragStart(e, m.id)}
                      onDragEnd={onMaterialDragEnd}
                    >
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
          <button
            type="button"
            className="admin-primary admin-modal-confirm"
            disabled={submitting || draggingFolder || draggingMaterial}
            onClick={onClose}
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
