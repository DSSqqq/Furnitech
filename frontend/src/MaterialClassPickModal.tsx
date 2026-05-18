import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { fetchMaterialClassCategoryTree, fetchMaterialClasses } from './api'
import type { MaterialClass, MaterialClassCategory } from './types'

const ROOT_LABEL = 'База классов'

const PICK_COLUMNS = ['Код', 'Наименование класса'] as const

function dashIfEmpty(s: string | undefined | null) {
  const t = (s ?? '').trim()
  return t ? t : '—'
}

function ClassPickListTable({
  items,
  loading,
  emptyText,
  onPickRow,
  selectedClassIds,
  shownScopeLabel,
}: {
  items: MaterialClass[]
  loading: boolean
  emptyText: string
  onPickRow: (c: MaterialClass) => void
  /** Если передан — строки с этими id подсвечиваются, aria-pressed для переключения */
  selectedClassIds?: number[]
  /** Область списка («База классов» / путь к папке) — строка той же вёрстки, что легенда таблицы */
  shownScopeLabel?: string
}) {
  const sel = selectedClassIds ?? []
  const multi = selectedClassIds != null
  const scope = (shownScopeLabel ?? '').trim()
  return (
    <div className="mat-list-table material-class-pick-mat-list" aria-label="Список классов для выбора">
      {scope ? (
        <div
          className="mat-list-item-inner mat-list-item-inner--legend material-class-pick-scope-row"
          role="row"
        >
          <div className="mat-list-legend" role="presentation">
            <span>
              Показано: <strong>{shownScopeLabel}</strong>
            </span>
          </div>
        </div>
      ) : null}
      <div className="mat-list-item-inner mat-list-item-inner--legend" role="row">
        <div className="mat-list-legend" role="presentation">
          {PICK_COLUMNS.map((label) => (
            <span key={label} role="columnheader">
              {label}
            </span>
          ))}
        </div>
      </div>
      {loading ? (
        <p className="admin-muted material-class-pick-mat-list-loading">Загрузка классов…</p>
      ) : items.length === 0 ? (
        <p className="folder-explorer-empty">{emptyText}</p>
      ) : (
        <ul className="mat-list">
          {items.map((c) => {
            const id = Number(c.id)
            const isSel = multi && sel.includes(id)
            return (
              <li key={c.id} className="mat-list-item">
                <button
                  type="button"
                  className={isSel ? 'mat-list-row mat-list-row--active' : 'mat-list-row'}
                  title={c.name}
                  aria-label={`Выбрать класс: ${c.name || 'класс'}`}
                  aria-pressed={multi ? isSel : undefined}
                  onClick={() => onPickRow(c)}
                >
                  <span className="mat-list-cell mat-list-cell-article">{dashIfEmpty(c.code)}</span>
                  <span className="mat-list-cell mat-list-cell-name">{c.name}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function findInTree(nodes: MaterialClassCategory[], id: number): MaterialClassCategory | null {
  for (const n of nodes) {
    if (n.id === id) return n
    const r = findInTree(n.children ?? [], id)
    if (r) return r
  }
  return null
}

function pathToRoot(tree: MaterialClassCategory[], id: number): MaterialClassCategory[] {
  const out: MaterialClassCategory[] = []
  const walk = (nodes: MaterialClassCategory[], chain: MaterialClassCategory[]): boolean => {
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

const DEFAULT_TREE_INDENT = { base: 6, step: 14 }
/** В узкой колонке модалки формулы — плотнее, как дерево папок формул */
const COMPACT_TREE_INDENT = { base: 4, step: 10 }

function MccFolderTreeRow({
  c,
  depth,
  selectedId,
  expandedIds,
  onToggle,
  onSelect,
  treeIndent = DEFAULT_TREE_INDENT,
}: {
  c: MaterialClassCategory
  depth: number
  selectedId: number | null
  expandedIds: Set<number>
  onToggle: (id: number) => void
  onSelect: (id: number) => void
  treeIndent?: { base: number; step: number }
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
        style={{ paddingLeft: treeIndent.base + depth * treeIndent.step }}
      >
        {hasKids ? (
          <button
            type="button"
            className="folder-explorer-tree-expander"
            draggable={false}
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
          draggable={false}
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
            <MccFolderTreeRow
              key={ch.id}
              c={ch}
              depth={depth + 1}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onSelect={onSelect}
              treeIndent={treeIndent}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

type Props = {
  onPick: (c: MaterialClass) => void
  onClose: () => void
  /** По умолчанию «Класс для формулы»; в карточке материала — «Классы материала». */
  title?: string
  /** Если true (по умолчанию) — после onPick вызывается onClose. Если false — множественный выбор без закрытия. */
  closeOnPick?: boolean
  /** Id уже выбранных классов (подсветка и aria-pressed). Имеет смысл при closeOnPick === false. */
  selectedClassIds?: number[]
}

function collectMccIdsWithChildren(tree: MaterialClassCategory[]): Set<number> {
  const out = new Set<number>()
  const walk = (nodes: MaterialClassCategory[]) => {
    for (const n of nodes) {
      const kids = n.children ?? []
      if (kids.length > 0) out.add(n.id)
      if (kids.length > 0) walk(kids)
    }
  }
  walk(tree)
  return out
}

export type MaterialClassPickerBodyProps = {
  onPick: (c: MaterialClass) => void
  selectedClassIds?: number[]
  /** В модалке выбора — true (фокус в поиск); во встроенном редакторе формулы — false */
  autoFocusSearch?: boolean
  /** Без строки поиска и хлебных крошек (встроенный редактор формулы) */
  hidePickChrome?: boolean
  className?: string
}

/** Дерево папок + список классов как на вкладке «Классы» (без портала). */
export function MaterialClassPickerBody({
  onPick,
  selectedClassIds,
  autoFocusSearch = false,
  hidePickChrome = false,
  className,
}: MaterialClassPickerBodyProps) {
  const [tree, setTree] = useState<MaterialClassCategory[]>([])
  const [treeLoading, setTreeLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set())
  const [classes, setClasses] = useState<MaterialClass[]>([])
  const [allClasses, setAllClasses] = useState<MaterialClass[]>([])
  const [loadingClasses, setLoadingClasses] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  /** Как «Папки формул»: сворачивание корня дерева */
  const [mccRootExpanded, setMccRootExpanded] = useState(true)

  const searchActive = hidePickChrome ? false : searchQ.trim().length > 0

  const selectedFolder = useMemo(
    () => (selectedId == null ? null : findInTree(tree, selectedId)),
    [tree, selectedId],
  )

  const breadcrumb = useMemo<MaterialClassCategory[]>(
    () => (selectedId == null ? [] : pathToRoot(tree, selectedId)),
    [tree, selectedId],
  )

  useEffect(() => {
    let cancelled = false
    setTreeLoading(true)
    fetchMaterialClassCategoryTree()
      .then((t) => {
        if (!cancelled) {
          setTree(t)
          setExpandedIds((prev) => (prev.size > 0 ? prev : collectMccIdsWithChildren(t)))
        }
      })
      .catch(() => {
        if (!cancelled) setTree([])
      })
      .finally(() => {
        if (!cancelled) setTreeLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchMaterialClasses()
      .then((r) => {
        if (!cancelled) setAllClasses(r.results ?? [])
      })
      .catch(() => {
        if (!cancelled) setAllClasses([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (searchActive) return
    if (selectedId == null) {
      setClasses(allClasses)
      setLoadingClasses(allClasses.length === 0)
      return
    }
    let cancelled = false
    setLoadingClasses(true)
    fetchMaterialClasses({ category: selectedId, subtree: true })
      .then((r) => {
        if (!cancelled) setClasses(r.results ?? [])
      })
      .catch(() => {
        if (!cancelled) setClasses([])
      })
      .finally(() => {
        if (!cancelled) setLoadingClasses(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedId, searchActive, allClasses])

  useEffect(() => {
    if (selectedId != null) setMccRootExpanded(true)
  }, [selectedId])

  const searchHit = useMemo(() => {
    const q = searchQ.trim().toLowerCase()
    if (!q) return []
    return allClasses.filter((c) => {
      const name = (c.name ?? '').toLowerCase()
      const code = (c.code ?? '').toLowerCase()
      const ext = (c.external_id ?? '').toLowerCase()
      return name.includes(q) || code.includes(q) || ext.includes(q)
    })
  }, [allClasses, searchQ])

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

  const targetLabel = selectedFolder ? selectedFolder.path || selectedFolder.name : ROOT_LABEL

  const wrapClass = ['admin-calculations-embedded-class-picker', className].filter(Boolean).join(' ')
  const mccTreeIndent = hidePickChrome ? COMPACT_TREE_INDENT : DEFAULT_TREE_INDENT

  return (
    <div className={wrapClass}>
      {!hidePickChrome ? (
        <label className="material-related-pick-search field">
          <span className="admin-muted">Поиск по названию, коду, ФНП…</span>
          <input
            autoFocus={autoFocusSearch}
            className="admin-input"
            value={searchQ}
            placeholder="Введите запрос или выберите папку слева"
            aria-label="Поиск класса"
            onChange={(e) => setSearchQ(e.target.value)}
          />
        </label>
      ) : null}

      {treeLoading ? (
        <p className="admin-muted">Загрузка папок…</p>
      ) : !searchActive ? (
        <>
          {!hidePickChrome ? (
            <div className="folder-explorer-breadcrumb" aria-label="Путь к выбранной папке">
              <button
                type="button"
                className={
                  selectedId == null ? 'folder-explorer-crumb folder-explorer-crumb--active' : 'folder-explorer-crumb'
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
          ) : null}

          <div className="folder-explorer">
            <aside className="folder-explorer-tree" aria-label="Дерево папок классов">
              <ul className="folder-explorer-tree-root admin-materials-tree-root" aria-label="Дерево папок классов">
                <li className="folder-explorer-tree-item folder-explorer-tree-item--materials-root">
                  <div
                    className={
                      selectedId == null
                        ? 'folder-explorer-tree-line folder-explorer-tree-line--active'
                        : 'folder-explorer-tree-line'
                    }
                  >
                    {tree.length > 0 ? (
                      <button
                        type="button"
                        className="folder-explorer-tree-expander"
                        draggable={false}
                        aria-label={mccRootExpanded ? 'Свернуть список папок' : 'Развернуть список папок'}
                        aria-expanded={mccRootExpanded}
                        onClick={(e) => {
                          e.stopPropagation()
                          setMccRootExpanded((v) => !v)
                        }}
                      >
                        <span aria-hidden>{mccRootExpanded ? '▾' : '▸'}</span>
                      </button>
                    ) : (
                      <span className="folder-explorer-tree-expander folder-explorer-tree-expander--spacer" aria-hidden />
                    )}
                    <button
                      type="button"
                      className="folder-explorer-tree-link"
                      draggable={false}
                      onClick={() => onSelectFolder(null)}
                      title={`${ROOT_LABEL} — показать все классы`}
                    >
                      <span className="folder-explorer-icon" aria-hidden>
                        🗂️
                      </span>
                      <span className="folder-explorer-tree-name">{ROOT_LABEL}</span>
                    </button>
                  </div>
                  {mccRootExpanded && tree.length > 0 ? (
                    <ul className="folder-explorer-tree-children">
                      {tree.map((c) => (
                        <MccFolderTreeRow
                          key={c.id}
                          c={c}
                          depth={0}
                          selectedId={selectedId}
                          expandedIds={expandedIds}
                          onToggle={onToggle}
                          onSelect={onSelectFolder}
                          treeIndent={mccTreeIndent}
                        />
                      ))}
                    </ul>
                  ) : null}
                </li>
              </ul>
            </aside>

            <section className="folder-explorer-content" aria-label="Классы в выбранной области">
              <ClassPickListTable
                items={classes}
                loading={loadingClasses}
                shownScopeLabel={targetLabel}
                emptyText={
                  hidePickChrome
                    ? 'Нет классов в этой области. Выберите другую папку слева.'
                    : 'Нет классов в этой области. Выберите другую папку слева или воспользуйтесь поиском.'
                }
                onPickRow={onPick}
                selectedClassIds={selectedClassIds}
              />
            </section>
          </div>
        </>
      ) : (
        <section className="folder-explorer-content material-related-pick-search-pane" aria-label="Результаты поиска">
          <ClassPickListTable
            items={searchHit}
            loading={false}
            emptyText="Ничего не найдено. Измените запрос или закройте поиск."
            onPickRow={onPick}
            selectedClassIds={selectedClassIds}
          />
        </section>
      )}
    </div>
  )
}

export function MaterialClassPickModal({
  onPick,
  onClose,
  title = 'Класс для формулы',
  closeOnPick = true,
  selectedClassIds,
}: Props) {
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

  const pick = (c: MaterialClass) => {
    onPick(c)
    if (closeOnPick) onClose()
  }

  return createPortal(
    <div
      className="admin-modal-backdrop admin-modal-backdrop--elevated"
      role="dialog"
      aria-modal="true"
      aria-labelledby="material-class-pick-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="admin-modal admin-modal--explorer" role="document" onClick={(e) => e.stopPropagation()}>
        <h4 id="material-class-pick-title" className="admin-modal-title">
          {title}
        </h4>

        {!closeOnPick ? (
          <p className="admin-muted" style={{ margin: '0 0 0.5rem' }}>
            Щёлкните по строке, чтобы назначить класс материалу или снять тот же класс. По готовности нажмите «Закрыть».
          </p>
        ) : null}

        <MaterialClassPickerBody onPick={pick} selectedClassIds={selectedClassIds} autoFocusSearch />

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
