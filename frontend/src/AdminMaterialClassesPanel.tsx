import { createPortal } from 'react-dom'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createMaterialClass,
  createMaterialClassCategory,
  deleteMaterialClass,
  deleteMaterialClassCategory,
  fetchMaterialClassCategoryTree,
  fetchMaterialClassesPage,
  updateMaterialClass,
  updateMaterialClassCategory,
} from './api'
import { AdminFolderToolbarIcon } from './AdminFolderToolbarIcon'
import { AdminPanelLoadingHost, PanelLoadingFlags } from './AdminPanelLoadingHost'
import type { MaterialClass, MaterialClassCategory } from './types'

const MODAL_CLOSE_X_SVG = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

const CLASS_LIST_COLUMNS = ['Код', 'Наименование класса'] as const

function sortClassesForList(rows: MaterialClass[]): MaterialClass[] {
  return rows.slice().sort((a, b) => a.name.localeCompare(b.name, 'ru'))
}

type MccRenameRequest = { targetId: number; nonce: number }

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

function findPathToMccId(tree: MaterialClassCategory[], id: number): number[] | null {
  const walk = (nodes: MaterialClassCategory[], path: number[]): number[] | null => {
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

function findMccNode(tree: MaterialClassCategory[], id: number): MaterialClassCategory | null {
  for (const n of tree) {
    if (n.id === id) return n
    const f = findMccNode(n.children ?? [], id)
    if (f) return f
  }
  return null
}

function MccTreeRow({
  c,
  depth,
  selectedId,
  expandedIds,
  onToggleExpanded,
  onSelect,
  onRename,
  folderRenameRequest,
  onFolderRenameConsumed,
}: {
  c: MaterialClassCategory
  depth: number
  selectedId: number | null
  expandedIds: Set<number>
  onToggleExpanded: (id: number) => void
  onSelect: (id: number) => void
  onRename: (id: number, name: string) => Promise<void>
  folderRenameRequest: MccRenameRequest | null
  onFolderRenameConsumed: () => void
}) {
  const isSel = c.id === selectedId
  const hasKids = (c.children?.length ?? 0) > 0
  const isExpanded = hasKids ? expandedIds.has(c.id) : false
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(c.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDraft(c.name)
  }, [c.id, c.name])

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
    (isSel && !editing ? 'folder-explorer-tree-line folder-explorer-tree-line--active' : 'folder-explorer-tree-line')

  return (
    <li className="folder-explorer-tree-item">
      <div className={lineClass} style={{ paddingLeft: 6 + depth * 14 }}>
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
            <MccTreeRow
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
            />
          ))}
        </ul>
      )}
    </li>
  )
}

