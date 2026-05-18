import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import {
  createTextureCategory,
  createTextureItem,
  deleteTextureCategory,
  deleteTextureItem,
  fetchTextureCategoryTree,
  fetchTextureItems,
  updateTextureCategory,
  updateTextureItem,
} from './api'
import { FolderCreateModal } from './FolderCreateModal'
import {
  DND_FOLDER,
  DND_TEXTURE_ITEM,
  isFolderDrag,
  isTextureItemDrag,
} from './folderMoveDnD'
import { HintButton } from './HintButton'
import { resolveTextureImageUrl } from './TexturePickerModal'
import type { TextureCategory, TextureItem } from './types'

const MODAL_CLOSE_X_SVG = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)
import './AdminApp.css'

type FolderRenameRequest = { targetId: number; nonce: number }

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

function collectSubtreeCategoryIds(cat: TextureCategory): Set<number> {
  const ids = new Set<number>()
  const walk = (node: TextureCategory) => {
    ids.add(node.id)
    for (const ch of node.children ?? []) walk(ch)
  }
  walk(cat)
  return ids
}

function AdminFolderToolbarIcon({
  label,
  disabled,
  onClick,
  className,
  children,
}: {
  label: string
  disabled?: boolean
  onClick?: () => void
  className?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={
        className ? `admin-folder-toolbar-btn ${className}` : 'admin-folder-toolbar-btn'
      }
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

type AdminTexturesTreeDnD = {
  draggingFolderId: number | null
  forbiddenIdsForDrag: Set<number>
  onFolderDragStart: (e: DragEvent, folderId: number) => void
  onFolderDragEnd: () => void
  onFolderDropOnFolder: (e: DragEvent, targetFolderId: number) => void
  onDropTextureOnFolder: (textureId: number, targetFolderId: number) => void
}

function TextureTreeRow({
  c,
  depth,
  selectedId,
  expandedIds,
  onToggleExpanded,
  onSelect,
  onRename,
  folderRenameRequest,
  onFolderRenameConsumed,
  treeDnD,
}: {
  c: TextureCategory
  depth: number
  selectedId: number | null
  expandedIds: Set<number>
  onToggleExpanded: (id: number) => void
  onSelect: (id: number) => void
  onRename: (id: number, name: string) => Promise<void>
  folderRenameRequest: FolderRenameRequest | null
  onFolderRenameConsumed: () => void
  treeDnD?: AdminTexturesTreeDnD
}) {
  const isSel = c.id === selectedId
  const hasKids = (c.children?.length ?? 0) > 0
  const isExpanded = hasKids ? expandedIds.has(c.id) : false
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(c.name)
  const inputRef = useRef<HTMLInputElement>(null)
  const dnd = treeDnD
  const canDropFolderHere = dnd ? !dnd.forbiddenIdsForDrag.has(c.id) : true
  const isDragSource = dnd ? c.id === dnd.draggingFolderId : false

  useEffect(() => {
    setDraft(c.name)
  }, [c.id, c.name])

  useLayoutEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  useEffect(() => {
    if (!folderRenameRequest || folderRenameRequest.targetId !== c.id) return
    setEditing(true)
    setDraft(c.name)
    onFolderRenameConsumed()
  }, [folderRenameRequest, c.id, c.name, onFolderRenameConsumed])

  const commit = () => {
    const t = draft.trim()
    if (!t) {
      setDraft(c.name)
      setEditing(false)
      return
    }
    if (t === c.name) {
      setEditing(false)
      return
    }
    onRename(c.id, t)
      .then(() => setEditing(false))
      .catch(() => {
        setDraft(c.name)
      })
  }

  const cancel = () => {
    setDraft(c.name)
    setEditing(false)
  }

  const lineClass =
    (isSel && !editing
      ? 'folder-explorer-tree-line folder-explorer-tree-line--active'
      : 'folder-explorer-tree-line') +
    (dnd && dnd.draggingFolderId != null && !canDropFolderHere
      ? ' folder-explorer-tree-line--move-blocked'
      : '') +
    (isDragSource ? ' folder-explorer-tree-line--drag-source' : '')

  const onDragOverRow = (e: DragEvent) => {
    if (!dnd) return
    if (isTextureItemDrag(e)) {
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
    if (!dnd) return
    e.preventDefault()
    e.stopPropagation()
    if (isTextureItemDrag(e)) {
      const raw = e.dataTransfer.getData(DND_TEXTURE_ITEM)
      const tid = Number.parseInt(raw, 10)
      if (Number.isFinite(tid)) dnd.onDropTextureOnFolder(tid, c.id)
      return
    }
    if (!isFolderDrag(e) || !canDropFolderHere) return
    dnd.onFolderDropOnFolder(e, c.id)
  }

  return (
    <li className="folder-explorer-tree-item">
      <div
        className={lineClass}
        style={{ paddingLeft: 6 + depth * 14 }}
        draggable={Boolean(dnd) && !editing}
        onDragStart={dnd && !editing ? (e) => dnd.onFolderDragStart(e, c.id) : undefined}
        onDragEnd={dnd ? dnd.onFolderDragEnd : undefined}
        onDragOver={onDragOverRow}
        onDrop={onDropRow}
        title={
          isDragSource
            ? 'Удерживайте и перетащите на другую папку или на «База текстур»'
            : c.path
        }
      >
        {hasKids ? (
          <button
            type="button"
            className="folder-explorer-tree-expander"
            draggable={false}
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
        {editing ? (
          <input
            ref={inputRef}
            className="admin-input tree-rename-input"
            value={draft}
            draggable={false}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commit()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                inputRef.current?.blur()
              }
              if (e.key === 'Escape') {
                e.preventDefault()
                cancel()
              }
            }}
            aria-label="Новое имя папки"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <button
            type="button"
            className="folder-explorer-tree-link"
            draggable={false}
            onClick={() => onSelect(c.id)}
            title={c.path}
          >
            <span className="folder-explorer-icon" aria-hidden>
              📁
            </span>
            <span className="folder-explorer-tree-name">{c.name}</span>
          </button>
        )}
      </div>
      {hasKids && isExpanded && (
        <ul className="folder-explorer-tree-children">
          {(c.children ?? []).map((ch) => (
            <TextureTreeRow
              key={ch.id}
              c={ch}
              depth={depth + 1}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onToggleExpanded={onToggleExpanded}
              onSelect={onSelect}
              onRename={onRename}
              folderRenameRequest={folderRenameRequest}
              onFolderRenameConsumed={onFolderRenameConsumed}
              treeDnD={treeDnD}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

function TextureCardForm({
  categoryId,
  item,
  onClose,
  onSaved,
  onDeleted,
}: {
  categoryId: number
  item: TextureItem | 'new'
  onClose: () => void
  onSaved: (t: TextureItem) => void
  onDeleted: (id: number) => void
}) {
  const [name, setName] = useState(item !== 'new' ? item.name : '')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [localErr, setLocalErr] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  const existingUrl = item !== 'new' && item.image ? resolveTextureImageUrl(item.image) : ''

  const save = () => {
    const n = name.trim()
    if (!n) {
      setLocalErr('Укажите наименование текстуры.')
      return
    }
    setSaving(true)
    setLocalErr(null)
    if (item === 'new') {
      if (!imageFile) {
        setLocalErr('Выберите файл изображения.')
        setSaving(false)
        return
      }
      const fd = new FormData()
      fd.append('category', String(categoryId))
      fd.append('name', n)
      fd.append('image', imageFile)
      createTextureItem(fd)
        .then((t) => {
          onSaved(t)
        })
        .catch((e) => setLocalErr(String(e)))
        .finally(() => setSaving(false))
      return
    }
    const id = item.id
    if (imageFile) {
      const fd = new FormData()
      fd.append('name', n)
      fd.append('image', imageFile)
      updateTextureItem(id, fd)
        .then((t) => {
          onSaved(t)
        })
        .catch((e) => setLocalErr(String(e)))
        .finally(() => setSaving(false))
    } else {
      updateTextureItem(id, { name: n, category: categoryId })
        .then((t) => {
          onSaved(t)
        })
        .catch((e) => setLocalErr(String(e)))
        .finally(() => setSaving(false))
    }
  }

  const confirmDelete = () => {
    if (item === 'new') return
    setDeleteOpen(false)
    setSaving(true)
    deleteTextureItem(item.id)
      .then(() => onDeleted(item.id))
      .then(() => onClose())
      .catch((e) => setLocalErr(String(e)))
      .finally(() => setSaving(false))
  }

  return (
    <>
      <div className="mat-form">
        <div className="mat-form-head">
          <div className="admin-heading-row mat-form-title-line">
            <h3 id="texture-card-dialog-title" className="admin-h2">
              {item === 'new' ? 'Новая текстура' : name.trim() || 'Без названия'}
            </h3>
          </div>
          <button
            type="button"
            className="admin-primary admin-modal-head-icon-close"
            aria-label="Закрыть"
            title="Закрыть"
            disabled={saving}
            onClick={onClose}
          >
            {MODAL_CLOSE_X_SVG}
          </button>
        </div>
        {localErr && <div className="admin-error">{localErr}</div>}
        <div
          className="mat-form-tab-panel"
          role="region"
          aria-label="Данные текстуры"
        >
          <label className="field mat-form-field-span-2">
            <span>Наименование *</span>
            <input
              className="admin-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <div className="field tex-file-row mat-form-field-span-2">
            <span>Изображение {item === 'new' ? '*' : ''}</span>
            <input
              className="admin-input"
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null
                setImageFile(f)
                if (preview) URL.revokeObjectURL(preview)
                setPreview(f ? URL.createObjectURL(f) : null)
              }}
            />
          </div>
          {(preview || existingUrl) && (
            <div className="field mat-form-field-span-2">
              <span>Предпросмотр</span>
              <div
                className="texture-picker-thumb"
                style={{
                  height: 120,
                  backgroundImage: `url(${preview || existingUrl})`,
                }}
              />
            </div>
          )}
          <div className="admin-row mat-form-actions">
            {item !== 'new' && (
              <button
                type="button"
                className="admin-secondary admin-danger"
                disabled={saving}
                onClick={() => setDeleteOpen(true)}
              >
                Удалить
              </button>
            )}
            <button type="button" className="admin-primary" disabled={saving} onClick={save}>
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>
      {deleteOpen &&
        createPortal(
          <div
            className="admin-modal-backdrop admin-modal-backdrop--stack-top"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tex-del-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) setDeleteOpen(false)
            }}
          >
            <div
              className="admin-modal admin-modal--elevated"
              role="document"
              onClick={(e) => e.stopPropagation()}
            >
              <h4 id="tex-del-title" className="admin-modal-title">
                Удалить текстуру?
              </h4>
              <p className="admin-modal-text">
                Запись будет удалена. У материалов, где была выбрана эта текстура, привязка
                сбросится.
              </p>
              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="admin-secondary"
                  onClick={() => setDeleteOpen(false)}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="admin-primary admin-modal-confirm"
                  onClick={confirmDelete}
                >
                  Удалить
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}

export function AdminTexturesPanel() {
  const [tree, setTree] = useState<TextureCategory[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const [items, setItems] = useState<TextureItem[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [editing, setEditing] = useState<TextureItem | 'new' | null>(null)
  const [folderCreateOpen, setFolderCreateOpen] = useState(false)
  const [folderDeleteModal, setFolderDeleteModal] = useState<TextureCategory | null>(null)
  const [folderRenameRequest, setFolderRenameRequest] = useState<FolderRenameRequest | null>(null)
  const [draggingFolderId, setDraggingFolderId] = useState<number | null>(null)
  const [texturesRootTreeExpanded, setTexturesRootTreeExpanded] = useState(true)

  const folderDragIdRef = useRef<number | null>(null)

  const reloadTree = useCallback(() => {
    return fetchTextureCategoryTree()
      .then((t) => {
        setTree(t)
        return t
      })
      .catch((e) => {
        setErr(String(e))
        return [] as TextureCategory[]
      })
  }, [])

  const reloadItems = useCallback(
    (categoryId: number | null) => {
      setErr(null)
      if (categoryId == null) {
        return fetchTextureItems()
          .then((r) => {
            setItems(r.results)
          })
          .catch((e) => setErr(String(e)))
      }
      return fetchTextureItems({ category: categoryId, subtree: true })
        .then((r) => {
          setItems(r.results)
        })
        .catch((e) => setErr(String(e)))
    },
    []
  )

  useEffect(() => {
    setExpandedIds((prev) => {
      if (prev.size > 0) return prev
      return collectIdsWithChildren(tree)
    })
  }, [tree])

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
    setLoading(true)
    setErr(null)
    reloadTree().finally(() => setLoading(false))
  }, [reloadTree])

  useEffect(() => {
    void reloadItems(selected)
  }, [selected, reloadItems])

  const toggleExpanded = useCallback((id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const submitNewFolder = useCallback(
    (parent: number | null, name: string) => {
      setErr(null)
      return createTextureCategory({ parent, name, sort_order: 0 })
        .then(async (created) => {
          await reloadTree()
          if (parent != null) {
            setExpandedIds((prev) => {
              if (prev.has(parent)) return prev
              const next = new Set(prev)
              next.add(parent)
              return next
            })
          }
          if (created && typeof created.id === 'number') {
            setSelected(created.id)
          }
        })
        .catch((e) => {
          setErr(String(e))
          throw e instanceof Error ? e : new Error(String(e))
        })
    },
    [reloadTree]
  )

  const renameFolder = useCallback(
    (id: number, name: string) => {
      setErr(null)
      return updateTextureCategory(id, { name })
        .then(() => reloadTree())
        .then(() => undefined)
        .catch((e) => {
          setErr(String(e))
          throw e
        })
    },
    [reloadTree]
  )

  const triggerRenameSelectedFolder = useCallback(() => {
    if (selected == null) return
    setFolderRenameRequest({ targetId: selected, nonce: Date.now() })
  }, [selected])

  const clearFolderRenameRequest = useCallback(() => {
    setFolderRenameRequest(null)
  }, [])

  const deleteFolder = useCallback((cat: TextureCategory) => {
    setFolderDeleteModal(cat)
  }, [])

  const selectedCategory = useMemo(
    () => (selected == null ? null : findCategoryNode(tree, selected)),
    [tree, selected]
  )

  /** Папки, чьи текстуры попадают в список справа (`null` = вся база). */
  const selectedTextureScopeIds = useMemo(() => {
    if (selected == null) return null
    const node = findCategoryNode(tree, selected)
    if (!node) return new Set<number>()
    return collectSubtreeCategoryIds(node)
  }, [selected, tree])

  const forbiddenIdsForDrag = useMemo(() => {
    if (draggingFolderId == null) return new Set<number>()
    const node = findCategoryNode(tree, draggingFolderId)
    return node ? collectSubtreeCategoryIds(node) : new Set<number>()
  }, [draggingFolderId, tree])

  const isAllowedFolderTarget = useCallback(
    (targetParentId: number | null, movingId: number) => {
      const node = findCategoryNode(tree, movingId)
      if (!node) return false
      const forb = collectSubtreeCategoryIds(node)
      if (targetParentId !== null && forb.has(targetParentId)) return false
      if (targetParentId === node.parent) return false
      return true
    },
    [tree]
  )

  const applyFolderMove = useCallback(
    async (newParentId: number | null, movingId: number) => {
      setErr(null)
      await updateTextureCategory(movingId, { parent: newParentId })
      await reloadTree()
      setExpandedIds((prev) => {
        const next = new Set(prev)
        if (newParentId != null) next.add(newParentId)
        return next
      })
      setSelected(movingId)
    },
    [reloadTree]
  )

  const applyTextureMove = useCallback(
    async (textureId: number, newCategoryId: number) => {
      setErr(null)
      await updateTextureItem(textureId, { category: newCategoryId })
      await reloadItems(selected)
      const cur = editing
      if (cur && cur !== 'new' && cur.id === textureId) {
        setEditing((prev) =>
          prev && prev !== 'new' && prev.id === textureId
            ? { ...prev, category: newCategoryId }
            : prev
        )
      }
    },
    [editing, reloadItems, selected]
  )

  const resetFolderDragState = useCallback(() => {
    folderDragIdRef.current = null
    setDraggingFolderId(null)
  }, [])

  const onFolderDragStart = useCallback((e: DragEvent, id: number) => {
    e.dataTransfer.setData(DND_FOLDER, String(id))
    e.dataTransfer.setData('text/plain', String(id))
    e.dataTransfer.effectAllowed = 'move'
    folderDragIdRef.current = id
    setDraggingFolderId(id)
  }, [])

  const onFolderDragEnd = resetFolderDragState

  const tryFolderMoveDnD = useCallback(
    async (newParentId: number | null, movingId: number) => {
      if (!isAllowedFolderTarget(newParentId, movingId)) {
        const node = findCategoryNode(tree, movingId)
        if (node && newParentId === node.parent) {
          setErr('Папка уже находится в этом расположении.')
        } else {
          setErr('Сюда перенести нельзя (сама папка или её вложенность).')
        }
        return
      }
      try {
        await applyFolderMove(newParentId, movingId)
      } catch (e) {
        setErr(String(e))
      }
    },
    [applyFolderMove, isAllowedFolderTarget, tree]
  )

  const onFolderDropOnFolder = useCallback(
    (e: DragEvent, targetFolderId: number) => {
      if (!isFolderDrag(e)) return
      const raw = e.dataTransfer.getData(DND_FOLDER)
      const movingId = Number.parseInt(raw, 10)
      if (!Number.isFinite(movingId)) return
      resetFolderDragState()
      void tryFolderMoveDnD(targetFolderId, movingId)
    },
    [resetFolderDragState, tryFolderMoveDnD]
  )

  const onFolderDropOnRoot = useCallback(
    (e: DragEvent) => {
      if (!isFolderDrag(e)) return
      const raw = e.dataTransfer.getData(DND_FOLDER)
      const movingId = Number.parseInt(raw, 10)
      if (!Number.isFinite(movingId)) return
      resetFolderDragState()
      void tryFolderMoveDnD(null, movingId)
    },
    [resetFolderDragState, tryFolderMoveDnD]
  )

  const rootFolderDragOver = useCallback(
    (e: DragEvent) => {
      if (isTextureItemDrag(e)) {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'none'
        return
      }
      const mid = folderDragIdRef.current
      if (!isFolderDrag(e) || mid == null || !isAllowedFolderTarget(null, mid)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
    },
    [isAllowedFolderTarget]
  )

  const rootFolderDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      if (isTextureItemDrag(e)) {
        setErr(
          'Текстуру можно перенести только в папку — перетащите строку текстуры на папку в дереве или в открытую папку справа.'
        )
        return
      }
      if (!isFolderDrag(e)) return
      onFolderDropOnRoot(e)
    },
    [onFolderDropOnRoot]
  )

  const onDropTextureOnFolder = useCallback(
    (textureId: number, targetFolderId: number) => {
      const tex = items.find((t) => t.id === textureId)
      if (tex && tex.category === targetFolderId) {
        setErr('Текстура уже в этой папке.')
        return
      }
      void applyTextureMove(textureId, targetFolderId).catch((e) => setErr(String(e)))
    },
    [applyTextureMove, items]
  )

  const treeDnD = useMemo<AdminTexturesTreeDnD>(
    () => ({
      draggingFolderId,
      forbiddenIdsForDrag,
      onFolderDragStart,
      onFolderDragEnd,
      onFolderDropOnFolder,
      onDropTextureOnFolder,
    }),
    [
      draggingFolderId,
      forbiddenIdsForDrag,
      onFolderDragStart,
      onFolderDragEnd,
      onFolderDropOnFolder,
      onDropTextureOnFolder,
    ]
  )

  const onMainTexturesDragOver = useCallback(
    (e: DragEvent) => {
      if (selected == null) {
        if (isFolderDrag(e) || isTextureItemDrag(e)) {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'none'
        }
        return
      }
      if (isTextureItemDrag(e)) {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        return
      }
      if (isFolderDrag(e)) {
        const mid = folderDragIdRef.current
        if (mid != null && isAllowedFolderTarget(selected, mid)) {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
        } else {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'none'
        }
      }
    },
    [isAllowedFolderTarget, selected]
  )

  const onMainTexturesDrop = useCallback(
    (e: DragEvent) => {
      if (selected == null) return
      e.preventDefault()
      if (isTextureItemDrag(e)) {
        const raw = e.dataTransfer.getData(DND_TEXTURE_ITEM)
        const tid = Number.parseInt(raw, 10)
        if (Number.isFinite(tid)) onDropTextureOnFolder(tid, selected)
        return
      }
      if (isFolderDrag(e)) {
        const raw = e.dataTransfer.getData(DND_FOLDER)
        const movingId = Number.parseInt(raw, 10)
        if (!Number.isFinite(movingId)) return
        resetFolderDragState()
        void tryFolderMoveDnD(selected, movingId)
      }
    },
    [onDropTextureOnFolder, resetFolderDragState, selected, tryFolderMoveDnD]
  )

  const onTextureRowDragStart = useCallback((e: DragEvent, t: TextureItem) => {
    e.dataTransfer.setData(DND_TEXTURE_ITEM, String(t.id))
    e.dataTransfer.setData('text/plain', String(t.id))
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const confirmDeleteFolder = useCallback(() => {
    const cat = folderDeleteModal
    if (!cat) return
    setFolderDeleteModal(null)
    setErr(null)
    const removed = collectSubtreeCategoryIds(cat)
    const nextSel = selected != null && removed.has(selected) ? null : selected
    if (selected != null && removed.has(selected)) {
      setSelected(null)
      setEditing(null)
    }
    deleteTextureCategory(cat.id)
      .then(() => reloadTree())
      .then(() => reloadItems(nextSel))
      .catch((e) => setErr(String(e)))
  }, [folderDeleteModal, reloadItems, reloadTree, selected])

  const cancelDeleteFolder = useCallback(() => {
    setFolderDeleteModal(null)
  }, [])

  useEffect(() => {
    if (!folderDeleteModal) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setFolderDeleteModal(null)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [folderDeleteModal])

  return (
    <>
      <div
        className={loading ? 'admin-body admin-body--textures-loading-host' : 'admin-body'}
        id="admin-panel-textures"
        role="tabpanel"
        aria-labelledby="admin-tab-textures"
      >
        {loading ? (
          <div
            className="admin-textures-loading"
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label="Загрузка папок текстур"
          >
            <div className="admin-textures-loading__shade" aria-hidden />
            <div className="admin-textures-loading__card">
              <span className="admin-textures-loading__spinner" aria-hidden />
              <span className="admin-textures-loading__label">Загрузка</span>
            </div>
          </div>
        ) : null}
        {err && <div className="admin-error">{err}</div>}
        <aside className="admin-aside">
          <div className="admin-heading-row">
            <h2 className="admin-h2">Папки текстур</h2>
            <HintButton text="Клик по названию папки — выбрать её; список справа: при «База текстур» — все текстуры базы, при выборе папки — текстуры в ней и во вложенных папках. Стрелка слева от «База текстур» сворачивает и разворачивает список папок. Папку можно перетащить на другую строку папки, на строку «База текстур» или в область открытой папки справа; текстуру — на папку в дереве или в область списка выбранной папки. Панель: новая папка, переименовать и удалить папку." />
          </div>
          <div
            className="admin-folder-toolbar"
            role="toolbar"
            aria-label="Действия с папками и текстурами"
          >
            <AdminFolderToolbarIcon
              label="Создать папку"
              onClick={() => setFolderCreateOpen(true)}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.65"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M12 19h8a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-5l-1.33-1.5H5A1 1 0 0 0 4 6.5V18a1 1 0 0 0 1 1h7" />
                <path d="M12 11v6M9 14h6" />
              </svg>
            </AdminFolderToolbarIcon>
            <AdminFolderToolbarIcon
              label="Переименовать выбранную папку"
              disabled={selected == null}
              onClick={triggerRenameSelectedFolder}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.65"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
              </svg>
            </AdminFolderToolbarIcon>
            <AdminFolderToolbarIcon
              className="admin-folder-toolbar-btn--danger"
              label="Удалить выбранную папку"
              disabled={selectedCategory == null}
              onClick={() => selectedCategory && deleteFolder(selectedCategory)}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.65"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6h12zM10 11v6M14 11v6" />
              </svg>
            </AdminFolderToolbarIcon>
          </div>
          <ul
            className="folder-explorer-tree-root admin-materials-tree-root"
            aria-label="Дерево папок"
          >
            <li className="folder-explorer-tree-item folder-explorer-tree-item--materials-root">
              <div
                className={
                  (selected == null
                    ? 'folder-explorer-tree-line folder-explorer-tree-line--active'
                    : 'folder-explorer-tree-line') +
                  (draggingFolderId != null && !isAllowedFolderTarget(null, draggingFolderId)
                    ? ' folder-explorer-tree-line--move-blocked'
                    : '')
                }
                draggable={false}
                onDragOver={rootFolderDragOver}
                onDrop={rootFolderDrop}
              >
                {tree.length > 0 ? (
                  <button
                    type="button"
                    className="folder-explorer-tree-expander"
                    draggable={false}
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
                  draggable={false}
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
                    <TextureTreeRow
                      key={c.id}
                      c={c}
                      depth={0}
                      selectedId={selected}
                      expandedIds={expandedIds}
                      onToggleExpanded={toggleExpanded}
                      onSelect={setSelected}
                      onRename={renameFolder}
                      folderRenameRequest={folderRenameRequest}
                      onFolderRenameConsumed={clearFolderRenameRequest}
                      treeDnD={treeDnD}
                    />
                  ))}
                </ul>
              ) : null}
            </li>
          </ul>
        </aside>
        <div className="admin-main-col">
          <main className="admin-main">
            <div
              className="admin-main-scroll"
              onDragOver={onMainTexturesDragOver}
              onDrop={onMainTexturesDrop}
            >
              <div className="admin-heading-row">
                <h2 className="admin-h2">
                  {selected == null
                    ? 'Текстуры: база текстур'
                    : `Текстуры в папке: ${
                        findCategoryNode(tree, selected)?.name?.trim() || '—'
                      }`}
                </h2>
              </div>
              <button
                type="button"
                className="admin-primary"
                disabled={selected == null}
                title={
                  selected == null
                    ? 'Сначала выберите папку слева — у текстуры должна быть категория'
                    : undefined
                }
                onClick={() => setEditing('new')}
              >
                + Текстура
              </button>
              {editing ? (
                <p className="admin-material-card-context" aria-live="polite">
                  {editing === 'new' ? 'Новая текстура' : editing.name.trim() || '—'}
                </p>
              ) : null}
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
                    const rowActive =
                      editing && editing !== 'new' && editing.id === it.id
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
                            aria-label={`Текстура: ${it.name || 'текстура'}. Щелчок или Enter — карточка.`}
                            draggable
                            onDragStart={(e) => onTextureRowDragStart(e, it)}
                            onClick={() => setEditing(it)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                setEditing(it)
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
                            <span className="mat-list-cell mat-list-cell-name">
                              {it.name}
                            </span>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>
          </main>
        </div>
        {editing && (editing !== 'new' || selected != null)
          ? createPortal(
              <div
                className="admin-modal-backdrop"
                role="presentation"
                onClick={(e) => {
                  if (e.target === e.currentTarget) setEditing(null)
                }}
              >
                <section
                  className="admin-panel admin-panel--in-material-modal admin-calculations-modal-surface admin-modal--material-card admin-material-card-dialog"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="texture-card-dialog-title"
                  onClick={(e) => e.stopPropagation()}
                >
                  <TextureCardForm
                    key={editing === 'new' ? 'new' : editing.id}
                    categoryId={
                      editing === 'new' ? (selected as number) : editing.category
                    }
                    item={editing}
                    onClose={() => setEditing(null)}
                    onSaved={(t) => {
                      const savedCategoryId = Number(t.category)
                      setItems((prev) => {
                        if (editing === 'new') {
                          if (
                            selectedTextureScopeIds == null ||
                            selectedTextureScopeIds.has(savedCategoryId)
                          ) {
                            return [...prev, t]
                          }
                          return prev
                        }
                        if (
                          selectedTextureScopeIds != null &&
                          !selectedTextureScopeIds.has(savedCategoryId)
                        ) {
                          return prev.filter((x) => x.id !== t.id)
                        }
                        return prev.map((x) => (x.id === t.id ? t : x))
                      })
                      setEditing(t)
                    }}
                    onDeleted={(id) => {
                      setItems((prev) => prev.filter((x) => x.id !== id))
                      setEditing(null)
                    }}
                  />
                </section>
              </div>,
              document.body
            )
          : null}
      </div>
      {folderCreateOpen ? (
        <FolderCreateModal
          tree={tree}
          initialParentId={selected}
          onClose={() => setFolderCreateOpen(false)}
          onCreate={submitNewFolder}
        />
      ) : null}
      {folderDeleteModal &&
        createPortal(
          <div
            className="admin-modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tex-folder-delete-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) cancelDeleteFolder()
            }}
          >
            <div
              className="admin-modal"
              role="document"
              onClick={(e) => e.stopPropagation()}
            >
              <h4 id="tex-folder-delete-title" className="admin-modal-title">
                Удалить папку?
              </h4>
              <p className="admin-modal-text">
                Папка «{folderDeleteModal.name}» будет удалена вместе со всеми вложенными
                папками и текстурами. Материалы с привязкой к этим текстурам потеряют ссылку.
                Продолжить?
              </p>
              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="admin-secondary"
                  onClick={cancelDeleteFolder}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="admin-primary admin-modal-confirm"
                  onClick={confirmDeleteFolder}
                >
                  Удалить
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
