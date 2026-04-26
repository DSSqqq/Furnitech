import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  createCategory,
  createMaterial,
  createMaterialClass,
  deleteCategory,
  deleteMaterial,
  deleteMaterialClass,
  fetchMaterial,
  fetchCategoryTree,
  fetchMaterialClasses,
  fetchMaterials,
  fetchUom,
  updateCategory,
  updateMaterial,
} from './api'
import type { Me } from './auth'
import { ALTERNATIVE_CURRENCIES, BASE_CURRENCY } from './currencies'
import {
  capDecimalString,
  commitDecimalForApi,
  DECIMAL_FRACTION_DIGITS,
  filterDecimalInput,
  normalizeDecimalOnBlur,
} from './floatInput'
import { HintButton } from './HintButton'
import {
  materialExtrasInitOps,
  materialExtrasInitRelated,
  MaterialExtrasPanel,
} from './MaterialExtrasPanel'
import { CalculatorPage } from './CalculatorPage'
import type { OpLineState, RelatedItemState } from './MaterialExtrasPanel'
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

function mapFromAltPriceRows(
  rows: { currency: string; price: string }[] | undefined
): Record<string, string> {
  const m: Record<string, string> = {}
  for (const row of rows ?? []) {
    m[row.currency] = capDecimalString(String(row.price), DECIMAL_FRACTION_DIGITS)
  }
  return m
}

function buildAltPricesPayload(altByCurrency: Record<string, string>) {
  return Object.entries(altByCurrency)
    .map(([currency, p]) => ({ currency, price: commitDecimalForApi(p) }))
    .filter((x) => x.price !== '0')
}

type AdminProps = {
  user: Me
  onLogout: () => void
}

