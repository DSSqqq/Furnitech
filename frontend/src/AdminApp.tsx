import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  createCategory,
  createMaterial,
  deleteCategory,
  deleteMaterial,
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
import { AdminFolderToolbarIcon } from './AdminFolderToolbarIcon'
import { AdminOrdersPanel } from './AdminOrdersPanel'
import { AdminCalculationsPanel } from './AdminCalculationsPanel'
import { AdminMaterialClassesPanel } from './AdminMaterialClassesPanel'
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
import { MaterialClassPickModal } from './MaterialClassPickModal'
import type { Material, MaterialCategory, MaterialClass, RoundingMode, UnitOfMeasure } from './types'
import './AdminApp.css'

const MODAL_CLOSE_X_SVG = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

const ADMIN_REFS_HAMBURGER_SVG = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
)

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
        title={isDragSource ? 'Удерживайте и перетащите на другую папку или на «База материалов»' : c.path}
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
  const section: 'materials' | 'textures' | 'orders' | 'calculator' | 'classes' | 'calculations' | 'users' = (() => {
    const p = (loc.pathname || '/materials').toLowerCase()
    if (p.startsWith('/calculator')) return 'calculator'
    if (p.startsWith('/classes')) return 'classes'
    if (p.startsWith('/calculations')) return 'calculations'
    if (p.startsWith('/orders')) return 'orders'
    if (p.startsWith('/users')) return 'users'
    if (p.startsWith('/textures')) return 'textures'
    return 'materials'
  })()
  const [tree, setTree] = useState<MaterialCategory[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  /** Раскрытие списка папок под пунктом «База материалов» (виртуальный корень дерева). */
  const [materialsRootTreeExpanded, setMaterialsRootTreeExpanded] = useState(true)
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
  const materialsExportWrapRef = useRef<HTMLDivElement>(null)
  const materialsPanelRef = useRef<HTMLDivElement>(null)
  const materialAddBtnRef = useRef<HTMLButtonElement>(null)
  /** Откладывает одиночный клик по строке материала, чтобы двойной щелчок открыл карточку без переключения «Сопутствующие». */
  const materialListClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const folderDragIdRef = useRef<number | null>(null)
  const [materialsImportBusy, setMaterialsImportBusy] = useState(false)
  const [materialsImportMsg, setMaterialsImportMsg] = useState<string | null>(null)
  const [materialsExportMenuOpen, setMaterialsExportMenuOpen] = useState(false)
  const [draggingFolderId, setDraggingFolderId] = useState<number | null>(null)
  const [refsDropdownOpen, setRefsDropdownOpen] = useState(false)
  const refsDropdownRef = useRef<HTMLDivElement>(null)

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
    if (selected != null) setMaterialsRootTreeExpanded(true)
  }, [selected])

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

  useEffect(() => {
    return () => {
      const t = materialListClickTimerRef.current
      if (t != null) {
        clearTimeout(t)
        materialListClickTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!refsDropdownOpen) return
    const onDoc = (e: MouseEvent) => {
      const el = refsDropdownRef.current
      if (el && !el.contains(e.target as Node)) setRefsDropdownOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [refsDropdownOpen])

  useEffect(() => {
    if (!refsDropdownOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setRefsDropdownOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [refsDropdownOpen])

  useEffect(() => {
    setRefsDropdownOpen(false)
  }, [section])

  useLayoutEffect(() => {
    if (section !== 'materials') return
    const panel = materialsPanelRef.current
    const btn = materialAddBtnRef.current
    if (!panel || !btn) return
    const sync = () => {
      const w = Math.ceil(btn.getBoundingClientRect().width)
      if (w > 0) panel.style.setProperty('--admin-mat-add-btn-min-w', `${w}px`)
    }
    sync()
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(sync)
    })
    ro.observe(btn)
    window.addEventListener('resize', sync)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', sync)
    }
  }, [section, selected])

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

  const runMaterialsExport = useCallback((format: 'xlsx' | 'xml') => {
    setMaterialsExportMenuOpen(false)
    setErr(null)
    setMaterialsImportMsg(null)
    setMaterialsImportBusy(true)
    downloadMaterialsExport(selected, format)
      .catch((e) => setErr(String(e)))
      .finally(() => setMaterialsImportBusy(false))
  }, [selected])

  useEffect(() => {
    if (!materialsExportMenuOpen) return
    const onDown = (e: MouseEvent) => {
      const el = materialsExportWrapRef.current
      if (el && !el.contains(e.target as Node)) setMaterialsExportMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMaterialsExportMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [materialsExportMenuOpen])

  useEffect(() => {
    if (section !== 'materials') setMaterialsExportMenuOpen(false)
  }, [section])

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
        <nav className="admin-section-tabs" role="navigation" aria-label="Разделы админки">
          <div className="admin-section-tab-dropdown" ref={refsDropdownRef}>
            <button
              type="button"
              className={
                section === 'materials' ||
                section === 'textures' ||
                section === 'classes' ||
                section === 'calculations'
                  ? 'admin-section-tab admin-section-tab--active admin-section-tab--dropdown-trigger'
                  : 'admin-section-tab admin-section-tab--dropdown-trigger'
              }
              aria-expanded={refsDropdownOpen}
              aria-haspopup="true"
              aria-controls="admin-refs-dropdown-panel"
              id="admin-tab-refs-trigger"
              onClick={() => setRefsDropdownOpen((open) => !open)}
            >
              {ADMIN_REFS_HAMBURGER_SVG}
              Справочники
            </button>
            {refsDropdownOpen ? (
              <div
                id="admin-refs-dropdown-panel"
                className="admin-section-tab-dropdown-panel"
                role="group"
                aria-label="Справочники"
              >
                <button
                  type="button"
                  role="tab"
                  className={
                    section === 'materials'
                      ? 'admin-section-tab admin-section-tab--active admin-section-tab--dropdown-item'
                      : 'admin-section-tab admin-section-tab--dropdown-item'
                  }
                  aria-selected={section === 'materials'}
                  aria-controls="admin-panel-materials"
                  id="admin-tab-materials"
                  onClick={() => {
                    setRefsDropdownOpen(false)
                    nav('/materials')
                  }}
                >
                  Материалы
                </button>
                <button
                  type="button"
                  role="tab"
                  className={
                    section === 'textures'
                      ? 'admin-section-tab admin-section-tab--active admin-section-tab--dropdown-item'
                      : 'admin-section-tab admin-section-tab--dropdown-item'
                  }
                  aria-selected={section === 'textures'}
                  aria-controls="admin-panel-textures"
                  id="admin-tab-textures"
                  onClick={() => {
                    setRefsDropdownOpen(false)
                    nav('/textures')
                  }}
                >
                  Текстуры
                </button>
                <button
                  type="button"
                  role="tab"
                  className={
                    section === 'classes'
                      ? 'admin-section-tab admin-section-tab--active admin-section-tab--dropdown-item'
                      : 'admin-section-tab admin-section-tab--dropdown-item'
                  }
                  aria-selected={section === 'classes'}
                  aria-controls="admin-panel-classes"
                  id="admin-tab-classes"
                  onClick={() => {
                    setRefsDropdownOpen(false)
                    nav('/classes')
                  }}
                >
                  Классы
                </button>
                <button
                  type="button"
                  role="tab"
                  className={
                    section === 'calculations'
                      ? 'admin-section-tab admin-section-tab--active admin-section-tab--dropdown-item'
                      : 'admin-section-tab admin-section-tab--dropdown-item'
                  }
                  aria-selected={section === 'calculations'}
                  aria-controls="admin-panel-calculations"
                  id="admin-tab-calculations"
                  onClick={() => {
                    setRefsDropdownOpen(false)
                    nav('/calculations')
                  }}
                >
                  Формулы
                </button>
              </div>
            ) : null}
          </div>
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
        </nav>
      </header>
      {err && section === 'materials' && <div className="admin-error">{err}</div>}
      {loading && section === 'materials' && <p className="admin-muted admin-initial-state">Загрузка…</p>}
      {section === 'materials' ? (
        <div
          ref={materialsPanelRef}
          className="admin-body"
          id="admin-panel-materials"
          role="tabpanel"
          aria-labelledby="admin-tab-materials"
        >
          <aside className="admin-aside">
            <div className="admin-heading-row">
              <h2 className="admin-h2">Папки материалов</h2>
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
              <div className="admin-folder-toolbar-export-wrap" ref={materialsExportWrapRef}>
                <AdminFolderToolbarIcon
                  label={
                    selected == null
                      ? 'Экспорт всех материалов — нажмите и выберите XLSX или XML'
                      : 'Экспорт выбранной папки и вложенных — нажмите и выберите XLSX или XML'
                  }
                  disabled={materialsImportBusy}
                  ariaExpanded={materialsExportMenuOpen}
                  ariaHasPopup="menu"
                  onClick={() => setMaterialsExportMenuOpen((o) => !o)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M12 21V9M8 13l4-4 4 4M5 3h14" />
                  </svg>
                </AdminFolderToolbarIcon>
                {materialsExportMenuOpen ? (
                  <div className="admin-folder-toolbar-export-menu" role="menu" aria-label="Формат экспорта">
                    <button
                      type="button"
                      className="admin-folder-toolbar-export-menu-item"
                      role="menuitem"
                      disabled={materialsImportBusy}
                      onClick={() => runMaterialsExport('xlsx')}
                    >
                      XLSX
                    </button>
                    <button
                      type="button"
                      className="admin-folder-toolbar-export-menu-item"
                      role="menuitem"
                      disabled={materialsImportBusy}
                      onClick={() => runMaterialsExport('xml')}
                    >
                      XML
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
            {materialsImportMsg ? (
              <p className="admin-muted admin-import-hint" style={{ margin: '0 0 0.65rem' }}>
                {materialsImportMsg}
              </p>
            ) : null}
            <ul className="folder-explorer-tree-root admin-materials-tree-root" aria-label="Дерево папок">
              <li className="folder-explorer-tree-item folder-explorer-tree-item--materials-root">
                <div
                  className={
                    (selected == null
                      ? 'folder-explorer-tree-line folder-explorer-tree-line--active'
                      : 'folder-explorer-tree-line') +
                    (materialsTreeDnD.draggingFolderId != null &&
                    !isAllowedFolderTarget(null, materialsTreeDnD.draggingFolderId)
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
                    draggable={false}
                    onClick={() => setSelected(null)}
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
                ) : null}
              </li>
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
                      ? 'Материалы: база материалов'
                      : `Материалы в папке: ${findCategoryNode(tree, selected)?.name?.trim() || '—'}`}
                  </h2>
                </div>
                <button
                  ref={materialAddBtnRef}
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
                              aria-label={`${m.name || 'материал'}. Щелчок — сопутствующие. Двойной щелчок или Alt+Enter — карточка.`}
                              title="Щелчок — сопутствующие. Двойной щелчок — карточка."
                              draggable
                              onDragStart={(e) => onMaterialRowDragStart(e, m)}
                              onClick={() => {
                                if (materialListClickTimerRef.current != null) clearTimeout(materialListClickTimerRef.current)
                                materialListClickTimerRef.current = setTimeout(() => {
                                  materialListClickTimerRef.current = null
                                  setExtrasTarget((cur) => (cur?.id === m.id ? null : m))
                                }, 280)
                              }}
                              onDoubleClick={(e) => {
                                e.preventDefault()
                                if (materialListClickTimerRef.current != null) {
                                  clearTimeout(materialListClickTimerRef.current)
                                  materialListClickTimerRef.current = null
                                }
                                setExtrasTarget(null)
                                setEditing(m)
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && e.altKey) {
                                  e.preventDefault()
                                  if (materialListClickTimerRef.current != null) {
                                    clearTimeout(materialListClickTimerRef.current)
                                    materialListClickTimerRef.current = null
                                  }
                                  setExtrasTarget(null)
                                  setEditing(m)
                                  return
                                }
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
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </div>
              {extrasTarget ? (
                <div
                  className="admin-extras-dock"
                  role="region"
                  aria-label="Сопутствующие материалы: редактирование и сохранение"
                >
                  {extrasErr ? <div className="admin-error admin-error--compact">{extrasErr}</div> : null}
                  <div className="admin-extras-panel" aria-label="Сопутствующие материалы и операции">
                    <MaterialExtrasPanel
                      categoryTree={tree}
                      uomList={uom}
                      mainMaterialId={extrasTarget.id}
                      relatedItems={extrasRelated}
                      onRelatedChange={setExtrasRelated}
                      basePrice={extrasBasePrice}
                    />
                  </div>
                  <div className="admin-extras-dock-actions">
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
              ) : null}
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
                <section
                  className="admin-panel admin-panel--in-material-modal admin-calculations-modal-surface admin-modal--material-card admin-material-card-dialog"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="material-card-dialog-title"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MaterialForm
                    key={editing === 'new' ? 'new' : (editing as Material).id}
                    uomList={uom}
                    mclassesList={mclasses}
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
      ) : section === 'classes' ? (
        <AdminMaterialClassesPanel />
      ) : section === 'calculations' ? (
        <AdminCalculationsPanel />
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
                        <td data-label="Логин">
                          {u.username}
                          {u.is_superuser ? (
                            <span className="admin-users-badge" title="Суперпользователь (сервер)">
                              супер
                            </span>
                          ) : null}
                        </td>
                        <td className="admin-users-email" data-label="Email">{u.email || '—'}</td>
                        <td className="admin-users-role-cell" data-label="Роль">
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
                        <td className="admin-users-actions-cell" data-label="Действия">
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
  const xs = [...new Set(raw.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))]
  return xs.slice(0, 1)
}

function dashMaterialClassCode(code: string | undefined | null): string {
  const t = (code ?? '').trim()
  return t ? t : '—'
}

/** Заголовки мини-таблицы класса в карточке материала (как в «Классы»). */
const MATERIAL_CLASS_FIELD_COLUMNS = ['Код', 'Наименование класса'] as const

function MaterialForm({
  uomList,
  mclassesList,
  categoryId,
  material,
  onClose,
  onDeleted,
  onSaved,
}: {
  uomList: UnitOfMeasure[]
  mclassesList: MaterialClass[]
  categoryId: number
  material: Material | null
  onClose: () => void
  onDeleted: (id: number) => void
  onSaved: (m: Material) => void
}) {
  const materialUomSelectId = useId().replace(/:/g, '')
  const [activeTab, setActiveTab] = useState<'general' | 'texture'>('general')
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
  const [classPickOpen, setClassPickOpen] = useState(false)
  const [relatedItems, setRelatedItems] = useState<RelatedItemState[]>(() =>
    materialExtrasInitRelated(material)
  )
  const matClassInputRef = useRef<HTMLDivElement>(null)
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
  }, [syncMatClassBtnSize, form.material_class_ids])

  const setField = (k: string, v: unknown) => {
    setForm((f) => ({ ...f, [k]: v }))
  }

  const roundingStepFractionDigits = 8
  const roundingEnabled = form.rounding_mode !== 'none'

  /** При включённом округлении: пусто → до целого (1); иначе кратность. */
  const applyRoundingMultipleFromString = (raw: string) => {
    const t = raw.trim()
    if (t === '') {
      setField('rounding_mode', 'ceil_unit')
      setField('rounding_multiple', '')
      return
    }
    const norm = normalizeDecimalForInput(t.replace(',', '.'), roundingStepFractionDigits)
    const n = Number(norm.replace(',', '.'))
    if (!Number.isFinite(n) || n <= 0) {
      setField('rounding_mode', 'ceil_unit')
      setField('rounding_multiple', '')
      return
    }
    if (Math.abs(n - 1) < 1e-12) {
      setField('rounding_mode', 'ceil_unit')
      setField('rounding_multiple', '')
      return
    }
    setField('rounding_mode', 'ceil_multiple')
    setField('rounding_multiple', norm)
  }

  const roundingStepInputValue =
    !roundingEnabled
      ? ''
      : form.rounding_mode === 'ceil_unit'
        ? formatDecimalStringForInput('1', roundingStepFractionDigits)
        : String(form.rounding_multiple ?? '')

  const toggleRoundingEnabled = (enabled: boolean) => {
    if (!enabled) {
      setField('rounding_mode', 'none')
      return
    }
    applyRoundingMultipleFromString(String(form.rounding_multiple ?? ''))
  }

  const selectedMaterialClassId = form.material_class_ids[0] ?? null
  const selectedMaterialClass =
    selectedMaterialClassId != null
      ? mclassesList.find((x) => Number(x.id) === Number(selectedMaterialClassId))
      : null

  const previewCode =
    selectedMaterialClass != null
      ? dashMaterialClassCode(selectedMaterialClass.code)
      : selectedMaterialClassId != null
        ? '—'
        : '—'
  const previewName =
    selectedMaterialClass != null
      ? selectedMaterialClass.name
      : selectedMaterialClassId != null
        ? `#${selectedMaterialClassId}`
        : 'Нажмите +'
  const previewRowEmpty = selectedMaterialClassId == null
  const clearMaterialClassSelection = () => {
    setForm((f) => ({ ...f, material_class_ids: [] }))
  }

  const canUseRemoveClassBtn = form.material_class_ids.length > 0

  const removeBtnTitle = 'Снять класс с материала'

  const save = () => {
    if (!uomList.length) {
      setLocalErr('Сначала создайте единицы измерения в django-admin (/admin/django/).')
      return
    }
    setSaving(true)
    setLocalErr(null)

    let rounding_mode_out: RoundingMode = form.rounding_mode
    let rounding_multiple_out: string | null = null
    if (rounding_mode_out === 'ceil_multiple') {
      const m = String(form.rounding_multiple ?? '').trim()
      if (!m) {
        rounding_mode_out = 'ceil_unit'
        rounding_multiple_out = null
      } else {
        rounding_multiple_out = m
      }
    }

    const baseBody: Record<string, unknown> = {
      category: categoryId,
      name: form.name,
      article: form.article,
      uom_id: form.uom_id,
      base_price: commitDecimalForApi(form.base_price),
      base_currency: BASE_CURRENCY,
      note: form.note,
      rounding_mode: rounding_mode_out,
      rounding_multiple: rounding_multiple_out,
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
          <HintButton text="Общие параметры и габариты — на первой вкладке; текстура и превью — «Параметры текстуры». Сопутствующие материалы — по клику на строку в списке (панель внизу)." />
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
            <span>Артикул</span>
            <input
              className="admin-input"
              value={form.article}
              onChange={(e) => setField('article', e.target.value)}
            />
          </label>

          <div className="mat-form-field-span-2 field">
            <span>Класс материала</span>
            <div className="mat-class-input-row" ref={matClassRowRef}>
              <div className="mat-class-input-wrap">
                <div
                  className="mat-list-table mat-class-pick-preview"
                  aria-label="Класс материала: код и наименование"
                >
                  <div className="mat-list-item-inner mat-list-item-inner--legend" role="row">
                    <div className="mat-list-legend" role="presentation">
                      {MATERIAL_CLASS_FIELD_COLUMNS.map((label) => (
                        <span key={label} role="columnheader">
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="mat-class-preview-ctrl-row">
                    <div
                      ref={matClassInputRef}
                      className={
                        previewRowEmpty
                          ? 'mat-list-row mat-class-pick-preview-row mat-class-pick-preview-row--empty'
                          : 'mat-list-row mat-class-pick-preview-row'
                      }
                      role="status"
                      aria-label={
                        previewRowEmpty
                          ? 'Класс не выбран. Нажмите плюс для выбора из справочника.'
                          : `Выбранный класс: ${previewCode} ${previewName}`
                      }
                    >
                      <span className="mat-list-cell mat-list-cell-article">{previewCode}</span>
                      <span className="mat-list-cell mat-list-cell-name">{previewName}</span>
                    </div>
                    <div className="mat-class-ctrls" aria-label="Выбор из справочника или снятие класса">
                      <button
                        type="button"
                        className="mat-class-ctrl mat-class-ctrl--add"
                        onClick={() => setClassPickOpen(true)}
                        title="Выбрать класс из справочника"
                        aria-label="Выбрать класс из справочника"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        className="mat-class-ctrl mat-class-ctrl--remove"
                        onClick={clearMaterialClassSelection}
                        disabled={!canUseRemoveClassBtn}
                        title={removeBtnTitle}
                        aria-label={removeBtnTitle}
                      >
                        −
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mat-form-field-span-2 mat-form-uom-texture-row">
            <label className="mat-form-uom-label-cell" htmlFor={materialUomSelectId}>
              <span>Ед. измерения *</span>
            </label>
            <div className="mat-form-uom-select-cell">
              <FtSelect
                id={materialUomSelectId}
                compact
                value={String(form.uom_id)}
                onChange={(v) => setField('uom_id', Number(v))}
                options={uomList.map((u) => ({
                  value: String(u.id),
                  label: `${u.short_name || u.name} (${u.name})`,
                }))}
              />
            </div>
            <div className="mat-form-texture-cell">
              <div className="mat-form-texture-inline-one-line">
                <span className="mat-form-texture-title">Текстура</span>
                <span className="admin-muted mat-form-texture-status">
                  {form.texture_mode === 'color'
                    ? `Цвет ${form.texture_color}`
                    : textureLibraryItemName
                      ? `«${textureLibraryItemName}»`
                      : form.texture_image
                        ? 'Изображение задано'
                        : 'Не выбрана'}
                </span>
              </div>
            </div>
          </div>

          <div className="mat-form-field-span-2 mat-form-price-round-row">
            <label className="field mat-form-price-col">
              <div className="field-label-row">
                <span>Цена за ед., тенге *</span>
                <HintButton
                  text={`${BASE_CURRENCY} (тенге) — фиксирована; смена базовой валюты не предусмотрена.`}
                />
              </div>
              <input
                className="admin-input"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={form.base_price}
                onChange={(e) => setField('base_price', filterDecimalInput(e.target.value, DECIMAL_FRACTION_DIGITS))}
                onBlur={(e) =>
                  setField('base_price', normalizeDecimalForInput(e.currentTarget.value, DECIMAL_FRACTION_DIGITS))
                }
              />
            </label>
            <div className="field mat-form-rounding-col">
              <div className="mat-form-rounding-inline">
                <label className="mat-form-rounding-check-wrap">
                  <input
                    type="checkbox"
                    checked={roundingEnabled}
                    onChange={(e) => toggleRoundingEnabled(e.target.checked)}
                  />
                  <span>Округление в большую сторону до кратного числа</span>
                </label>
                <input
                  className="admin-input mat-form-rounding-mult-input"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  disabled={!roundingEnabled}
                  aria-label="Кратность округления"
                  value={roundingStepInputValue}
                  onChange={(e) => {
                    if (!roundingEnabled) return
                    const v = e.target.value
                    if (v.trim() === '') {
                      setField('rounding_mode', 'ceil_multiple')
                      setField('rounding_multiple', '')
                      return
                    }
                    setField('rounding_mode', 'ceil_multiple')
                    setField('rounding_multiple', filterDecimalInput(v, roundingStepFractionDigits))
                  }}
                  onBlur={(e) => {
                    if (!roundingEnabled) return
                    applyRoundingMultipleFromString(e.target.value)
                  }}
                />
              </div>
            </div>
          </div>

          <label className="field">
            <span>Макс. длина</span>
            <input
              className="admin-input"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={form.max_length}
              onChange={(e) =>
                setField('max_length', filterDecimalInput(e.target.value, DECIMAL_FRACTION_DIGITS))
              }
              onBlur={(e) =>
                setField('max_length', normalizeDecimalForInput(e.currentTarget.value, DECIMAL_FRACTION_DIGITS))
              }
              placeholder="например 3000"
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
                setField('max_width', filterDecimalInput(e.target.value, DECIMAL_FRACTION_DIGITS))
              }
              onBlur={(e) =>
                setField('max_width', normalizeDecimalForInput(e.currentTarget.value, DECIMAL_FRACTION_DIGITS))
              }
              placeholder="например 1200"
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

          <label className="field mat-form-field-span-2">
            <span>Примечание</span>
            <textarea
              className="admin-input"
              rows={3}
              value={form.note}
              onChange={(e) => setField('note', e.target.value)}
            />
          </label>

          <div className="admin-row mat-form-actions">
            {material && (
              <button
                type="button"
                className="admin-secondary admin-danger"
                disabled={saving}
                onClick={() => setMaterialDeleteOpen(true)}
              >
                Удалить
              </button>
            )}
            <button
              type="button"
              className="admin-primary"
              disabled={saving}
              onClick={save}
            >
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
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

              <div className="admin-row mat-form-actions">
                {material && (
                  <button
                    type="button"
                    className="admin-secondary admin-danger"
                    disabled={saving}
                    onClick={() => setMaterialDeleteOpen(true)}
                  >
                    Удалить
                  </button>
                )}
                <button
                  type="button"
                  className="admin-primary"
                  disabled={saving}
                  onClick={save}
                >
                  {saving ? 'Сохранение…' : 'Сохранить'}
                </button>
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
    {classPickOpen ? (
      <MaterialClassPickModal
        title="Класс материала"
        closeOnPick={false}
        selectedClassIds={form.material_class_ids}
        onClose={() => setClassPickOpen(false)}
        onPick={(c) => {
          const id = Number(c.id)
          setForm((f) => {
            const cur = f.material_class_ids[0]
            if (cur === id) return { ...f, material_class_ids: [] }
            return { ...f, material_class_ids: [id] }
          })
        }}
      />
    ) : null}
    </>
  )
}

export default AdminApp
