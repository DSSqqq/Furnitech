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
import { useLocation, useNavigate } from 'react-router-dom'
import {
  createCategory,
  createMaterial,
  createMaterialClass,
  deleteCategory,
  deleteMaterial,
  deleteMaterialClass,
  deleteAdminUser,
  downloadMaterialsExport,
  fetchAdminUsers,
  fetchMaterial,
  fetchCategoryTree,
  fetchMaterialClasses,
  fetchMaterials,
  fetchMaterialsFiltered,
  fetchUom,
  importMaterialsTable,
  patchAdminUserStaff,
  updateCategory,
  updateMaterial,
  type AdminUserRow,
} from './api'
import { AdminOrdersPanel } from './AdminOrdersPanel'
import { AdminTexturesPanel } from './AdminTexturesPanel'
import { FolderCreateModal } from './FolderCreateModal'
import { DND_FOLDER, DND_MATERIAL, isFolderDrag, isMaterialDrag } from './folderMoveDnD'
import type { Me } from './auth'
import { BASE_CURRENCY } from './currencies'
import {
  commitDecimalForApi,
  DECIMAL_FRACTION_DIGITS,
  formatDecimalStringForUi,
  formatDecimalStringForInput,
  filterDecimalInput,
  normalizeDecimalForInput,
} from './floatInput'
import { FtSelect, type FtSelectOption } from './FtSelect'
import { HintButton } from './HintButton'
import { sortUomForSelect } from './uomSelectOrder'
import { materialExtrasInitRelated, MaterialExtrasPanel, type RelatedItemState } from './MaterialExtrasPanel'
import { CalculatorPage } from './CalculatorPage'
import { resolveTextureImageUrl, TexturePickerModal } from './TexturePickerModal'
import type { Material, MaterialCategory, MaterialClass, RoundingMode, UnitOfMeasure } from './types'
import './AdminApp.css'

function collectIdsWithChildren(tree: MaterialCategory[]): Set<number> {
  const out = new Set<number>()
  const walk = (nodes: MaterialCategory[]) => {
    for (const n of nodes) {
      const kids = n.children ?? []
      if (kids.length > 0) out.add(n.id)
      if (kids.length > 0) walk(kids)
    }
  }
  walk(tree)
  return out
}