function TreeRow({
  c,
  depth,
  selectedId,
  expandedIds,
  onToggleExpanded,
  onSelect,
  onRename,
  onDelete,
}: {
  c: MaterialCategory
  depth: number
  selectedId: number | null
  expandedIds: Set<number>
  onToggleExpanded: (id: number) => void
  onSelect: (id: number) => void
  onRename: (id: number, name: string) => Promise<void>
  onDelete: (c: MaterialCategory) => void
}) {
  const isSel = c.id === selectedId
  const hasKids = (c.children?.length ?? 0) > 0
  const isExpanded = hasKids ? expandedIds.has(c.id) : false
  const [editing, setEditing] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [draft, setDraft] = useState(c.name)
  const inputRef = useRef<HTMLInputElement>(null)
  const menuWrapRef = useRef<HTMLDivElement>(null)

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
    if (!menuOpen) return
    const onDoc = (e: MouseEvent) => {
      if (menuWrapRef.current && !menuWrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

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
        {editing ? (
          <input
            ref={inputRef}
            className="admin-input tree-rename-input"
            value={draft}
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
            className={isSel ? 'tree-link tree-link-active' : 'tree-link'}
            onClick={() => onSelect(c.id)}
            title={c.path}
          >
            {c.name}
          </button>
        )}
        {!editing && (
          <div className="tree-line-actions" ref={menuWrapRef}>
            <button
              type="button"
              className="tree-gear-btn"
              title="Действия с папкой"
              aria-label="Действия с папкой: переименовать или удалить"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={(e) => {
                e.stopPropagation()
                setMenuOpen((o) => !o)
              }}
            >
              <span className="tree-gear-ico" aria-hidden>
                ⚙
              </span>
            </button>
            {menuOpen && (
              <ul className="tree-gear-menu" role="menu">
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className="tree-gear-menu-item"
                    onClick={(e) => {
                      e.stopPropagation()
                      setMenuOpen(false)
                      setEditing(true)
                      setDraft(c.name)
                    }}
                  >
                    Переименовать
                  </button>
                </li>
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className="tree-gear-menu-item tree-gear-menu-item--danger"
                    onClick={(e) => {
                      e.stopPropagation()
                      setMenuOpen(false)
                      onDelete(c)
                    }}
                  >
                    Удалить…
                  </button>
                </li>
              </ul>
            )}
          </div>
        )}
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
              onRename={onRename}
              onDelete={onDelete}
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
  'Коэф',
] as const

function dashIfEmpty(s: string | undefined | null) {
  const t = (s ?? '').trim()
  return t ? t : '—'
}

function formatListBasePrice(m: Material) {
  const p = capDecimalString(String(m.base_price), DECIMAL_FRACTION_DIGITS)
  return `${p} ${m.base_currency || BASE_CURRENCY}`
}

/** Коэффициент в карточке пока нет — колонка под будущее поле. */
function materialListCoeffPlaceholder() {
  return '—'
}

export function AdminApp({ user, onLogout }: AdminProps) {
  const nav = useNavigate()
  const loc = useLocation()
  const section: 'materials' | 'orders' | 'calculator' = (() => {
    const p = (loc.pathname || '/materials').toLowerCase()
    if (p.startsWith('/calculator')) return 'calculator'
    if (p.startsWith('/orders')) return 'orders'
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
  const [matExtraHost, setMatExtraHost] = useState<HTMLDivElement | null>(null)
  const [newFolderName, setNewFolderName] = useState('')
  const [folderDeleteModal, setFolderDeleteModal] = useState<MaterialCategory | null>(null)

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
      setUom(u.results)
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
      setMaterials([])
      return
    }
    fetchMaterials(selected)
      .then((r) => setMaterials(r.results))
      .catch((e) => setErr(String(e)))
  }, [selected])

  const addFolder = (parent: number | null) => {
    const name = newFolderName.trim() || (parent == null ? 'Новая папка' : 'Вложенная папка')
    createCategory({ parent, name, sort_order: 0 })
      .then(() => {
        setNewFolderName('')
        return reloadTree()
      })
      .catch((e) => setErr(String(e)))
  }

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
    if (cat.children && cat.children.length > 0) {
      setErr('Сначала удалите вложенные папки.')
      return
    }
    setFolderDeleteModal(cat)
  }, [])

  const confirmDeleteFolder = useCallback(() => {
    const cat = folderDeleteModal
    if (!cat) return
    setFolderDeleteModal(null)
    setErr(null)
    deleteCategory(cat.id)
      .then(() => {
        if (selected === cat.id) {
          setSelected(null)
          setEditing(null)
        }
        return reloadTree()
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

  return (
    <>
    <div className="admin">
      <header className="admin-header">
        <div className="admin-header-row">
          <div>
            <div className="admin-brand">Фурнитех</div>
            <div className="admin-tabs" role="tablist" aria-label="Разделы админки">
              <button
                type="button"
                role="tab"
                className={section === 'materials' ? 'admin-tab admin-tab--active' : 'admin-tab'}
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
                className={section === 'calculator' ? 'admin-tab admin-tab--active' : 'admin-tab'}
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
                className={section === 'orders' ? 'admin-tab admin-tab--active' : 'admin-tab'}
                aria-selected={section === 'orders'}
                aria-controls="admin-panel-orders"
                id="admin-tab-orders"
                onClick={() => nav('/orders')}
              >
                Заказы
              </button>
            </div>
          </div>
          <div className="admin-user">
            <span className="admin-user-email" title={user.username}>
              {user.email || user.username}
            </span>
            <button type="button" className="admin-logout" onClick={onLogout}>
              Выйти
            </button>
          </div>
        </div>
      </header>
      {err && <div className="admin-error">{err}</div>}
      {loading && <p className="admin-muted admin-initial-state">Загрузка…</p>}
      {section === 'materials' ? (
        <div className="admin-body" id="admin-panel-materials" role="tabpanel" aria-labelledby="admin-tab-materials">
          <aside className="admin-aside">
            <div className="admin-heading-row">
              <h2 className="admin-h2">Папки материалов</h2>
              <HintButton text="Клик по названию — выбрать папку. Шестерёнка — переименовать или удалить (удаление с подтверждением; папка без вложенных и без материалов). Наведите на строку, чтобы появилась кнопка." />
            </div>
            <ul className="tree-root">
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
                  onDelete={deleteFolder}
                />
              ))}
            </ul>
            <div className="admin-stack">
              <input
                className="admin-input"
                placeholder="Название папки"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
              />
              <div className="admin-row">
                <button type="button" onClick={() => addFolder(null)}>
                  + В корень
                </button>
                <button type="button" disabled={selected == null} onClick={() => addFolder(selected!)}>
                  + В текущую
                </button>
              </div>
            </div>
          </aside>
          <main className="admin-main">
            {selected == null ? (
              <p className="admin-muted admin-main-empty">
                Выберите папку слева.{' '}
                <HintButton text="Кликните по папке в левой колонке — здесь появится список материалов." />
              </p>
            ) : (
              <>
                <div className="admin-main-scroll">
                  <div className="admin-heading-row">
                    <h2 className="admin-h2">Материалы в папке</h2>
                    <HintButton text="Создавайте и редактируйте материалы выбранной папки. Сохраняйте карточку в панели справа." />
                  </div>
                  <button
                    type="button"
                    className="admin-primary"
                    onClick={() => setEditing('new')}
                  >
                    + Материал
                  </button>
                  <div className="mat-list-table" aria-label="Список материалов в папке">
                    <div className="mat-list-legend" role="row">
                      {MAT_LIST_COLUMNS.map((label) => (
                        <span key={label} role="columnheader">
                          {label}
                        </span>
                      ))}
                    </div>
                    <ul className="mat-list">
                      {materials.map((m) => (
                        <li key={m.id} className="mat-list-item">
                          <button
                            type="button"
                            className="mat-list-row"
                            onClick={() => setEditing(m)}
                            title="Открыть карточку материала"
                          >
                            <span className="mat-list-cell mat-list-cell-article">
                              {dashIfEmpty(m.article)}
                            </span>
                            <span className="mat-list-cell mat-list-cell-name">{m.name}</span>
                            <span className="mat-list-cell mat-list-cell-uom">
                              {m.uom?.short_name || m.uom?.name || '—'}
                            </span>
                            <span className="mat-list-cell mat-list-cell-price">
                              {formatListBasePrice(m)}
                            </span>
                            <span className="mat-list-cell mat-list-cell-coeff">
                              {materialListCoeffPlaceholder()}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                {editing && (
                  <div
                    className="admin-main-extras-host"
                    ref={setMatExtraHost}
                    aria-label="Сопутствующие материалы и операции"
                  />
                )}
              </>
            )}
          </main>
          <section className="admin-panel">
            {editing && selected != null && (
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
                categoryId={selected}
                material={editing === 'new' ? null : editing}
                onClose={() => setEditing(null)}
                onDeleted={(id) => {
                  setMaterials((prev) => prev.filter((m) => m.id !== id))
                  setEditing(null)
                }}
                onSaved={(m) => {
                  setMaterials((prev) => {
                    if (editing === 'new') return [...prev, m]
                    return prev.map((x) => (x.id === m.id ? m : x))
                  })
                  setEditing(m)
                }}
                extraHost={matExtraHost}
              />
            )}
          </section>
        </div>
      ) : section === 'calculator' ? (
        <div
          className="admin-body"
          id="admin-panel-calculator"
          role="tabpanel"
          aria-labelledby="admin-tab-calculator"
        >
          <div className="admin-orders-placeholder">
            <CalculatorPage />
          </div>
        </div>
      ) : (
        <div className="admin-body" id="admin-panel-orders" role="tabpanel" aria-labelledby="admin-tab-orders">
          <div className="admin-orders-placeholder">
            <div className="admin-heading-row">
              <h2 className="admin-h2">Заказы</h2>
              <HintButton text="Здесь будут будущие заказы от клиентов, собранные в калькуляторе. Раздел пока в разработке." />
            </div>
            <p className="admin-muted">
              Раздел «Заказы» пока не реализован. Здесь появится список заказов, статусы и детали заказа.
            </p>
          </div>
        </div>
      )}
    </div>
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
              Папка «{folderDeleteModal.name}» будет удалена безвозвратно. Продолжить?
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
  extraHost,
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
  extraHost: HTMLDivElement | null
}) {
  const [activeTab, setActiveTab] = useState<'general' | 'extra' | 'texture'>('general')
  const [textureFile, setTextureFile] = useState<File | null>(null)
  const [texturePreviewUrl, setTexturePreviewUrl] = useState<string | null>(null)
  const [textureClearRequested, setTextureClearRequested] = useState(false)
  const [form, setForm] = useState({
    name: material?.name ?? '',
    article: material?.article ?? '',
    fnp_name: material?.fnp_name ?? '',
    uom_id: material?.uom_id ?? (uomList[0]?.id ?? 0),
    unit_mass: capDecimalString(
      String(material?.unit_mass ?? '0'),
      DECIMAL_FRACTION_DIGITS
    ),
    base_price: capDecimalString(String(material?.base_price ?? '0'), DECIMAL_FRACTION_DIGITS),
    alt_currency: '',
    alt_prices_map: mapFromAltPriceRows(material?.alt_prices),
    note: material?.note ?? '',
    rounding_mode: (material?.rounding_mode ?? 'none') as RoundingMode,
    rounding_multiple: material?.rounding_multiple ?? '',
    is_active: material?.is_active ?? true,
    material_class_ids: normalizeMaterialClassIds(material?.material_class_ids),
    thickness: capDecimalString(String(material?.thickness ?? '0'), DECIMAL_FRACTION_DIGITS),
    min_length: capDecimalString(String((material as any)?.min_length ?? '0'), DECIMAL_FRACTION_DIGITS),
    max_length: capDecimalString(String(material?.max_length ?? '0'), DECIMAL_FRACTION_DIGITS),
    min_width: capDecimalString(String((material as any)?.min_width ?? '0'), DECIMAL_FRACTION_DIGITS),
    max_width: capDecimalString(String(material?.max_width ?? '0'), DECIMAL_FRACTION_DIGITS),
    designation: material?.designation ?? '',
    cut_coeff: capDecimalString(String(material?.cut_coeff ?? '1'), 6),
    calc_type: material?.calc_type ?? 'tape',

    texture_mode: (material?.texture_mode ?? 'texture') as string,
    texture_color: material?.texture_color ?? '#ffffff',
    texture_image: material?.texture_image ?? null,
    tex_offset_x: capDecimalString(String(material?.tex_offset_x ?? '0'), DECIMAL_FRACTION_DIGITS),
    tex_offset_y: capDecimalString(String(material?.tex_offset_y ?? '0'), DECIMAL_FRACTION_DIGITS),
    tex_step_x: capDecimalString(String(material?.tex_step_x ?? '100'), DECIMAL_FRACTION_DIGITS),
    tex_step_y: capDecimalString(String(material?.tex_step_y ?? '100'), DECIMAL_FRACTION_DIGITS),
    tex_opacity: capDecimalString(String(material?.tex_opacity ?? '1'), 3),
    tex_mirror: material?.tex_mirror ?? false,
    tex_specular_sharpness: capDecimalString(String(material?.tex_specular_sharpness ?? '0.5'), 3),
    tex_specular_brightness: capDecimalString(String(material?.tex_specular_brightness ?? '0.35'), 3),
    tex_rotation_deg: capDecimalString(String(material?.tex_rotation_deg ?? '0'), 2),
  })
  const [saving, setSaving] = useState(false)
  const [localErr, setLocalErr] = useState<string | null>(null)
  const [newClassName, setNewClassName] = useState('')
  const [addingClass, setAddingClass] = useState(false)
  const [classSyncPending, setClassSyncPending] = useState(false)
  const [relatedItems, setRelatedItems] = useState<RelatedItemState[]>(() =>
    materialExtrasInitRelated(material)
  )
  const [opLines, setOpLines] = useState<OpLineState[]>(() => materialExtrasInitOps(material))
  const matClassInputRef = useRef<HTMLInputElement>(null)
  const matClassRowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    return () => {
      if (texturePreviewUrl) URL.revokeObjectURL(texturePreviewUrl)
    }
  }, [texturePreviewUrl])

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
    const altMap = { ...form.alt_prices_map }
    if (form.alt_currency) {
      altMap[form.alt_currency] = normalizeDecimalOnBlur(altMap[form.alt_currency] ?? '0')
    }
    const baseBody: Record<string, unknown> = {
      category: categoryId,
      name: form.name,
      article: form.article,
      fnp_name: form.fnp_name,
      uom_id: form.uom_id,
      unit_mass: commitDecimalForApi(form.unit_mass),
      base_price: commitDecimalForApi(form.base_price),
      base_currency: BASE_CURRENCY,
      alt_prices: buildAltPricesPayload(altMap),
      note: form.note,
      rounding_mode: form.rounding_mode,
      rounding_multiple:
        form.rounding_mode === 'ceil_multiple' && form.rounding_multiple !== ''
          ? form.rounding_multiple
          : null,
      is_active: form.is_active,
      material_class_ids: form.material_class_ids,
      thickness: commitDecimalForApi(form.thickness),
      min_length: commitDecimalForApi((form as any).min_length),
      max_length: commitDecimalForApi(form.max_length),
      min_width: commitDecimalForApi((form as any).min_width),
      max_width: commitDecimalForApi(form.max_width),
      designation: form.designation,
      cut_coeff: commitDecimalForApi(form.cut_coeff),
      calc_type: form.calc_type,
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
      })),
      operation_lines: opLines
        .filter((o) => o.name.trim())
        .map((o) => ({
          name: o.name.trim(),
          model_parameter: o.model_parameter.trim(),
          quantity: commitDecimalForApi(o.quantity),
          uom_id: o.uom_id > 0 ? o.uom_id : null,
          price: commitDecimalForApi(o.price),
        })),
    }
    if (textureClearRequested) {
      // Для удаления файла текстуры отправляем явный null (JSON PATCH).
      baseBody.texture_image = null
    }
    const body: Record<string, unknown> | FormData = (() => {
      if (!textureFile) return baseBody
      const fd = new FormData()
      for (const [k, v] of Object.entries(baseBody)) {
        if (v === undefined) continue
        // Для multipart не отправляем null как пустую строку — DRF может ругаться на DecimalField.
        if (v === null) continue
        else if (typeof v === 'object') fd.append(k, JSON.stringify(v))
        else fd.append(k, String(v))
      }
      fd.append('texture_image', textureFile)
      return fd
    })()
    const p =
      material == null
        ? createMaterial(body)
        : updateMaterial(material.id, body)
    p.then((m) => {
      onSaved(m)
      // После загрузки файла важно сразу подхватить URL из ответа API,
      // иначе форма может продолжать показывать старое (null) до переоткрытия карточки.
      if (m.texture_image) setField('texture_image', m.texture_image)
      if (m.texture_image === null) setField('texture_image', null)
      if (m.texture_mode) setField('texture_mode', m.texture_mode)
      if (m.texture_color) setField('texture_color', m.texture_color)
      setTextureFile(null)
      setTextureClearRequested(false)
      if (texturePreviewUrl) URL.revokeObjectURL(texturePreviewUrl)
      setTexturePreviewUrl(null)
      setRelatedItems(materialExtrasInitRelated(m))
      setOpLines(materialExtrasInitOps(m))
    })
      .catch((e) => setLocalErr(String(e)))
      .finally(() => setSaving(false))
  }

  const remove = () => {
    if (material == null) return
    if (!window.confirm('Удалить материал?')) return
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
          <h3 className="admin-h2">{material ? 'Карточка материала' : 'Новый материал'}</h3>
          <HintButton text="Поля — во вкладке «Общие параметры»; сопутствующие и операции — внизу по центру (под списком папки)." />
        </div>
        <button type="button" onClick={onClose}>
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
        <span>Наименование ФНП</span>
        <input
          className="admin-input"
          value={form.fnp_name}
          onChange={(e) => setField('fnp_name', e.target.value)}
        />
      </label>
      <label className="field">
        <span>Ед. измерения *</span>
        <select
          className="admin-input"
          value={form.uom_id}
          onChange={(e) => setField('uom_id', Number(e.target.value))}
        >
          {uomList.map((u) => (
            <option key={u.id} value={u.id}>
              {u.short_name || u.name} ({u.name})
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Масса на ед. изм.</span>
        <input
          className="admin-input"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={form.unit_mass}
          onChange={(e) => setField('unit_mass', filterDecimalInput(e.target.value, DECIMAL_FRACTION_DIGITS))}
          onBlur={(e) => setField('unit_mass', normalizeDecimalOnBlur(e.currentTarget.value))}
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
          onBlur={(e) => setField('base_price', normalizeDecimalOnBlur(e.currentTarget.value))}
        />
      </label>
      <div className="field">
        <div className="field-label-row">
          <span>Альтернативные валюты</span>
          <HintButton text="Для каждой валюты цена хранится отдельно. Выберите валюту, введите цену, переключитесь — значения не теряются до сохранения." />
        </div>
      </div>
      <label className="field">
        <span>Валюта для ввода</span>
        <select
          className="admin-input"
          value={form.alt_currency}
          onChange={(e) => {
            const next = e.target.value
            setForm((f) => {
              const nextMap = { ...f.alt_prices_map }
              if (f.alt_currency) {
                nextMap[f.alt_currency] = normalizeDecimalOnBlur(
                  nextMap[f.alt_currency] ?? '0'
                )
              }
              return { ...f, alt_currency: next, alt_prices_map: nextMap }
            })
          }}
        >
          <option value="">Не выбрана (только просмотр / без ввода)</option>
          {ALTERNATIVE_CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>
          Цена за ед. {form.alt_currency ? `в ${form.alt_currency}` : ''}
          {form.alt_currency &&
            (form.alt_prices_map[form.alt_currency] ? ' (сохранено в этой валюте)' : '')}
        </span>
        <input
          className="admin-input"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={form.alt_currency ? form.alt_prices_map[form.alt_currency] ?? '0' : '0'}
          disabled={!form.alt_currency}
          onChange={(e) => {
            const cur = form.alt_currency
            if (!cur) return
            const v = filterDecimalInput(e.target.value, DECIMAL_FRACTION_DIGITS)
            setForm((f) => ({
              ...f,
              alt_prices_map: { ...f.alt_prices_map, [cur]: v },
            }))
          }}
          onBlur={() => {
            setForm((f) => {
              if (!f.alt_currency) return f
              return {
                ...f,
                alt_prices_map: {
                  ...f.alt_prices_map,
                  [f.alt_currency]: normalizeDecimalOnBlur(
                    f.alt_prices_map[f.alt_currency] ?? '0'
                  ),
                },
              }
            })
          }}
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
        <select
          className="admin-input"
          value={form.rounding_mode}
          onChange={(e) => setField('rounding_mode', e.target.value as RoundingMode)}
        >
          {ROUNDING.map((o) => (
            <option key={o.v} value={o.v}>
              {o.l}
            </option>
          ))}
        </select>
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
      <label className="field inline">
        <input
          type="checkbox"
          checked={form.is_active}
          onChange={(e) => setField('is_active', e.target.checked)}
        />
        <span>Активен</span>
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
          <button type="button" disabled={saving || classSyncPending} onClick={remove}>
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
              onBlur={(e) => setField('thickness', normalizeDecimalOnBlur(e.currentTarget.value))}
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
              onBlur={(e) => setField('max_length', normalizeDecimalOnBlur(e.currentTarget.value))}
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
                setField('min_length' as any, normalizeDecimalOnBlur(e.currentTarget.value) as any)
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
              onBlur={(e) => setField('max_width', normalizeDecimalOnBlur(e.currentTarget.value))}
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
                setField('min_width' as any, normalizeDecimalOnBlur(e.currentTarget.value) as any)
              }
              placeholder="например 100"
            />
          </label>

          <label className="field">
            <span>Обозначение</span>
            <input
              className="admin-input"
              value={form.designation}
              onChange={(e) => setField('designation', e.target.value)}
              placeholder="например ЛДСП 16мм, белый"
            />
          </label>

          <label className="field">
            <span>Коэф. с учётом раскроя</span>
            <input
              className="admin-input"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={form.cut_coeff}
              onChange={(e) => setField('cut_coeff', filterDecimalInput(e.target.value, 6))}
              onBlur={(e) => setField('cut_coeff', normalizeDecimalOnBlur(e.currentTarget.value))}
              placeholder="например 1.12"
            />
          </label>

          <label className="field">
            <span>Тип</span>
            <select
              className="admin-input"
              value={form.calc_type}
              onChange={(e) => setField('calc_type', e.target.value)}
            >
              <option value="tape">Лента</option>
            </select>
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
              <button type="button" disabled={saving || classSyncPending} onClick={remove}>
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
                        : `url(${(() => {
                            if (texturePreviewUrl) return texturePreviewUrl
                            const p = form.texture_image
                            if (!p) return ''
                            if (p.startsWith('http')) return p
                            return `http://127.0.0.1:8000${p}`
                          })()})`,
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
                      setTextureFile(null)
                      if (texturePreviewUrl) URL.revokeObjectURL(texturePreviewUrl)
                      setTexturePreviewUrl(null)
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
                  <span>Текстура (файл)</span>
                  <input
                    className="admin-input"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null
                      setField('texture_mode', 'texture')
                      setTextureClearRequested(false)
                      setTextureFile(f)
                      if (texturePreviewUrl) URL.revokeObjectURL(texturePreviewUrl)
                      setTexturePreviewUrl(f ? URL.createObjectURL(f) : null)
                    }}
                  />
                  {(texturePreviewUrl || form.texture_image) && (
                    <button
                      type="button"
                      className="admin-secondary"
                      onClick={() => {
                        setTextureFile(null)
                        setTextureClearRequested(true)
                        if (texturePreviewUrl) URL.revokeObjectURL(texturePreviewUrl)
                        setTexturePreviewUrl(null)
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
                      onBlur={(e) => setField('tex_offset_x', normalizeDecimalOnBlur(e.currentTarget.value))}
                      placeholder="X"
                    />
                  </div>
                  <div className="field-half">
                    <input
                      className="admin-input"
                      value={form.tex_offset_y}
                      onChange={(e) => setField('tex_offset_y', filterDecimalInput(e.target.value, DECIMAL_FRACTION_DIGITS))}
                      onBlur={(e) => setField('tex_offset_y', normalizeDecimalOnBlur(e.currentTarget.value))}
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
                      onBlur={(e) => setField('tex_step_x', normalizeDecimalOnBlur(e.currentTarget.value))}
                      placeholder="X"
                    />
                  </div>
                  <div className="field-half">
                    <input
                      className="admin-input"
                      value={form.tex_step_y}
                      onChange={(e) => setField('tex_step_y', filterDecimalInput(e.target.value, DECIMAL_FRACTION_DIGITS))}
                      onBlur={(e) => setField('tex_step_y', normalizeDecimalOnBlur(e.currentTarget.value))}
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
                  <button type="button" disabled={saving || classSyncPending} onClick={remove}>
                    Удалить
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    {extraHost &&
      createPortal(
        <MaterialExtrasPanel
          uomList={uomList}
          mainMaterialId={material?.id ?? null}
          relatedItems={relatedItems}
          onRelatedChange={setRelatedItems}
          opLines={opLines}
          onOpLinesChange={setOpLines}
          basePrice={form.base_price}
        />,
        extraHost
      )}
    </>
  )
}

export default AdminApp