export function AdminMaterialClassesPanel() {
  const [classes, setClasses] = useState<MaterialClass[]>([])
  const [mccTree, setMccTree] = useState<MaterialClassCategory[]>([])
  const [mccSelected, setMccSelected] = useState<number | null>(null)
  const [mccExpandedIds, setMccExpandedIds] = useState<Set<number>>(new Set())
  const [mccRootExpanded, setMccRootExpanded] = useState(true)
  const [mccFolderCreateOpen, setMccFolderCreateOpen] = useState(false)
  const [newMccFolderName, setNewMccFolderName] = useState('')
  const [mccFolderRenameRequest, setMccFolderRenameRequest] = useState<MccRenameRequest | null>(null)
  const [mccCreateErr, setMccCreateErr] = useState<string | null>(null)
  const clearMccFolderRenameRequest = useCallback(() => setMccFolderRenameRequest(null), [])

  const [newClassModalOpen, setNewClassModalOpen] = useState(false)
  const [newClassModalName, setNewClassModalName] = useState('')
  const [newClassModalCode, setNewClassModalCode] = useState('')
  const [newClassModalErr, setNewClassModalErr] = useState<string | null>(null)
  const [savingNewClass, setSavingNewClass] = useState(false)
  const [editClassTarget, setEditClassTarget] = useState<MaterialClass | null>(null)
  const [editClassName, setEditClassName] = useState('')
  const [editClassCode, setEditClassCode] = useState('')
  const [editClassErr, setEditClassErr] = useState<string | null>(null)
  const [savingEditClass, setSavingEditClass] = useState(false)
  const [deletingEditClass, setDeletingEditClass] = useState(false)
  const [editClassDeleteOpen, setEditClassDeleteOpen] = useState(false)
  const [treeLoading, setTreeLoading] = useState(true)
  const [listLoading, setListLoading] = useState(true)
  const [listHasMore, setListHasMore] = useState(false)
  const [listPage, setListPage] = useState(1)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const selectedMccCat = useMemo(
    () => (mccSelected == null ? null : findMccNode(mccTree, mccSelected)),
    [mccTree, mccSelected]
  )

  const reloadTree = useCallback(() => {
    setTreeLoading(true)
    setErr(null)
    return fetchMaterialClassCategoryTree()
      .then((t) => setMccTree(t))
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setTreeLoading(false))
  }, [])

  const reloadClassesOnly = useCallback((page = 1, append = false) => {
    setListLoading(true)
    const params = mccSelected == null ? undefined : { category: mccSelected, subtree: true }
    return fetchMaterialClassesPage(params, page)
      .then((r) => {
        const rows = r.results ?? []
        setClasses((prev) => sortClassesForList(append ? [...prev, ...rows] : rows))
        setListPage(page)
        setListHasMore(Boolean(r.next))
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setListLoading(false))
  }, [mccSelected])

  useEffect(() => {
    void reloadTree()
  }, [reloadTree])

  useEffect(() => {
    setMccExpandedIds((prev) => {
      if (prev.size > 0 || mccTree.length === 0) return prev
      return collectMccIdsWithChildren(mccTree)
    })
  }, [mccTree])

  useEffect(() => {
    if (mccSelected != null) setMccRootExpanded(true)
  }, [mccSelected])

  useEffect(() => {
    if (mccSelected == null) return
    const path = findPathToMccId(mccTree, mccSelected)
    if (!path || path.length < 2) return
    setMccExpandedIds((prev) => {
      const next = new Set(prev)
      for (const id of path.slice(0, -1)) next.add(id)
      return next
    })
  }, [mccSelected, mccTree])

  useEffect(() => {
    void reloadClassesOnly(1, false)
  }, [reloadClassesOnly])

  const loadMoreClasses = useCallback(() => {
    if (listLoading || !listHasMore) return
    void reloadClassesOnly(listPage + 1, true)
  }, [listHasMore, listLoading, listPage, reloadClassesOnly])

  const toggleMccExpanded = useCallback((id: number) => {
    setMccExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const renameMccFolder = useCallback(
    (id: number, name: string) => {
      setErr(null)
      return updateMaterialClassCategory(id, { name })
        .then(() => reloadTree())
        .then(() => undefined)
        .catch((e) => {
          setErr(String(e))
          throw e
        })
    },
    [reloadTree]
  )

  const triggerMccRenameSelected = useCallback(() => {
    if (mccSelected == null) return
    setMccFolderRenameRequest((r) => ({ targetId: mccSelected, nonce: (r?.nonce ?? 0) + 1 }))
  }, [mccSelected])

  const deleteMccFolder = useCallback(() => {
    if (!selectedMccCat) return
    if (
      !window.confirm(
        `Удалить папку «${selectedMccCat.name}»? (Только если в ней нет классов и вложенных папок.)`
      )
    ) {
      return
    }
    setBusy(true)
    setErr(null)
    deleteMaterialClassCategory(selectedMccCat.id)
      .then(() => {
        setMccSelected(null)
        return reloadTree()
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false))
  }, [selectedMccCat, reloadTree])

  const submitNewMccFolder = useCallback(() => {
    const name = newMccFolderName.trim()
    if (!name) {
      setMccCreateErr('Укажите имя папки.')
      return
    }
    setBusy(true)
    setMccCreateErr(null)
    createMaterialClassCategory({ parent: mccSelected, name, sort_order: 0 })
      .then(() => {
        setNewMccFolderName('')
        setMccFolderCreateOpen(false)
        return reloadTree()
      })
      .catch((e) => setMccCreateErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false))
  }, [newMccFolderName, mccSelected, reloadTree])

  const openNewClassModal = useCallback(() => {
    if (mccSelected == null) {
      setErr('Сначала выберите папку слева — у класса должна быть категория.')
      return
    }
    setEditClassTarget(null)
    setEditClassErr(null)
    setNewClassModalErr(null)
    setNewClassModalName('')
    setNewClassModalCode('')
    setNewClassModalOpen(true)
  }, [mccSelected])

  const openEditClass = useCallback((c: MaterialClass) => {
    setNewClassModalOpen(false)
    setNewClassModalErr(null)
    setEditClassErr(null)
    setEditClassDeleteOpen(false)
    setEditClassTarget(c)
    setEditClassName(c.name)
    setEditClassCode((c.code ?? '').trim())
  }, [])

  const closeEditClassModal = useCallback(() => {
    if (savingEditClass || deletingEditClass) return
    setEditClassTarget(null)
    setEditClassErr(null)
    setEditClassDeleteOpen(false)
  }, [savingEditClass, deletingEditClass])

  const saveEditedClass = useCallback(async () => {
    if (!editClassTarget) return
    const name = editClassName.trim()
    if (!name) {
      setEditClassErr('Укажите наименование.')
      return
    }
    const codeRaw = editClassCode.trim()
    if (!codeRaw) {
      setEditClassErr('Укажите код класса.')
      return
    }
    setSavingEditClass(true)
    setEditClassErr(null)
    try {
      const updated = await updateMaterialClass(editClassTarget.id, {
        name,
        code: codeRaw,
      })
      setClasses((prev) =>
        prev
          .map((x) => (x.id === updated.id ? updated : x))
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
      )
      setEditClassTarget(null)
    } catch (e) {
      setEditClassErr(e instanceof Error ? e.message : String(e))
    } finally {
      setSavingEditClass(false)
    }
  }, [editClassTarget, editClassName, editClassCode])

  const confirmDeleteEditedClass = useCallback(async () => {
    if (!editClassTarget) return
    setDeletingEditClass(true)
    setEditClassErr(null)
    try {
      await deleteMaterialClass(editClassTarget.id)
      setClasses((prev) => prev.filter((x) => x.id !== editClassTarget.id))
      setEditClassDeleteOpen(false)
      setEditClassTarget(null)
    } catch (e) {
      setEditClassErr(e instanceof Error ? e.message : String(e))
    } finally {
      setDeletingEditClass(false)
    }
  }, [editClassTarget])

  const closeNewClassModal = useCallback(() => {
    if (savingNewClass) return
    setNewClassModalOpen(false)
    setNewClassModalErr(null)
  }, [savingNewClass])

  const saveNewClass = useCallback(async () => {
    const name = newClassModalName.trim()
    if (!name) {
      setNewClassModalErr('Укажите наименование.')
      return
    }
    if (mccSelected == null) return
    const codeRaw = newClassModalCode.trim()
    if (!codeRaw) {
      setNewClassModalErr('Укажите код класса.')
      return
    }
    setSavingNewClass(true)
    setNewClassModalErr(null)
    try {
      await createMaterialClass({
        name,
        category: mccSelected,
        code: codeRaw,
      })
      setNewClassModalOpen(false)
      await reloadClassesOnly()
    } catch (e) {
      setNewClassModalErr(e instanceof Error ? e.message : String(e))
    } finally {
      setSavingNewClass(false)
    }
  }, [newClassModalName, newClassModalCode, mccSelected, reloadClassesOnly])

  useEffect(() => {
    if (!newClassModalOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !savingNewClass) {
        e.preventDefault()
        setNewClassModalOpen(false)
        setNewClassModalErr(null)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [newClassModalOpen, savingNewClass])

  useEffect(() => {
    if (!editClassTarget) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || savingEditClass || deletingEditClass) return
      e.preventDefault()
      if (editClassDeleteOpen) {
        setEditClassDeleteOpen(false)
        return
      }
      setEditClassTarget(null)
      setEditClassErr(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [editClassTarget, savingEditClass, deletingEditClass, editClassDeleteOpen])

  return (
    <>
    <AdminPanelLoadingHost
      id="admin-panel-classes"
      role="tabpanel"
      aria-labelledby="admin-tab-classes"
      ariaLabel="Загрузка классов материалов"
    >
      <PanelLoadingFlags tree={treeLoading} list={listLoading} />
      <aside className="admin-aside">
        <div className="admin-heading-row">
          <h2 className="admin-h2">Папки классов</h2>
        </div>
        <div className="admin-folder-toolbar" role="toolbar" aria-label="Действия с папками классов">
          <AdminFolderToolbarIcon
            label="Создать папку"
            disabled={busy}
            onClick={() => {
              setMccCreateErr(null)
              setMccFolderCreateOpen(true)
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 19h8a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-5l-1.33-1.5H5A1 1 0 0 0 4 6.5V18a1 1 0 0 0 1 1h7" />
              <path d="M12 11v6M9 14h6" />
            </svg>
          </AdminFolderToolbarIcon>
          <AdminFolderToolbarIcon
            label="Переименовать выбранную папку"
            disabled={busy || mccSelected == null}
            onClick={triggerMccRenameSelected}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
            </svg>
          </AdminFolderToolbarIcon>
          <AdminFolderToolbarIcon
            className="admin-folder-toolbar-btn--danger"
            label="Удалить выбранную папку"
            disabled={busy || selectedMccCat == null}
            onClick={() => void deleteMccFolder()}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6h12zM10 11v6M14 11v6" />
            </svg>
          </AdminFolderToolbarIcon>
        </div>
        <ul className="folder-explorer-tree-root admin-materials-tree-root" aria-label="Дерево папок классов">
          <li className="folder-explorer-tree-item folder-explorer-tree-item--materials-root">
            <div
              className={
                mccSelected == null
                  ? 'folder-explorer-tree-line folder-explorer-tree-line--active'
                  : 'folder-explorer-tree-line'
              }
            >
              {mccTree.length > 0 ? (
                <button
                  type="button"
                  className="folder-explorer-tree-expander"
                  draggable={false}
                  aria-label={
                    mccRootExpanded ? 'Свернуть список папок' : 'Развернуть список папок'
                  }
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
                onClick={() => setMccSelected(null)}
                title="База классов — показать классы из всех папок"
              >
                <span className="folder-explorer-icon" aria-hidden>
                  🗂️
                </span>
                <span className="folder-explorer-tree-name">База классов</span>
              </button>
            </div>
            {mccRootExpanded && mccTree.length > 0 ? (
              <ul className="folder-explorer-tree-children">
                {mccTree.map((c) => (
                  <MccTreeRow
                    key={c.id}
                    c={c}
                    depth={0}
                    selectedId={mccSelected}
                    expandedIds={mccExpandedIds}
                    onToggleExpanded={toggleMccExpanded}
                    onSelect={setMccSelected}
                    onRename={renameMccFolder}
                    folderRenameRequest={mccFolderRenameRequest}
                    onFolderRenameConsumed={clearMccFolderRenameRequest}
                  />
                ))}
              </ul>
            ) : null}
          </li>
        </ul>
      </aside>

      <div className="admin-main-col">
        <main className="admin-main">
          <div className="admin-main-scroll" onDragOver={(e) => e.preventDefault()}>
            {err ? <div className="admin-error">{err}</div> : null}
            <div className="admin-heading-row">
              <h2 className="admin-h2">
                {mccSelected == null
                  ? 'Классы: база классов'
                  : `Классы в папке: ${selectedMccCat?.name?.trim() || '—'}`}
              </h2>
            </div>
            <button
              type="button"
              className="admin-primary"
              disabled={mccSelected == null || busy || savingNewClass}
              title={
                mccSelected == null
                  ? 'Сначала выберите папку слева — у класса должна быть категория'
                  : undefined
              }
              onClick={openNewClassModal}
            >
              + Класс
            </button>

            <div
              className="mat-list-table"
              aria-label={mccSelected == null ? 'Список всех классов' : 'Список классов в папке'}
            >
              <div className="mat-list-item-inner mat-list-item-inner--legend" role="row">
                <div className="mat-list-legend" role="presentation">
                  {CLASS_LIST_COLUMNS.map((label) => (
                    <span key={label} role="columnheader">
                      {label}
                    </span>
                  ))}
                </div>
              </div>
              <ul className="mat-list">
                {!listLoading &&
                  classes.map((c) => {
                    const code = (c.code ?? '').trim()
                    return (
                      <li key={c.id} className="mat-list-item">
                        <div
                          className="mat-list-row"
                          role="button"
                          tabIndex={0}
                          aria-label={`Редактировать класс: ${c.name}`}
                          onClick={() => openEditClass(c)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              openEditClass(c)
                            }
                          }}
                        >
                          <span className="mat-list-cell mat-list-cell-article">{code ? code : '—'}</span>
                          <span className="mat-list-cell mat-list-cell-name">{c.name}</span>
                        </div>
                      </li>
                    )
                  })}
              </ul>
            </div>
            {!listLoading && classes.length === 0 ? (
              <p className="admin-muted admin-calculations-classes-empty">
                {mccSelected == null
                  ? 'Нет классов в справочнике.'
                  : 'В этой папке (и вложенных) пока нет классов — нажмите «+ Класс».'}
              </p>
            ) : null}
            {listLoading ? <p className="admin-muted">Загрузка списка…</p> : null}
            {listHasMore ? (
              <button
                type="button"
                className="admin-secondary"
                disabled={listLoading}
                onClick={loadMoreClasses}
              >
                {listLoading ? 'Загрузка…' : 'Загрузить ещё'}
              </button>
            ) : null}
          </div>
        </main>
      </div>

      {newClassModalOpen
        ? createPortal(
            <div
              className="admin-modal-backdrop"
              role="presentation"
              onClick={(e) => {
                if (e.target === e.currentTarget && !savingNewClass) closeNewClassModal()
              }}
            >
              <section
                className="admin-panel admin-panel--in-material-modal admin-calculations-modal-surface admin-modal--material-card admin-material-card-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="mclass-card-dialog-title"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mat-form">
                  <div className="mat-form-head">
                    <div className="admin-heading-row mat-form-title-line">
                      <h3 id="mclass-card-dialog-title" className="admin-h2">
                        Новый класс
                      </h3>
                    </div>
                    <button
                      type="button"
                      className="admin-primary admin-modal-head-icon-close"
                      aria-label="Закрыть"
                      title="Закрыть"
                      disabled={savingNewClass}
                      onClick={closeNewClassModal}
                    >
                      {MODAL_CLOSE_X_SVG}
                    </button>
                  </div>
                  {newClassModalErr ? <div className="admin-error">{newClassModalErr}</div> : null}
                  <div
                    className="mat-form-tab-panel"
                    role="region"
                    aria-label="Данные нового класса"
                  >
                    <label className="field mat-form-field-span-2">
                      <span>Наименование *</span>
                      <input
                        className="admin-input"
                        value={newClassModalName}
                        onChange={(e) => setNewClassModalName(e.target.value)}
                        autoFocus
                        disabled={savingNewClass}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            void saveNewClass()
                          }
                        }}
                      />
                    </label>
                    <label className="field mat-form-field-span-2">
                      <span>Код *</span>
                      <input
                        className="admin-input"
                        value={newClassModalCode}
                        onChange={(e) => setNewClassModalCode(e.target.value)}
                        required
                        aria-required
                        disabled={savingNewClass}
                      />
                    </label>
                    <div className="admin-row mat-form-actions">
                      <button
                        type="button"
                        className="admin-secondary"
                        disabled={savingNewClass}
                        onClick={closeNewClassModal}
                      >
                        Отмена
                      </button>
                      <button
                        type="button"
                        className="admin-primary"
                        disabled={savingNewClass}
                        onClick={() => void saveNewClass()}
                      >
                        {savingNewClass ? 'Сохранение…' : 'Сохранить'}
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </div>,
            document.body
          )
        : null}

      {editClassTarget
        ? createPortal(
            <>
              <div
                className="admin-modal-backdrop"
                role="presentation"
                onClick={(e) => {
                  if (
                    e.target === e.currentTarget &&
                    !savingEditClass &&
                    !deletingEditClass &&
                    !editClassDeleteOpen
                  ) {
                    closeEditClassModal()
                  }
                }}
              >
                <section
                  className="admin-panel admin-panel--in-material-modal admin-calculations-modal-surface admin-modal--material-card admin-material-card-dialog"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="mclass-edit-dialog-title"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="mat-form">
                    <div className="mat-form-head">
                      <div className="admin-heading-row mat-form-title-line">
                        <h3 id="mclass-edit-dialog-title" className="admin-h2">
                          Редактирование класса
                        </h3>
                      </div>
                      <button
                        type="button"
                        className="admin-primary admin-modal-head-icon-close"
                        aria-label="Закрыть"
                        title="Закрыть"
                        disabled={savingEditClass || deletingEditClass}
                        onClick={closeEditClassModal}
                      >
                        {MODAL_CLOSE_X_SVG}
                      </button>
                    </div>
                    {editClassErr ? <div className="admin-error">{editClassErr}</div> : null}
                    <div
                      className="mat-form-tab-panel"
                      role="region"
                      aria-label="Данные класса"
                    >
                      <label className="field mat-form-field-span-2">
                        <span>Наименование *</span>
                        <input
                          className="admin-input"
                          value={editClassName}
                          onChange={(e) => setEditClassName(e.target.value)}
                          autoFocus
                          disabled={savingEditClass || deletingEditClass}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              void saveEditedClass()
                            }
                          }}
                        />
                      </label>
                      <label className="field mat-form-field-span-2">
                        <span>Код *</span>
                        <input
                          className="admin-input"
                          value={editClassCode}
                          onChange={(e) => setEditClassCode(e.target.value)}
                          required
                          aria-required
                          disabled={savingEditClass || deletingEditClass}
                        />
                      </label>
                      <div className="admin-row mat-form-actions">
                        <button
                          type="button"
                          className="admin-secondary admin-danger"
                          disabled={savingEditClass || deletingEditClass}
                          onClick={() => setEditClassDeleteOpen(true)}
                        >
                          Удалить
                        </button>
                        <button
                          type="button"
                          className="admin-primary"
                          disabled={savingEditClass || deletingEditClass}
                          onClick={() => void saveEditedClass()}
                        >
                          {savingEditClass ? 'Сохранение…' : 'Сохранить'}
                        </button>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
              {editClassDeleteOpen ? (
                <div
                  className="admin-modal-backdrop admin-modal-backdrop--stack-top"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="mclass-del-title"
                  onClick={(e) => {
                    if (e.target === e.currentTarget && !deletingEditClass) setEditClassDeleteOpen(false)
                  }}
                >
                  <div
                    className="admin-modal admin-modal--elevated"
                    role="document"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h4 id="mclass-del-title" className="admin-modal-title">
                      Удалить класс?
                    </h4>
                    <p className="admin-modal-text">
                      Класс «
                      {editClassName.trim() || editClassTarget.name.trim() || '—'}» будет удалён. У материалов
                      пропадёт эта метка класса; при необходимости обновите формулы расчёта, где использовался этот
                      класс.
                    </p>
                    <div className="admin-row mat-form-actions">
                      <button
                        type="button"
                        className="admin-secondary"
                        disabled={deletingEditClass}
                        onClick={() => setEditClassDeleteOpen(false)}
                      >
                        Отмена
                      </button>
                      <button
                        type="button"
                        className="admin-primary"
                        disabled={deletingEditClass}
                        onClick={() => void confirmDeleteEditedClass()}
                      >
                        {deletingEditClass ? 'Удаление…' : 'Удалить'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </>,
            document.body
          )
        : null}

      {mccFolderCreateOpen
        ? createPortal(
            <div
              className="admin-modal-backdrop"
              role="presentation"
              onClick={(e) => {
                if (e.target === e.currentTarget && !busy) {
                  setMccFolderCreateOpen(false)
                  setMccCreateErr(null)
                }
              }}
            >
              <section
                className="admin-panel admin-panel--in-material-modal admin-calculations-modal-surface admin-modal--material-card admin-material-card-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="mcc-folder-create-title"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mat-form">
                  <div className="mat-form-head">
                    <div className="admin-heading-row mat-form-title-line">
                      <h3 id="mcc-folder-create-title" className="admin-h2">
                        Новая папка классов
                      </h3>
                    </div>
                    <button
                      type="button"
                      className="admin-primary admin-modal-head-icon-close"
                      aria-label="Закрыть"
                      title="Закрыть"
                      disabled={busy}
                      onClick={() => {
                        setMccFolderCreateOpen(false)
                        setMccCreateErr(null)
                      }}
                    >
                      {MODAL_CLOSE_X_SVG}
                    </button>
                  </div>
                  {mccCreateErr ? <div className="admin-error">{mccCreateErr}</div> : null}
                  <div className="mat-form-tab-panel" role="region" aria-label="Новая папка классов">
                    <p className="admin-modal-text mat-form-field-span-2">
                      Родитель:{' '}
                      <strong>{mccSelected == null ? 'корень' : selectedMccCat?.name ?? '—'}</strong>
                    </p>
                    <label className="field mat-form-field-span-2">
                      <span>Имя папки</span>
                      <input
                        className="admin-input"
                        value={newMccFolderName}
                        onChange={(e) => setNewMccFolderName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            void submitNewMccFolder()
                          }
                        }}
                        autoFocus
                      />
                    </label>
                    <div className="admin-row mat-form-actions">
                      <button
                        type="button"
                        className="admin-secondary"
                        disabled={busy}
                        onClick={() => {
                          setMccFolderCreateOpen(false)
                          setMccCreateErr(null)
                        }}
                      >
                        Отмена
                      </button>
                      <button
                        type="button"
                        className="admin-primary"
                        disabled={busy}
                        onClick={() => void submitNewMccFolder()}
                      >
                        {busy ? 'Создание…' : 'Создать'}
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </div>,
            document.body
          )
        : null}
    </AdminPanelLoadingHost>
    </>
  )
}