function findPathToId(tree: MaterialCategory[], id: number): number[] | null {
  const walk = (nodes: MaterialCategory[], path: number[]): number[] | null => {
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

function findCategoryNode(nodes: MaterialCategory[], id: number): MaterialCategory | null {
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

type FolderRenameRequest = { targetId: number; nonce: number }

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
      className={className ? `admin-folder-toolbar-btn ${className}` : 'admin-folder-toolbar-btn'}
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

/** Папка и все вложенные папки (по объекту из дерева). */
function collectSubtreeCategoryIds(cat: MaterialCategory): Set<number> {
  const ids = new Set<number>()
  const walk = (node: MaterialCategory) => {
    ids.add(node.id)
    for (const ch of node.children ?? []) walk(ch)
  }
  walk(cat)
  return ids
}

type AdminProps = {
  user: Me
  onLogout: () => void
}

type AdminMaterialsTreeDnD = {
  draggingFolderId: number | null
  forbiddenIdsForDrag: Set<number>
  onFolderDragStart: (e: DragEvent, folderId: number) => void
  onFolderDragEnd: () => void
  onFolderDropOnFolder: (e: DragEvent, targetFolderId: number) => void
  onDropMaterialOnFolder: (materialId: number, targetFolderId: number) => void
}

function TreeRow({
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
  c: MaterialCategory
  depth: number
  selectedId: number | null
  expandedIds: Set<number>
  onToggleExpanded: (id: number) => void
  onSelect: (id: number) => void
  onRename: (id: number, name: string) => Promise<void>
  folderRenameRequest: FolderRenameRequest | null
  onFolderRenameConsumed: () => void
  treeDnD?: AdminMaterialsTreeDnD
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
    (isSel && !editing ? 'folder-explorer-tree-line folder-explorer-tree-line--active' : 'folder-explorer-tree-line') +
    (dnd && dnd.draggingFolderId != null && !canDropFolderHere ? ' folder-explorer-tree-line--move-blocked' : '') +
    (isDragSource ? ' folder-explorer-tree-line--drag-source' : '')

  const onDragOverRow = (e: DragEvent) => {
    if (!dnd) return
    if (isMaterialDrag(e)) {
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
    if (isMaterialDrag(e)) {
      const raw = e.dataTransfer.getData(DND_MATERIAL)
      const mid = Number.parseInt(raw, 10)
      if (Number.isFinite(mid)) dnd.onDropMaterialOnFolder(mid, c.id)
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
        title={isDragSource ? 'Удерживайте и перетащите на другую папку или на «Все папки»' : c.path}
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
          <span className="folder-explorer-tree-expander folder-explorer-tree-expander--spacer" aria-hidden />
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
            <TreeRow
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

const ROUNDING: { v: RoundingMode; l: string }[] = [
  { v: 'none', l: 'Не округлять' },
  { v: 'ceil_unit', l: 'Округлять вверх до целого' },
  { v: 'ceil_multiple', l: 'Округлять вверх до кратного числа' },
]

/** Заголовок колонок списка материалов (совпадает с ячейками строк). */
const MAT_LIST_COLUMNS = [
  'Артикул',
  'Наименование материала',
  'Ед. измерения',
  'Цена',
] as const

const ADMIN_USER_ROLE_OPTIONS: FtSelectOption[] = [
  { value: 'user', label: 'Пользователь' },
  { value: 'admin', label: 'Админ' },
]

const ADMIN_SUPERUSER_ROLE_OPTIONS: FtSelectOption[] = [{ value: 'super', label: 'Суперпользователь' }]

function dashIfEmpty(s: string | undefined | null) {
  const t = (s ?? '').trim()
  return t ? t : '—'
}

function formatListBasePrice(m: Material) {
  const p = formatDecimalStringForUi(String(m.base_price), DECIMAL_FRACTION_DIGITS)
  return `${p} ${m.base_currency || BASE_CURRENCY}`
}

export function AdminApp({ user, onLogout }: AdminProps) {
  const nav = useNavigate()
  const loc = useLocation()
  const section: 'materials' | 'textures' | 'orders' | 'calculator' | 'users' = (() => {
    const p = (loc.pathname || '/materials').toLowerCase()
    if (p.startsWith('/calculator')) return 'calculator'
    if (p.startsWith('/orders')) return 'orders'
    if (p.startsWith('/users')) return 'users'
    if (p.startsWith('/textures')) return 'textures'
    return 'materials'
  })()
  const [tree, setTree] = useState<MaterialCategory[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const [materials, setMaterials] = useState<Material[]>([])
  const [uom, setUom] = useState<UnitOfMeasure[]>([])
  const [mclasses, setMclasses] = useState<MaterialClass[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [editing, setEditing] = useState<Material | 'new' | null>(null)
  const [extrasTarget, setExtrasTarget] = useState<Material | null>(null)
  const [extrasRelated, setExtrasRelated] = useState<RelatedItemState[]>([])
  const [extrasBasePrice, setExtrasBasePrice] = useState('0')
  const [extrasSaving, setExtrasSaving] = useState(false)
  const [extrasErr, setExtrasErr] = useState<string | null>(null)
  const [folderCreateOpen, setFolderCreateOpen] = useState(false)
  const [folderDeleteModal, setFolderDeleteModal] = useState<MaterialCategory | null>(null)
  const [folderRenameRequest, setFolderRenameRequest] = useState<FolderRenameRequest | null>(null)
  const [adminUsers, setAdminUsers] = useState<AdminUserRow[]>([])
  const [adminUsersLoading, setAdminUsersLoading] = useState(false)
  const [adminUsersErr, setAdminUsersErr] = useState<string | null>(null)
  const [staffTogglePending, setStaffTogglePending] = useState<number | null>(null)
  const [userDeleteModal, setUserDeleteModal] = useState<AdminUserRow | null>(null)
  const materialsImportFileRef = useRef<HTMLInputElement>(null)
  const folderDragIdRef = useRef<number | null>(null)
  const [materialsImportBusy, setMaterialsImportBusy] = useState(false)
  const [materialsImportMsg, setMaterialsImportMsg] = useState<string | null>(null)
  const [materialsExportFormat, setMaterialsExportFormat] = useState<'xlsx' | 'xml'>('xlsx')
  const [draggingFolderId, setDraggingFolderId] = useState<number | null>(null)

  const reloadTree = useCallback(() => {
    return fetchCategoryTree()
      .then((t) => {
        setTree(t)
        return t
      })
      .catch((e) => {
        setErr(String(e))
        return []
      })
  }, [])

  useEffect(() => {
    // При первом заходе оставляем поведение как раньше: дерево раскрыто.
    setExpandedIds((prev) => {
      if (prev.size > 0) return prev
      return collectIdsWithChildren(tree)
    })
  }, [tree])

  useEffect(() => {
    // Если выбрали папку, гарантируем что её предки раскрыты.
    if (selected == null) return
    const path = findPathToId(tree, selected)
    if (!path || path.length < 2) return
    setExpandedIds((prev) => {
      const next = new Set(prev)
      // Раскрываем всех предков (кроме самой папки — её может раскрыть/свернуть пользователь).
      for (const id of path.slice(0, -1)) next.add(id)
      return next
    })
  }, [selected, tree])

  const toggleExpanded = useCallback((id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const loadRefs = useCallback(() => {
    return Promise.all([fetchUom(), fetchMaterialClasses()]).then(([u, mc]) => {
      setUom(sortUomForSelect(u.results))
      setMclasses(mc.results)
    })
  }, [])

  useEffect(() => {
    setLoading(true)
    setErr(null)
    Promise.all([reloadTree(), loadRefs()]).finally(() => setLoading(false))
  }, [reloadTree, loadRefs])

  useEffect(() => {
    if (selected == null) {
      fetchMaterialsFiltered({})
        .then((r) => setMaterials(r.results))
        .catch((e) => setErr(String(e)))
      return
    }
    fetchMaterials(selected, { subtree: true })
      .then((r) => setMaterials(r.results))
      .catch((e) => setErr(String(e)))
  }, [selected])

  useEffect(() => {
    setExtrasTarget(null)
  }, [selected])

  useEffect(() => {
    if (section !== 'materials') setExtrasTarget(null)
  }, [section])

  useEffect(() => {
    if (!extrasTarget) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !extrasSaving) {
        e.preventDefault()
        setExtrasTarget(null)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [extrasTarget, extrasSaving])

  useEffect(() => {
    if (!extrasTarget) {
      setExtrasRelated([])
      setExtrasBasePrice('0')
      setExtrasErr(null)
      return
    }
    setExtrasRelated(materialExtrasInitRelated(extrasTarget))
    setExtrasBasePrice(formatDecimalStringForInput(String(extrasTarget.base_price ?? '0'), DECIMAL_FRACTION_DIGITS))
  }, [extrasTarget])

  const saveExtras = useCallback(() => {
    if (!extrasTarget) return
    setExtrasSaving(true)
    setExtrasErr(null)
    updateMaterial(extrasTarget.id, {
      related_items: extrasRelated.map((r) => ({
        related_material_id: r.related_material_id,
        quantity: commitDecimalForApi(r.quantity),
        quantity_scale: r.quantity_scale,
      })),
    })
      .then((updated) => {
        setMaterials((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
        setExtrasTarget(updated)
        setExtrasRelated(materialExtrasInitRelated(updated))
        setExtrasBasePrice(formatDecimalStringForInput(String(updated.base_price ?? '0'), DECIMAL_FRACTION_DIGITS))
      })
      .catch((e) => setExtrasErr(String(e)))
      .finally(() => setExtrasSaving(false))
  }, [extrasTarget, extrasRelated])

  const onMaterialsImportFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return
      const lower = file.name.toLowerCase()
      if (!lower.endsWith('.xml') && !lower.endsWith('.xlsx')) {
        setErr('Импорт: выберите файл .xml или .xlsx')
        return
      }
      setMaterialsImportBusy(true)
      setErr(null)
      setMaterialsImportMsg(null)
      importMaterialsTable(file)
        .then(async (res) => {
          await reloadTree()
          if (selected != null) {
            try {
              const r = await fetchMaterials(selected, { subtree: true })
              setMaterials(r.results)
            } catch {
              /* ignore */
            }
          } else {
            try {
              const r = await fetchMaterialsFiltered({})
              setMaterials(r.results)
            } catch {
              /* ignore */
            }
          }
          const errTail =
            res.errors?.length > 0 ? ` Предупреждения: ${res.errors.slice(0, 8).join('; ')}` : ''
          setMaterialsImportMsg(
            `Импорт: создано ${res.created}, обновлено ${res.updated}, пропущено ${res.skipped}.${errTail}`,
          )
        })
        .catch((err) => {
          setErr(String(err))
        })
        .finally(() => setMaterialsImportBusy(false))
    },
    [reloadTree, selected],
  )

  const onMaterialsExportClick = useCallback(() => {
    setErr(null)
    setMaterialsImportMsg(null)
    setMaterialsImportBusy(true)
    downloadMaterialsExport(selected, materialsExportFormat)
      .catch((e) => setErr(String(e)))
      .finally(() => setMaterialsImportBusy(false))
  }, [selected, materialsExportFormat])

  const submitNewFolder = useCallback(
    (parent: number | null, name: string) => {
      setErr(null)
      return createCategory({ parent, name, sort_order: 0 })
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
      return updateCategory(id, { name })
        .then(() => reloadTree())
        .then(() => undefined)
        .catch((e) => {
          setErr(String(e))
          throw e
        })
    },
    [reloadTree]
  )

  const deleteFolder = useCallback((cat: MaterialCategory) => {
    setFolderDeleteModal(cat)
  }, [])

  const clearFolderRenameRequest = useCallback(() => setFolderRenameRequest(null), [])

  const triggerRenameSelectedFolder = useCallback(() => {
    if (selected == null) return
    setFolderRenameRequest((r) => ({ targetId: selected, nonce: (r?.nonce ?? 0) + 1 }))
  }, [selected])

  const selectedCategory = useMemo(
    () => (selected == null ? null : findCategoryNode(tree, selected)),
    [tree, selected]
  )

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
    [tree],
  )

  const applyFolderMove = useCallback(async (newParentId: number | null, movingId: number) => {
    setErr(null)
    await updateCategory(movingId, { parent: newParentId })
    await reloadTree()
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (newParentId != null) next.add(newParentId)
      return next
    })
    setSelected(movingId)
  }, [reloadTree])

  const applyMaterialMove = useCallback(async (materialId: number, newCategoryId: number) => {
    setErr(null)
    await updateMaterial(materialId, { category: newCategoryId })
    if (selected != null) {
      const r = await fetchMaterials(selected, { subtree: true })
      setMaterials(r.results)
    } else {
      const r = await fetchMaterialsFiltered({})
      setMaterials(r.results)
    }
    const cur = editing
    if (cur && cur !== 'new' && cur.id === materialId) {
      const full = await fetchMaterial(materialId)
      setEditing(full)
    }
  }, [selected, editing])

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
    [applyFolderMove, isAllowedFolderTarget, tree],
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
    [resetFolderDragState, tryFolderMoveDnD],
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
    [resetFolderDragState, tryFolderMoveDnD],
  )

  const rootFolderDragOver = useCallback(
    (e: DragEvent) => {
      if (isMaterialDrag(e)) {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'none'
        return
      }
      const mid = folderDragIdRef.current
      if (!isFolderDrag(e) || mid == null || !isAllowedFolderTarget(null, mid)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
    },
    [isAllowedFolderTarget],
  )

  const rootFolderDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      if (isMaterialDrag(e)) {
        setErr('Материал можно перенести только в папку — перетащите строку материала на папку в дереве или в открытую папку справа.')
        return
      }
      if (!isFolderDrag(e)) return
      onFolderDropOnRoot(e)
    },
    [onFolderDropOnRoot],
  )

  const onDropMaterialOnFolder = useCallback(
    (materialId: number, targetFolderId: number) => {
      const mat = materials.find((m) => m.id === materialId)
      if (mat && mat.category === targetFolderId) {
        setErr('Материал уже в этой папке.')
        return
      }
      void applyMaterialMove(materialId, targetFolderId).catch((err) => setErr(String(err)))
    },
    [applyMaterialMove, materials],
  )

  const materialsTreeDnD = useMemo(
    () => ({
      draggingFolderId,
      forbiddenIdsForDrag,
      onFolderDragStart,
      onFolderDragEnd,
      onFolderDropOnFolder,
      onDropMaterialOnFolder,
    }),
    [
      draggingFolderId,
      forbiddenIdsForDrag,
      onFolderDragStart,
      onFolderDragEnd,
      onFolderDropOnFolder,
      onDropMaterialOnFolder,
    ],
  )

  const onMainMaterialsDragOver = useCallback(
    (e: DragEvent) => {
      if (selected == null) {
        if (isFolderDrag(e) || isMaterialDrag(e)) {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'none'
        }
        return
      }
      if (isMaterialDrag(e)) {
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
    [isAllowedFolderTarget, selected],
  )

  const onMainMaterialsDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      if (selected == null) return
      if (isMaterialDrag(e)) {
        const raw = e.dataTransfer.getData(DND_MATERIAL)
        const mid = Number.parseInt(raw, 10)
        if (!Number.isFinite(mid)) return
        const mat = materials.find((m) => m.id === mid)
        if (mat && mat.category === selected) {
          setErr('Материал уже в этой папке.')
          return
        }
        void applyMaterialMove(mid, selected).catch((err) => setErr(String(err)))
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
    [applyMaterialMove, materials, resetFolderDragState, selected, tryFolderMoveDnD],
  )

  const onMaterialRowDragStart = useCallback((e: DragEvent, m: Material) => {
    e.dataTransfer.setData(DND_MATERIAL, String(m.id))
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const confirmDeleteFolder = useCallback(() => {
    const cat = folderDeleteModal
    if (!cat) return
    setFolderDeleteModal(null)
    setErr(null)
    deleteCategory(cat.id)
      .then(() => {
        const removed = collectSubtreeCategoryIds(cat)
        const prevSel = selected
        const clearSel = prevSel != null && removed.has(prevSel)
        if (clearSel) {
          setSelected(null)
          setEditing(null)
        }
        return reloadTree().then(() => ({ prevSel, clearSel }))
      })
      .then(({ prevSel, clearSel }) => {
        const targetSel = clearSel ? null : prevSel
        if (targetSel == null) {
          return fetchMaterialsFiltered({})
            .then((r) => setMaterials(r.results))
            .catch(() => {
              /* ignore */
            })
        }
        return fetchMaterials(targetSel, { subtree: true })
          .then((r) => setMaterials(r.results))
          .catch(() => {
            /* ignore */
          })
      })
      .catch((e) => setErr(String(e)))
  }, [folderDeleteModal, reloadTree, selected])

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

  useEffect(() => {
    if (section !== 'users') return
    let cancelled = false
    setAdminUsersLoading(true)
    setAdminUsersErr(null)
    fetchAdminUsers()
      .then((rows) => {
        if (!cancelled) setAdminUsers(rows)
      })
      .catch((e) => {
        if (!cancelled) setAdminUsersErr(String(e))
      })
      .finally(() => {
        if (!cancelled) setAdminUsersLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [section])

  const setStaffFlag = useCallback((id: number, next: boolean) => {
    setAdminUsersErr(null)
    setStaffTogglePending(id)
    patchAdminUserStaff(id, next)
      .then((row) => {
        setAdminUsers((prev) => prev.map((u) => (u.id === row.id ? row : u)))
      })
      .catch((e) => setAdminUsersErr(String(e)))
      .finally(() => setStaffTogglePending(null))
  }, [])

  const cancelDeleteUser = useCallback(() => {
    setUserDeleteModal(null)
  }, [])

  const confirmDeleteUser = useCallback(() => {
    const row = userDeleteModal
    if (!row) return
    setUserDeleteModal(null)
    setAdminUsersErr(null)
    deleteAdminUser(row.id)
      .then(() => {
        setAdminUsers((prev) => prev.filter((u) => u.id !== row.id))
      })
      .catch((e) => setAdminUsersErr(String(e)))
  }, [userDeleteModal])

  useEffect(() => {
    if (!userDeleteModal) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setUserDeleteModal(null)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [userDeleteModal])

  return (
    <>
    <div className="admin">
      <header className="admin-header">
        <div className="admin-header-top">
          <div className="admin-brand">Фурнитех</div>
          <div className="admin-user">
            <span className="admin-user-email" title={user.username}>
              {user.email || user.username}
            </span>
            <button type="button" className="admin-logout" onClick={onLogout}>
              Выйти
            </button>
          </div>
        </div>
        <nav className="admin-section-tabs" role="tablist" aria-label="Разделы админки">
          <button
            type="button"
            role="tab"
            className={
              section === 'materials' ? 'admin-section-tab admin-section-tab--active' : 'admin-section-tab'
            }
            aria-selected={section === 'materials'}
            aria-controls="admin-panel-materials"
            id="admin-tab-materials"
            onClick={() => nav('/materials')}
          >
            Материалы
          </button>
          <button
            type="button"
            role="tab"
            className={
              section === 'textures' ? 'admin-section-tab admin-section-tab--active' : 'admin-section-tab'
            }
            aria-selected={section === 'textures'}
            aria-controls="admin-panel-textures"
            id="admin-tab-textures"
            onClick={() => nav('/textures')}
          >
            Текстуры
          </button>
          <button
            type="button"
            role="tab"
            className={
              section === 'calculator' ? 'admin-section-tab admin-section-tab--active' : 'admin-section-tab'
            }
            aria-selected={section === 'calculator'}
            aria-controls="admin-panel-calculator"
            id="admin-tab-calculator"
            onClick={() => nav('/calculator')}
          >
            Калькулятор
          </button>
          <button
            type="button"
            role="tab"
            className={section === 'orders' ? 'admin-section-tab admin-section-tab--active' : 'admin-section-tab'}
            aria-selected={section === 'orders'}
            aria-controls="admin-panel-orders"
            id="admin-tab-orders"
            onClick={() => nav('/orders')}
          >
            Заказы
          </button>
          <button
            type="button"
            role="tab"
            className={section === 'users' ? 'admin-section-tab admin-section-tab--active' : 'admin-section-tab'}
            aria-selected={section === 'users'}
            aria-controls="admin-panel-users"
            id="admin-tab-users"
            onClick={() => nav('/users')}
          >
            Пользователи
          </button>
        </nav>
      </header>
      {err && section === 'materials' && <div className="admin-error">{err}</div>}
      {loading && section === 'materials' && <p className="admin-muted admin-initial-state">Загрузка…</p>}
      {section === 'materials' ? (
        <div className="admin-body" id="admin-panel-materials" role="tabpanel" aria-labelledby="admin-tab-materials">
          <aside className="admin-aside">
            <div className="admin-heading-row">
              <h2 className="admin-h2">Папки материалов</h2>
              <HintButton text="Клик по названию папки — выбрать её; «Все папки» — список всех материалов. Папку можно перетащить на другую строку папки, на «Все папки» или в область открытой папки справа; материал — на папку в дереве или в область списка выбранной папки. Панель: новая папка, переименовать и удалить папку, импорт и экспорт. Импорт .xml или .xlsx: в карточке сохраняется полный снимок строки таблицы для повторного экспорта; в интерфейсе по-прежнему отображаются только нужные поля. Экспорт: выберите XLSX или XML — структура как у типовой выгрузки (таблица с русскими заголовками или Database/Materials/Material). Если открыты «Все папки» — все материалы, иначе ветка выбранной папки." />
            </div>
            <div className="admin-folder-toolbar" role="toolbar" aria-label="Действия с папками и материалами">
              <AdminFolderToolbarIcon label="Создать папку" onClick={() => setFolderCreateOpen(true)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 19h8a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-5l-1.33-1.5H5A1 1 0 0 0 4 6.5V18a1 1 0 0 0 1 1h7" />
                  <path d="M12 11v6M9 14h6" />
                </svg>
              </AdminFolderToolbarIcon>
              <AdminFolderToolbarIcon
                label="Переименовать выбранную папку"
                disabled={selected == null}
                onClick={triggerRenameSelectedFolder}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                </svg>
              </AdminFolderToolbarIcon>
              <AdminFolderToolbarIcon
                className="admin-folder-toolbar-btn--danger"
                label="Удалить выбранную папку"
                disabled={selectedCategory == null}
                onClick={() => selectedCategory && deleteFolder(selectedCategory)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6h12zM10 11v6M14 11v6" />
                </svg>
              </AdminFolderToolbarIcon>
              <input
                ref={materialsImportFileRef}
                type="file"
                accept=".xml,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="admin-hidden-file-input"
                aria-hidden
                onChange={onMaterialsImportFile}
              />
              <AdminFolderToolbarIcon
                label="Импорт (.xml, .xlsx)"
                disabled={materialsImportBusy}
                onClick={() => materialsImportFileRef.current?.click()}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 3v12M8 11l4 4 4-4M5 21h14" />
                </svg>
              </AdminFolderToolbarIcon>
              <select
                className="admin-folder-toolbar-format"
                aria-label="Формат экспорта"
                value={materialsExportFormat}
                onChange={(e) => setMaterialsExportFormat(e.target.value as 'xlsx' | 'xml')}
                disabled={materialsImportBusy}
                title="Формат файла экспорта"
              >
                <option value="xlsx">Экспорт XLSX</option>
                <option value="xml">Экспорт XML</option>
              </select>
              <AdminFolderToolbarIcon
                label={
                  selected == null
                    ? `Экспорт всех материалов (${materialsExportFormat.toUpperCase()})`
                    : `Экспорт выбранной папки и вложенных (${materialsExportFormat.toUpperCase()})`
                }
                disabled={materialsImportBusy}
                onClick={onMaterialsExportClick}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 21V9M8 13l4-4 4 4M5 3h14" />
                </svg>
              </AdminFolderToolbarIcon>
            </div>
            {materialsImportMsg ? (
              <p className="admin-muted admin-import-hint" style={{ margin: '0 0 0.65rem' }}>
                {materialsImportMsg}
              </p>
            ) : null}
            <button
              type="button"
              className={
                selected == null ? 'folder-explorer-root folder-explorer-root--active' : 'folder-explorer-root'
              }
              onClick={() => setSelected(null)}
              draggable={false}
              onDragOver={rootFolderDragOver}
              onDrop={rootFolderDrop}
            >
              <span className="folder-explorer-icon" aria-hidden>
                🗂️
              </span>
              Все папки
            </button>
            <ul className="folder-explorer-tree-root admin-materials-tree-root" aria-label="Дерево папок">
              {tree.map((c) => (
                <TreeRow
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
                  treeDnD={materialsTreeDnD}
                />
              ))}
            </ul>
          </aside>
          <div className="admin-main-col">
            <main className="admin-main">
              <div
                className="admin-main-scroll"
                onDragOver={onMainMaterialsDragOver}
                onDrop={onMainMaterialsDrop}
              >
                <div className="admin-heading-row">
                  <h2 className="admin-h2">
                    {selected == null
                      ? 'Материалы: все папки'
                      : `Материалы в папке: ${findCategoryNode(tree, selected)?.name?.trim() || '—'}`}
                  </h2>
                </div>
                <button
                  type="button"
                  className="admin-primary"
                  disabled={selected == null}
                  title={
                    selected == null
                      ? 'Сначала выберите папку слева — у материала должна быть категория'
                      : undefined
                  }
                  onClick={() => {
                    setExtrasTarget(null)
                    setEditing('new')
                  }}
                >
                  + Материал
                </button>
                {editing ? (
                  <p className="admin-material-card-context" aria-live="polite">
                    {editing === 'new' ? 'Новый материал' : (editing as Material).name.trim() || '—'}
                  </p>
                ) : null}
                <div
                  className="mat-list-table"
                  aria-label={selected == null ? 'Список всех материалов' : 'Список материалов в папке и вложенных'}
                >
                  <div className="mat-list-item-inner mat-list-item-inner--legend" role="row">
                    <div className="mat-list-legend" role="presentation">
                      {MAT_LIST_COLUMNS.map((label) => (
                        <span key={label} role="columnheader">
                          {label}
                        </span>
                      ))}
                    </div>
                    <span className="mat-list-legend-gear-slot" aria-hidden />
                  </div>
                  <ul className="mat-list">
                    {materials.map((m) => {
                      const rowExtrasOpen = extrasTarget?.id === m.id
                      const rowCardOpen = editing && editing !== 'new' && (editing as Material).id === m.id
                      const rowActive = rowExtrasOpen || rowCardOpen
                      return (
                        <li key={m.id} className="mat-list-item">
                          <div className="mat-list-item-inner">
                            <div
                              role="button"
                              tabIndex={0}
                              className={rowActive ? 'mat-list-row mat-list-row--active' : 'mat-list-row'}
                              aria-current={rowActive ? 'true' : undefined}
                              aria-label={`Сопутствующие: ${m.name || 'материал'}`}
                              draggable
                              onDragStart={(e) => onMaterialRowDragStart(e, m)}
                              onClick={() => {
                                setExtrasTarget((cur) => (cur?.id === m.id ? null : m))
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  setExtrasTarget((cur) => (cur?.id === m.id ? null : m))
                                }
                              }}
                            >
                              <span className="mat-list-cell mat-list-cell-article">{dashIfEmpty(m.article)}</span>
                              <span className="mat-list-cell mat-list-cell-name">{m.name}</span>
                              <span className="mat-list-cell mat-list-cell-uom">
                                {m.uom?.short_name || m.uom?.name || '—'}
                              </span>
                              <span className="mat-list-cell mat-list-cell-price">{formatListBasePrice(m)}</span>
                            </div>
                            <button
                              type="button"
                              className="mat-list-gear-btn"
                              title="Открыть карточку материала"
                              aria-label={`Карточка: ${m.name || 'материал'}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                setExtrasTarget(null)
                                setEditing(m)
                              }}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <circle cx="12" cy="12" r="3" />
                                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                              </svg>
                            </button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </div>
            </main>
          </div>
          {editing &&
            (editing !== 'new' || selected != null) &&
            createPortal(
              <div
                className="admin-modal-backdrop"
                role="presentation"
                onClick={(e) => {
                  if (e.target === e.currentTarget) setEditing(null)
                }}
              >
                <div
                  className="admin-modal admin-modal--explorer admin-modal--material-card"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="material-card-dialog-title"
                  onClick={(e) => e.stopPropagation()}
                >
                  <section className="admin-panel admin-panel--in-material-modal">
                    <MaterialForm
                      key={editing === 'new' ? 'new' : (editing as Material).id}
                      uomList={uom}
                      mclassesList={mclasses}
                      onMaterialClassCreated={(c) => {
                        setMclasses((prev) => {
                          if (prev.some((x) => x.id === c.id)) return prev
                          return [...prev, c].sort((a, b) => a.name.localeCompare(b.name, 'ru'))
                        })
                      }}
                      onMaterialClassesDeleted={(ids) => {
                        const remove = new Set(ids.map((x) => Number(x)))
                        setMclasses((prev) => prev.filter((c) => !remove.has(c.id)))
                      }}
                      categoryId={editing === 'new' ? (selected as number) : (editing as Material).category}
                      material={editing === 'new' ? null : editing}
                      onClose={() => setEditing(null)}
                      onDeleted={(id) => {
                        setMaterials((prev) => prev.filter((m) => m.id !== id))
                        setEditing(null)
                        setExtrasTarget((et) => (et?.id === id ? null : et))
                      }}
                      onSaved={(m) => {
                        setMaterials((prev) => {
                          if (editing === 'new') return [...prev, m]
                          return prev.map((x) => (x.id === m.id ? m : x))
                        })
                        setEditing(m)
                      }}
                    />
                  </section>
                </div>
              </div>,
              document.body
            )}
        </div>
      ) : section === 'textures' ? (
        <AdminTexturesPanel />
      ) : section === 'calculator' ? (
        <div
          className="admin-body"
          id="admin-panel-calculator"
          role="tabpanel"
          aria-labelledby="admin-tab-calculator"
        >
          <div className="admin-orders-placeholder">
            <CalculatorPage variant="admin" />
          </div>
        </div>
      ) : section === 'orders' ? (
        <div className="admin-body" id="admin-panel-orders" role="tabpanel" aria-labelledby="admin-tab-orders">
          <div className="admin-orders-placeholder admin-orders-placeholder--filled">
            <AdminOrdersPanel />
          </div>
        </div>
      ) : (
        <div className="admin-body" id="admin-panel-users" role="tabpanel" aria-labelledby="admin-tab-users">
          <div className="admin-orders-placeholder admin-users-page">
            <div className="admin-heading-row">
              <h2 className="admin-h2">Пользователи</h2>
              <HintButton text="В колонке «Роль» — «Пользователь» или «Админ». «Удалить» убирает учётную запись (нельзя удалить себя или суперпользователя)." />
            </div>
            {adminUsersErr && <div className="admin-error admin-error--compact">{adminUsersErr}</div>}
            {adminUsersLoading ? (
              <p className="admin-muted">Загрузка списка пользователей…</p>
            ) : (
              <div className="admin-users-table-wrap">
                <table className="admin-users-table">
                  <thead>
                    <tr>
                      <th scope="col">Логин</th>
                      <th scope="col">Email</th>
                      <th scope="col">Роль</th>
                      <th scope="col" className="admin-users-actions-th">
                        Действия
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminUsers.map((u) => (
                      <tr key={u.id}>
                        <td>
                          {u.username}
                          {u.is_superuser ? (
                            <span className="admin-users-badge" title="Суперпользователь (сервер)">
                              супер
                            </span>
                          ) : null}
                        </td>
                        <td className="admin-users-email">{u.email || '—'}</td>
                        <td className="admin-users-role-cell">
                          {u.is_superuser ? (
                            <FtSelect
                              className="admin-users-role-ft"
                              value="super"
                              onChange={() => {}}
                              options={ADMIN_SUPERUSER_ROLE_OPTIONS}
                              disabled
                              aria-label={`Роль ${u.username}: суперпользователь`}
                            />
                          ) : (
                            <FtSelect
                              className="admin-users-role-ft"
                              value={u.is_staff ? 'admin' : 'user'}
                              onChange={(v) => setStaffFlag(u.id, v === 'admin')}
                              options={ADMIN_USER_ROLE_OPTIONS}
                              disabled={staffTogglePending === u.id}
                              aria-label={`Роль для ${u.username}`}
                            />
                          )}
                        </td>
                        <td className="admin-users-actions-cell">
                          {u.is_superuser || u.id === user.id ? (
                            <span className="admin-muted">—</span>
                          ) : (
                            <button
                              type="button"
                              className="admin-secondary admin-secondary--sm admin-danger"
                              onClick={() => setUserDeleteModal(u)}
                            >
                              Удалить
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
    {folderCreateOpen ? (
      <FolderCreateModal
        tree={tree}
        initialParentId={selected}
        onClose={() => setFolderCreateOpen(false)}
        onCreate={submitNewFolder}
      />
    ) : null}
    {extrasTarget &&
      section === 'materials' &&
      createPortal(
        <div
          className="admin-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="material-extras-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !extrasSaving) setExtrasTarget(null)
          }}
        >
          <div
            className="admin-modal admin-modal--explorer admin-modal--extras"
            role="document"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 id="material-extras-modal-title" className="admin-modal-title">
              Сопутствующие материалы
            </h4>
            <p className="admin-muted admin-extras-modal-sub">
              {extrasTarget.article?.trim() || '—'} · {extrasTarget.name.trim() || '—'}
            </p>
            <div className="admin-extras-modal-body">
              {extrasErr ? <div className="admin-error admin-error--compact">{extrasErr}</div> : null}
              <div className="admin-extras-panel" aria-label="Сопутствующие материалы и операции">
                <MaterialExtrasPanel
                  uomList={uom}
                  mainMaterialId={extrasTarget.id}
                  relatedItems={extrasRelated}
                  onRelatedChange={setExtrasRelated}
                  basePrice={extrasBasePrice}
                />
              </div>
            </div>
            <div className="admin-modal-actions">
              <button type="button" className="admin-primary" disabled={extrasSaving} onClick={saveExtras}>
                {extrasSaving ? 'Сохранение…' : 'Сохранить'}
              </button>
              <button
                type="button"
                className="admin-secondary"
                disabled={extrasSaving}
                onClick={() => setExtrasTarget(null)}
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    {folderDeleteModal &&
      createPortal(
        <div
          className="admin-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="folder-delete-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) cancelDeleteFolder()
          }}
        >
          <div
            className="admin-modal"
            role="document"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 id="folder-delete-title" className="admin-modal-title">
              Удалить папку?
            </h4>
            <p className="admin-modal-text">
              Папка «{folderDeleteModal.name}» будет удалена безвозвратно вместе со всем содержимым: все вложенные
              папки и все материалы в этой папке и в подпапках. Продолжить?
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
    {userDeleteModal &&
      createPortal(
        <div
          className="admin-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="user-delete-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) cancelDeleteUser()
          }}
        >
          <div className="admin-modal" role="document" onClick={(e) => e.stopPropagation()}>
            <h4 id="user-delete-title" className="admin-modal-title">
              Удалить пользователя?
            </h4>
            <p className="admin-modal-text">
              Учётная запись «{userDeleteModal.username}» будет удалена безвозвратно. Продолжить?
            </p>
            <div className="admin-modal-actions">
              <button type="button" className="admin-secondary" onClick={cancelDeleteUser}>
                Отмена
              </button>
              <button type="button" className="admin-primary admin-modal-confirm" onClick={confirmDeleteUser}>
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

function normalizeMaterialClassIds(raw: number[] | undefined | null): number[] {
  if (!raw?.length) return []
  return [...new Set(raw.map((x) => Number(x)))]
}

function MaterialForm({
  uomList,
  mclassesList,
  onMaterialClassCreated,
  onMaterialClassesDeleted,
  categoryId,
  material,
  onClose,
  onDeleted,
  onSaved,
}: {
  uomList: UnitOfMeasure[]
  mclassesList: MaterialClass[]
  onMaterialClassCreated: (c: MaterialClass) => void
  onMaterialClassesDeleted: (ids: number[]) => void
  categoryId: number
  material: Material | null
  onClose: () => void
  onDeleted: (id: number) => void
  onSaved: (m: Material) => void
}) {
  const [activeTab, setActiveTab] = useState<'general' | 'extra' | 'texture'>('general')
  const [materialDeleteOpen, setMaterialDeleteOpen] = useState(false)
  const [texturePickerOpen, setTexturePickerOpen] = useState(false)
  const [textureLibraryItemId, setTextureLibraryItemId] = useState<number | null>(
    material?.texture_library_item ?? null
  )
  const [textureLibraryItemName, setTextureLibraryItemName] = useState(
    material?.texture_library_item_name ?? ''
  )
  const [textureClearRequested, setTextureClearRequested] = useState(false)
  const [form, setForm] = useState({
    name: material?.name ?? '',
    article: material?.article ?? '',
    uom_id: (material as any)?.uom_id ?? (material as any)?.uom?.id ?? (uomList[0]?.id ?? 0),
    base_price: formatDecimalStringForInput(String(material?.base_price ?? '0'), DECIMAL_FRACTION_DIGITS),
    note: material?.note ?? '',
    rounding_mode: (material?.rounding_mode ?? 'none') as RoundingMode,
    rounding_multiple: material?.rounding_multiple ?? '',
    material_class_ids: normalizeMaterialClassIds(material?.material_class_ids),
    thickness: formatDecimalStringForInput(String(material?.thickness ?? '0'), DECIMAL_FRACTION_DIGITS),
    min_length: formatDecimalStringForInput(String((material as any)?.min_length ?? '0'), DECIMAL_FRACTION_DIGITS),
    max_length: formatDecimalStringForInput(String(material?.max_length ?? '0'), DECIMAL_FRACTION_DIGITS),
    min_width: formatDecimalStringForInput(String((material as any)?.min_width ?? '0'), DECIMAL_FRACTION_DIGITS),
    max_width: formatDecimalStringForInput(String(material?.max_width ?? '0'), DECIMAL_FRACTION_DIGITS),

    texture_mode: (material?.texture_mode ?? 'texture') as string,
    texture_color: material?.texture_color ?? '#ffffff',
    texture_image: material?.texture_image ?? null,
    tex_offset_x: formatDecimalStringForInput(String(material?.tex_offset_x ?? '0'), DECIMAL_FRACTION_DIGITS),
    tex_offset_y: formatDecimalStringForInput(String(material?.tex_offset_y ?? '0'), DECIMAL_FRACTION_DIGITS),
    tex_step_x: formatDecimalStringForInput(String(material?.tex_step_x ?? '100'), DECIMAL_FRACTION_DIGITS),
    tex_step_y: formatDecimalStringForInput(String(material?.tex_step_y ?? '100'), DECIMAL_FRACTION_DIGITS),
    tex_opacity: formatDecimalStringForInput(String(material?.tex_opacity ?? '1'), 3),
    tex_mirror: material?.tex_mirror ?? false,
    tex_specular_sharpness: formatDecimalStringForInput(String(material?.tex_specular_sharpness ?? '0.5'), 3),
    tex_specular_brightness: formatDecimalStringForInput(String(material?.tex_specular_brightness ?? '0.35'), 3),
    tex_rotation_deg: formatDecimalStringForInput(String(material?.tex_rotation_deg ?? '0'), 2),
  })
  const [saving, setSaving] = useState(false)
  const [localErr, setLocalErr] = useState<string | null>(null)
  const [newClassName, setNewClassName] = useState('')
  const [addingClass, setAddingClass] = useState(false)
  const [classSyncPending, setClassSyncPending] = useState(false)
  const [relatedItems, setRelatedItems] = useState<RelatedItemState[]>(() =>
    materialExtrasInitRelated(material)
  )
  const matClassInputRef = useRef<HTMLInputElement>(null)
  const matClassRowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!materialDeleteOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setMaterialDeleteOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [materialDeleteOpen])

  const syncMatClassBtnSize = useCallback(() => {
    const inp = matClassInputRef.current
    const row = matClassRowRef.current
    if (!inp || !row) return
    const h = Math.round(inp.getBoundingClientRect().height)
    if (h > 0) row.style.setProperty('--mat-class-btn-size', `${h}px`)
  }, [])

  useLayoutEffect(() => {
    syncMatClassBtnSize()
    const el = matClassInputRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      queueMicrotask(() => syncMatClassBtnSize())
    })
    ro.observe(el)
    window.addEventListener('resize', syncMatClassBtnSize)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', syncMatClassBtnSize)
    }
  }, [syncMatClassBtnSize, newClassName, addingClass, classSyncPending])

  const setField = (k: string, v: unknown) => {
    setForm((f) => ({ ...f, [k]: v }))
  }

  const toggleClass = (id: number) => {
    const pid = Number(id)
    setForm((f) => {
      const cur = f.material_class_ids
      const next = cur.includes(pid) ? cur.filter((x) => x !== pid) : [...cur, pid]
      return { ...f, material_class_ids: next }
    })
  }

  const addClassFromInput = () => {
    const name = newClassName.trim()
    if (!name) return
    const existing = mclassesList.find(
      (x) => x.name.toLowerCase() === name.toLowerCase()
    )
    if (existing) {
      const eid = Number(existing.id)
      setForm((f) => {
        if (f.material_class_ids.includes(eid)) return f
        return { ...f, material_class_ids: [...f.material_class_ids, eid] }
      })
      setNewClassName('')
      return
    }
    setAddingClass(true)
    setLocalErr(null)
    createMaterialClass({ name })
      .then((c) => {
        onMaterialClassCreated(c)
        const cid = Number(c.id)
        setForm((f) => {
          if (f.material_class_ids.includes(cid)) return f
          return { ...f, material_class_ids: [...f.material_class_ids, cid] }
        })
        setNewClassName('')
      })
      .catch((e) => setLocalErr(String(e)))
      .finally(() => setAddingClass(false))
  }

  /**
   * «−»: удалить из справочника **все отмеченные** классы (DELETE /api/material-classes/…);
   * связи M2M с материалами снимаются; при открытой сохранённой карточке — перезагрузка материала.
   * Если нет отмеченных — очистить поле ввода.
   */
  const removeClassSelectionOrClearInput = () => {
    if (form.material_class_ids.length > 0) {
      if (
        !window.confirm(
          'Удалить отмеченные классы из справочника? Они пропадут и у других материалов, где были выбраны.'
        )
      ) {
        return
      }
      const ids = [...form.material_class_ids]
      setClassSyncPending(true)
      setLocalErr(null)
      Promise.all(ids.map((id) => deleteMaterialClass(id)))
        .then(() => {
          onMaterialClassesDeleted(ids)
        })
        .then(() => (material ? fetchMaterial(material.id) : undefined))
        .then((m) => {
          if (m) {
            onSaved(m)
            setForm((f) => ({
              ...f,
              material_class_ids: normalizeMaterialClassIds(m.material_class_ids),
            }))
          } else {
            setForm((f) => ({ ...f, material_class_ids: [] }))
          }
        })
        .catch((e) => setLocalErr(String(e)))
        .finally(() => setClassSyncPending(false))
      return
    }
    setNewClassName('')
  }

  const canUseRemoveClassBtn =
    !classSyncPending &&
    !addingClass &&
    (form.material_class_ids.length > 0 || newClassName.trim().length > 0)

  const removeBtnTitle =
    form.material_class_ids.length > 0
      ? 'Удалить отмеченные классы из справочника'
      : 'Очистить поле ввода'

  const save = () => {
    if (!uomList.length) {
      setLocalErr('Сначала создайте единицы измерения в django-admin (/admin/django/).')
      return
    }
    setSaving(true)
    setLocalErr(null)
    const baseBody: Record<string, unknown> = {
      category: categoryId,
      name: form.name,
      article: form.article,
      uom_id: form.uom_id,
      base_price: commitDecimalForApi(form.base_price),
      base_currency: BASE_CURRENCY,
      note: form.note,
      rounding_mode: form.rounding_mode,
      rounding_multiple:
        form.rounding_mode === 'ceil_multiple' && form.rounding_multiple !== ''
          ? form.rounding_multiple
          : null,
      is_active: material?.is_active ?? true,
      material_class_ids: form.material_class_ids,
      thickness: commitDecimalForApi(form.thickness),
      min_length: commitDecimalForApi((form as any).min_length),
      max_length: commitDecimalForApi(form.max_length),
      min_width: commitDecimalForApi((form as any).min_width),
      max_width: commitDecimalForApi(form.max_width),
      texture_mode: form.texture_mode,
      texture_color: form.texture_color,
      tex_offset_x: commitDecimalForApi(form.tex_offset_x),
      tex_offset_y: commitDecimalForApi(form.tex_offset_y),
      tex_step_x: commitDecimalForApi(form.tex_step_x),
      tex_step_y: commitDecimalForApi(form.tex_step_y),
      tex_opacity: commitDecimalForApi(form.tex_opacity),
      tex_mirror: form.tex_mirror,
      tex_specular_sharpness: commitDecimalForApi(form.tex_specular_sharpness),
      tex_specular_brightness: commitDecimalForApi(form.tex_specular_brightness),
      tex_rotation_deg: commitDecimalForApi(form.tex_rotation_deg),
      related_items: relatedItems.map((r) => ({
        related_material_id: r.related_material_id,
        quantity: commitDecimalForApi(r.quantity),
        quantity_scale: r.quantity_scale,
      })),
      texture_library_item: textureLibraryItemId,
    }
    if (textureClearRequested) {
      baseBody.texture_image = null
      baseBody.texture_library_item = null
    }
    const body = baseBody
    const p =
      material == null
        ? createMaterial(body)
        : updateMaterial(material.id, body)
    p.then((m) => {
      onSaved(m)
      if (m.texture_image) setField('texture_image', m.texture_image)
      if (m.texture_image === null) setField('texture_image', null)
      if (m.texture_mode) setField('texture_mode', m.texture_mode)
      if (m.texture_color) setField('texture_color', m.texture_color)
      setTextureLibraryItemId(m.texture_library_item ?? null)
      setTextureLibraryItemName(m.texture_library_item_name ?? '')
      setTextureClearRequested(false)
      setRelatedItems(materialExtrasInitRelated(m))
    })
      .catch((e) => setLocalErr(String(e)))
      .finally(() => setSaving(false))
  }

  const cancelMaterialDelete = () => setMaterialDeleteOpen(false)

  const confirmRemoveMaterial = () => {
    if (material == null) return
    setMaterialDeleteOpen(false)
    setSaving(true)
    deleteMaterial(material.id)
      .then(() => onDeleted(material.id))
      .catch((e) => setLocalErr(String(e)))
      .finally(() => setSaving(false))
  }

  return (
    <>
    <div className="mat-form">
      <div className="mat-form-head">
        <div className="admin-heading-row mat-form-title-line">
          <h3 id="material-card-dialog-title" className="admin-h2">
            {material ? form.name.trim() || 'Без названия' : 'Новый материал'}
          </h3>
          <HintButton text="Поля — во вкладках выше. Сопутствующие материалы — по клику на строку в списке (отдельное окно). Текстуру картинки выбирайте из базы (раздел «Текстуры»)." />
        </div>
        <button type="button" className="admin-primary" onClick={onClose}>
          Закрыть
        </button>
      </div>
      {localErr && <div className="admin-error">{localErr}</div>}
      <div
        className="mat-form-tabs"
        role="tablist"
        aria-label="Разделы карточки материала"
      >
        <button
          type="button"
          className="mat-form-tab"
          id="mat-tab-general"
          role="tab"
          aria-selected={activeTab === 'general'}
          aria-controls="mat-panel-general"
          onClick={() => setActiveTab('general')}
        >
          Общие параметры
        </button>
        <button
          type="button"
          className="mat-form-tab"
          role="tab"
          id="mat-tab-extra"
          aria-selected={activeTab === 'extra'}
          aria-controls="mat-panel-extra"
          onClick={() => setActiveTab('extra')}
        >
          Доп. параметры
        </button>
        <button
          type="button"
          className="mat-form-tab"
          role="tab"
          id="mat-tab-texture"
          aria-selected={activeTab === 'texture'}
          aria-controls="mat-panel-texture"
          onClick={() => setActiveTab('texture')}
        >
          Параметры текстуры
        </button>
      </div>
      {activeTab === 'general' && (
        <div
          className="mat-form-tab-panel"
          id="mat-panel-general"
          role="tabpanel"
          aria-labelledby="mat-tab-general"
        >
      <label className="field">
        <span>Наименование *</span>
        <input
          className="admin-input"
          value={form.name}
          onChange={(e) => setField('name', e.target.value)}
        />
      </label>
      <label className="field">
        <div className="field-label-row">
          <span>Артикул</span>
          <HintButton text="Необязательно. Можно использовать как артикул поставщика или код сопоставления с учётом (1С и др.)." />
        </div>
        <input
          className="admin-input"
          value={form.article}
          onChange={(e) => setField('article', e.target.value)}
          placeholder="код в каталоге / для связи с 1С"
        />
      </label>
      <div className="field">
        <div className="field-label-row">
          <span>Классы материала</span>
          <HintButton text="«+» — новый класс в справочнике. «−» — удалить отмеченные галочками классы из справочника (и у других материалов). Без отметок — очищает поле ввода." />
        </div>
        <div className="field-row mat-class-input-row" ref={matClassRowRef}>
          <div className="field-half mat-class-input-wrap">
            <input
              ref={matClassInputRef}
              className="admin-input"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              placeholder="Новый класс (например, премиум)"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addClassFromInput()
                }
              }}
              disabled={addingClass || classSyncPending}
              aria-label="Новый класс материала"
            />
          </div>
          <div className="mat-class-ctrls" aria-label="Добавить или очистить класс">
            <button
              type="button"
              className="mat-class-ctrl mat-class-ctrl--add"
              onClick={addClassFromInput}
              disabled={addingClass || classSyncPending || !newClassName.trim()}
              title="Добавить класс"
              aria-label="Добавить класс"
              aria-busy={addingClass}
            >
              +
            </button>
            <button
              type="button"
              className="mat-class-ctrl mat-class-ctrl--remove"
              onClick={removeClassSelectionOrClearInput}
              disabled={!canUseRemoveClassBtn}
              title={removeBtnTitle}
              aria-label={removeBtnTitle}
              aria-busy={classSyncPending}
            >
              −
            </button>
          </div>
        </div>
        <div className="chips">
          {mclassesList.map((c) => (
            <label key={c.id} className="chip">
              <input
                type="checkbox"
                checked={form.material_class_ids.includes(Number(c.id))}
                onChange={() => toggleClass(c.id)}
              />
              {c.name}
            </label>
          ))}
        </div>
      </div>
      <label className="field">
        <span>Ед. измерения *</span>
        <FtSelect
          value={String(form.uom_id)}
          onChange={(v) => setField('uom_id', Number(v))}
          options={uomList.map((u) => ({
            value: String(u.id),
            label: `${u.short_name || u.name} (${u.name})`,
          }))}
        />
      </label>
      <div className="field">
        <div className="field-label-row">
          <span>Базовая валюта</span>
          <HintButton
            text={`${BASE_CURRENCY} (тенге) — фиксирована; смена базовой валюты не предусмотрена.`}
          />
        </div>
      </div>
      <label className="field">
        <span>Цена в базовой валюте (KZT) за ед. *</span>
        <input
          className="admin-input"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={form.base_price}
          onChange={(e) => setField('base_price', filterDecimalInput(e.target.value, DECIMAL_FRACTION_DIGITS))}
          onBlur={(e) => setField('base_price', normalizeDecimalForInput(e.currentTarget.value, DECIMAL_FRACTION_DIGITS))}
        />
      </label>
      <label className="field">
        <span>Примечание</span>
        <textarea
          className="admin-input"
          rows={3}
          value={form.note}
          onChange={(e) => setField('note', e.target.value)}
        />
      </label>
      <label className="field">
        <span>Округление количества</span>
        <FtSelect
          value={form.rounding_mode}
          onChange={(v) => setField('rounding_mode', v as RoundingMode)}
          options={ROUNDING.map((o) => ({ value: o.v, label: o.l }))}
        />
      </label>
      {form.rounding_mode === 'ceil_multiple' && (
        <label className="field">
          <span>Кратность (число) *</span>
          <input
            className="admin-input"
            value={form.rounding_multiple}
            onChange={(e) => setField('rounding_multiple', e.target.value)}
            placeholder="например 0.5"
          />
        </label>
      )}
      <div className="admin-row mat-form-actions">
        <button
          type="button"
          className="admin-primary"
          disabled={saving || classSyncPending}
          onClick={save}
        >
          {saving ? 'Сохранение…' : 'Сохранить'}
        </button>
        {material && (
          <button
            type="button"
            className="admin-secondary admin-danger"
            disabled={saving || classSyncPending}
            onClick={() => setMaterialDeleteOpen(true)}
          >
            Удалить
          </button>
        )}
      </div>
        </div>
      )}

      {activeTab === 'extra' && (
        <div
          className="mat-form-tab-panel"
          id="mat-panel-extra"
          role="tabpanel"
          aria-labelledby="mat-tab-extra"
        >
          <label className="field">
            <span>Толщина</span>
            <input
              className="admin-input"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={form.thickness}
              onChange={(e) =>
                setField(
                  'thickness',
                  filterDecimalInput(e.target.value, DECIMAL_FRACTION_DIGITS)
                )
              }
              onBlur={(e) =>
                setField('thickness', normalizeDecimalForInput(e.currentTarget.value, DECIMAL_FRACTION_DIGITS))
              }
              placeholder="например 0.8"
            />
          </label>

          <label className="field">
            <span>Макс. длина</span>
            <input
              className="admin-input"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={form.max_length}
              onChange={(e) =>
                setField(
                  'max_length',
                  filterDecimalInput(e.target.value, DECIMAL_FRACTION_DIGITS)
                )
              }
              onBlur={(e) =>
                setField('max_length', normalizeDecimalForInput(e.currentTarget.value, DECIMAL_FRACTION_DIGITS))
              }
              placeholder="например 3000"
            />
          </label>

          <label className="field">
            <span>Мин. длина</span>
            <input
              className="admin-input"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={(form as any).min_length}
              onChange={(e) =>
                setField(
                  'min_length' as any,
                  filterDecimalInput(e.target.value, DECIMAL_FRACTION_DIGITS) as any
                )
              }
              onBlur={(e) =>
                setField(
                  'min_length' as any,
                  normalizeDecimalForInput(e.currentTarget.value, DECIMAL_FRACTION_DIGITS) as any
                )
              }
              placeholder="например 200"
            />
          </label>

          <label className="field">
            <span>Макс. ширина</span>
            <input
              className="admin-input"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={form.max_width}
              onChange={(e) =>
                setField(
                  'max_width',
                  filterDecimalInput(e.target.value, DECIMAL_FRACTION_DIGITS)
                )
              }
              onBlur={(e) =>
                setField('max_width', normalizeDecimalForInput(e.currentTarget.value, DECIMAL_FRACTION_DIGITS))
              }
              placeholder="например 1200"
            />
          </label>

          <label className="field">
            <span>Мин. ширина</span>
            <input
              className="admin-input"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={(form as any).min_width}
              onChange={(e) =>
                setField(
                  'min_width' as any,
                  filterDecimalInput(e.target.value, DECIMAL_FRACTION_DIGITS) as any
                )
              }
              onBlur={(e) =>
                setField(
                  'min_width' as any,
                  normalizeDecimalForInput(e.currentTarget.value, DECIMAL_FRACTION_DIGITS) as any
                )
              }
              placeholder="например 100"
            />
          </label>

          <div className="admin-row mat-form-actions">
            <button
              type="button"
              className="admin-primary"
              disabled={saving || classSyncPending}
              onClick={save}
            >
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
            {material && (
              <button
                type="button"
                className="admin-secondary admin-danger"
                disabled={saving || classSyncPending}
                onClick={() => setMaterialDeleteOpen(true)}
              >
                Удалить
              </button>
            )}
          </div>
        </div>
      )}

      {activeTab === 'texture' && (
        <div
          className="mat-form-tab-panel"
          id="mat-panel-texture"
          role="tabpanel"
          aria-labelledby="mat-tab-texture"
        >
          <div className="tex-layout">
            <div>
              <div className="tex-sphere" aria-label="Превью сферы с текстурой">
                <div
                  className="tex-sphere-layer"
                  style={{
                    opacity: Number(form.tex_opacity || '1'),
                    backgroundImage:
                      form.texture_mode === 'color'
                        ? 'none'
                        : (() => {
                            const u = resolveTextureImageUrl(form.texture_image)
                            return u ? `url(${u})` : 'none'
                          })(),
                    backgroundColor: form.texture_mode === 'color' ? form.texture_color : 'transparent',
                    backgroundPosition: `${form.tex_offset_x}px ${form.tex_offset_y}px`,
                    backgroundSize: `${form.tex_step_x}px ${form.tex_step_y}px`,
                    transform: `${form.tex_mirror ? 'scaleX(-1) ' : ''}rotate(${form.tex_rotation_deg}deg)`,
                  }}
                />
                <div className="tex-sphere-shade" />
                <div
                  className="tex-sphere-specular"
                  style={{
                    opacity: Number(form.tex_specular_brightness || '0'),
                    filter: `blur(${Math.round((1 - Number(form.tex_specular_sharpness || '0')) * 12)}px)`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="tex-mode-row" role="group" aria-label="Цвет или текстура">
                <label>
                  <input
                    type="radio"
                    name="texture_mode"
                    checked={form.texture_mode === 'texture'}
                    onChange={() => setField('texture_mode', 'texture')}
                  />
                  Текстура
                </label>
                <label>
                  <input
                    type="radio"
                    name="texture_mode"
                    checked={form.texture_mode === 'color'}
                    onChange={() => {
                      setField('texture_mode', 'color')
                      setTextureLibraryItemId(null)
                      setTextureLibraryItemName('')
                      setTextureClearRequested(true)
                      setField('texture_image', null)
                    }}
                  />
                  Цвет
                </label>
              </div>

              {form.texture_mode === 'color' ? (
                <div className="field">
                  <span>Цвет</span>
                  <div className="tex-color-row">
                    <div className="tex-color-swatch" style={{ ['--tex-color' as any]: form.texture_color }} />
                    <input
                      className="admin-input"
                      type="color"
                      value={form.texture_color}
                      onChange={(e) => setField('texture_color', e.target.value)}
                      aria-label="Выбор цвета"
                      style={{ width: '3.25rem', padding: 0, height: '2.2rem' }}
                    />
                    <input
                      className="admin-input"
                      value={form.texture_color}
                      onChange={(e) => setField('texture_color', e.target.value)}
                      placeholder="#RRGGBB"
                    />
                  </div>
                </div>
              ) : (
                <div className="field tex-file-row">
                  <span>Текстура</span>
                  <div className="tex-library-row">
                    <button
                      type="button"
                      className="admin-secondary"
                      onClick={() => {
                        setField('texture_mode', 'texture')
                        setTexturePickerOpen(true)
                      }}
                    >
                      Выбрать из базы…
                    </button>
                    <span className="tex-library-label" title={textureLibraryItemName || undefined}>
                      {textureLibraryItemName ? `«${textureLibraryItemName}»` : 'Не выбрана'}
                    </span>
                  </div>
                  {(textureLibraryItemId != null || form.texture_image) && (
                    <button
                      type="button"
                      className="admin-secondary"
                      onClick={() => {
                        setTextureLibraryItemId(null)
                        setTextureLibraryItemName('')
                        setTextureClearRequested(true)
                        setField('texture_image', null)
                      }}
                    >
                      Убрать текстуру
                    </button>
                  )}
                </div>
              )}

              <div className="field">
                <span>Смещение X / Y</span>
                <div className="field-row">
                  <div className="field-half">
                    <input
                      className="admin-input"
                      value={form.tex_offset_x}
                      onChange={(e) => setField('tex_offset_x', filterDecimalInput(e.target.value, DECIMAL_FRACTION_DIGITS))}
                      onBlur={(e) =>
                        setField(
                          'tex_offset_x',
                          normalizeDecimalForInput(e.currentTarget.value, DECIMAL_FRACTION_DIGITS)
                        )
                      }
                      placeholder="X"
                    />
                  </div>
                  <div className="field-half">
                    <input
                      className="admin-input"
                      value={form.tex_offset_y}
                      onChange={(e) => setField('tex_offset_y', filterDecimalInput(e.target.value, DECIMAL_FRACTION_DIGITS))}
                      onBlur={(e) =>
                        setField(
                          'tex_offset_y',
                          normalizeDecimalForInput(e.currentTarget.value, DECIMAL_FRACTION_DIGITS)
                        )
                      }
                      placeholder="Y"
                    />
                  </div>
                </div>
              </div>

              <div className="field">
                <span>Шаг X / Y</span>
                <div className="field-row">
                  <div className="field-half">
                    <input
                      className="admin-input"
                      value={form.tex_step_x}
                      onChange={(e) => setField('tex_step_x', filterDecimalInput(e.target.value, DECIMAL_FRACTION_DIGITS))}
                      onBlur={(e) =>
                        setField(
                          'tex_step_x',
                          normalizeDecimalForInput(e.currentTarget.value, DECIMAL_FRACTION_DIGITS)
                        )
                      }
                      placeholder="X"
                    />
                  </div>
                  <div className="field-half">
                    <input
                      className="admin-input"
                      value={form.tex_step_y}
                      onChange={(e) => setField('tex_step_y', filterDecimalInput(e.target.value, DECIMAL_FRACTION_DIGITS))}
                      onBlur={(e) =>
                        setField(
                          'tex_step_y',
                          normalizeDecimalForInput(e.currentTarget.value, DECIMAL_FRACTION_DIGITS)
                        )
                      }
                      placeholder="Y"
                    />
                  </div>
                </div>
              </div>

              <label className="field inline">
                <input
                  type="checkbox"
                  checked={form.tex_mirror}
                  onChange={(e) => setField('tex_mirror', e.target.checked)}
                />
                <span>Зеркальность</span>
              </label>

              <div className="field">
                <span>Прозрачность</span>
                <div className="tex-range">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={Number(form.tex_opacity || '1')}
                    onChange={(e) => setField('tex_opacity', String(e.target.value))}
                  />
                  <div className="tex-range-val">{Number(form.tex_opacity || '1').toFixed(2)}</div>
                </div>
              </div>

              <div className="field">
                <span>Резкость блика</span>
                <div className="tex-range">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={Number(form.tex_specular_sharpness || '0')}
                    onChange={(e) => setField('tex_specular_sharpness', String(e.target.value))}
                  />
                  <div className="tex-range-val">{Number(form.tex_specular_sharpness || '0').toFixed(2)}</div>
                </div>
              </div>

              <div className="field">
                <span>Яркость блика</span>
                <div className="tex-range">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={Number(form.tex_specular_brightness || '0')}
                    onChange={(e) => setField('tex_specular_brightness', String(e.target.value))}
                  />
                  <div className="tex-range-val">{Number(form.tex_specular_brightness || '0').toFixed(2)}</div>
                </div>
              </div>

              <div className="field">
                <span>Угол поворота</span>
                <div className="tex-range">
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    step={1}
                    value={Number(form.tex_rotation_deg || '0')}
                    onChange={(e) => setField('tex_rotation_deg', String(e.target.value))}
                  />
                  <div className="tex-range-val">{Math.round(Number(form.tex_rotation_deg || '0'))}°</div>
                </div>
              </div>

              <div className="admin-row mat-form-actions">
                <button
                  type="button"
                  className="admin-primary"
                  disabled={saving || classSyncPending}
                  onClick={save}
                >
                  {saving ? 'Сохранение…' : 'Сохранить'}
                </button>
                {material && (
                  <button
                    type="button"
                    className="admin-secondary admin-danger"
                    disabled={saving || classSyncPending}
                    onClick={() => setMaterialDeleteOpen(true)}
                  >
                    Удалить
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    {materialDeleteOpen &&
      material &&
      createPortal(
        <div
          className="admin-modal-backdrop admin-modal-backdrop--stack-top"
          role="dialog"
          aria-modal="true"
          aria-labelledby="material-delete-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) cancelMaterialDelete()
          }}
        >
          <div
            className="admin-modal"
            role="document"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 id="material-delete-title" className="admin-modal-title">
              Удалить материал?
            </h4>
            <p className="admin-modal-text">
              Материал «{material.name}» будет удалён безвозвратно везде, где используется: в
              справочнике, в калькуляторе (цвета, наполнение и др.), в связанных записях. Продолжить?
            </p>
            <div className="admin-modal-actions">
              <button type="button" className="admin-secondary" onClick={cancelMaterialDelete}>
                Отмена
              </button>
              <button
                type="button"
                className="admin-primary admin-modal-confirm"
                onClick={confirmRemoveMaterial}
              >
                Удалить
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    {texturePickerOpen && (
      <TexturePickerModal
        onClose={() => setTexturePickerOpen(false)}
        onPick={(item) => {
          setTextureLibraryItemId(item.id)
          setTextureLibraryItemName(item.name)
          setField('texture_mode', 'texture')
          setTextureClearRequested(false)
          setField('texture_image', resolveTextureImageUrl(item.image))
          setTexturePickerOpen(false)
        }}
      />
    )}
    </>
  )
}

export default AdminApp
