import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
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
import { FolderMoveModal } from './FolderMoveModal'
import { HintButton } from './HintButton'
import { resolveTextureImageUrl } from './TexturePickerModal'
import type { TextureCategory, TextureItem } from './types'
import './AdminApp.css'

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

function collectSubtreeCategoryIds(cat: TextureCategory): Set<number> {
  const ids = new Set<number>()
  const walk = (node: TextureCategory) => {
    ids.add(node.id)
    for (const ch of node.children ?? []) walk(ch)
  }
  walk(cat)
  return ids
}

function TextureTreeRow({
  c,
  depth,
  selectedId,
  expandedIds,
  onToggleExpanded,
  onSelect,
  onRename,
  onDelete,
  onMove,
}: {
  c: TextureCategory
  depth: number
  selectedId: number | null
  expandedIds: Set<number>
  onToggleExpanded: (id: number) => void
  onSelect: (id: number) => void
  onRename: (id: number, name: string) => Promise<void>
  onDelete: (c: TextureCategory) => void
  onMove: (c: TextureCategory) => void
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
              aria-label="Действия с папкой: переименовать, переместить или удалить"
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
                    className="tree-gear-menu-item"
                    onClick={(e) => {
                      e.stopPropagation()
                      setMenuOpen(false)
                      onMove(c)
                    }}
                  >
                    Переместить…
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
            <TextureTreeRow
              key={ch.id}
              c={ch}
              depth={depth + 1}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onToggleExpanded={onToggleExpanded}
              onSelect={onSelect}
              onRename={onRename}
              onDelete={onDelete}
              onMove={onMove}
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
  item: TextureItem | 'new' | null
  onClose: () => void
  onSaved: (t: TextureItem) => void
  onDeleted: (id: number) => void
}) {
  const [name, setName] = useState(item && item !== 'new' ? item.name : '')
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

  const existingUrl =
    item && item !== 'new' && item.image ? resolveTextureImageUrl(item.image) : ''

  const save = () => {
    const n = name.trim()
    if (!n) {
      setLocalErr('Укажите наименование текстуры.')
      return
    }
    setSaving(true)
    setLocalErr(null)
    if (item === 'new' || item == null) {
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
    if (item === 'new' || item == null) return
    setDeleteOpen(false)
    setSaving(true)
    deleteTextureItem(item.id)
      .then(() => onDeleted(item.id))
      .then(() => onClose())
      .catch((e) => setLocalErr(String(e)))
      .finally(() => setSaving(false))
  }

  if (item == null) return null

  return (
    <>
      <div className="mat-form">
        <div className="mat-form-head">
          <div className="admin-heading-row mat-form-title-line">
            <h3 className="admin-h2">{item === 'new' ? 'Новая текстура' : 'Текстура'}</h3>
            <HintButton text="Имя и файл задаются здесь. В карточке материала остаются только смещение, тайлинг и прочие параметры наложения." />
          </div>
          <button type="button" className="admin-primary" onClick={onClose}>
            Закрыть
          </button>
        </div>
        {localErr && <div className="admin-error">{localErr}</div>}
        <label className="field">
          <span>Наименование *</span>
          <input className="admin-input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="field tex-file-row">
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
          <div className="field">
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
          <button type="button" className="admin-primary" disabled={saving} onClick={save}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
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
        </div>
      </div>
      {deleteOpen &&
        createPortal(
          <div
            className="admin-modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tex-del-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) setDeleteOpen(false)
            }}
          >
            <div className="admin-modal" role="document" onClick={(e) => e.stopPropagation()}>
              <h4 id="tex-del-title" className="admin-modal-title">
                Удалить текстуру?
              </h4>
              <p className="admin-modal-text">
                Запись будет удалена. У материалов, где была выбрана эта текстура, привязка сбросится.
              </p>
              <div className="admin-modal-actions">
                <button type="button" className="admin-secondary" onClick={() => setDeleteOpen(false)}>
                  Отмена
                </button>
                <button type="button" className="admin-primary admin-modal-confirm" onClick={confirmDelete}>
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
  const [folderMoveTarget, setFolderMoveTarget] = useState<TextureCategory | null>(null)
  const [folderDeleteModal, setFolderDeleteModal] = useState<TextureCategory | null>(null)

  const reloadTree = useCallback(() => {
    return fetchTextureCategoryTree()
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
    if (selected == null) {
      setItems([])
      return
    }
    fetchTextureItems(selected)
      .then((r) => setItems(r.results))
      .catch((e) => setErr(String(e)))
  }, [selected])

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

  const deleteFolder = useCallback((cat: TextureCategory) => {
    setFolderDeleteModal(cat)
  }, [])

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

  const confirmDeleteFolder = useCallback(() => {
    const cat = folderDeleteModal
    if (!cat) return
    setFolderDeleteModal(null)
    setErr(null)
    deleteTextureCategory(cat.id)
      .then(() => {
        const removed = collectSubtreeCategoryIds(cat)
        if (selected != null && removed.has(selected)) {
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
      <div className="admin-body" id="admin-panel-textures" role="tabpanel" aria-labelledby="admin-tab-textures">
        {err && <div className="admin-error">{err}</div>}
        {loading && <p className="admin-muted admin-initial-state">Загрузка…</p>}
        <aside className="admin-aside">
          <div className="admin-heading-row">
            <h2 className="admin-h2">Папки текстур</h2>
            <HintButton text="Структура как у материалов: папки слева, текстуры в папке по центру, карточка справа. Удаление папки каскадом убирает вложенные папки и все текстуры в них." />
          </div>
          <div className="admin-stack">
            <button type="button" className="admin-primary admin-folder-create-btn" onClick={() => setFolderCreateOpen(true)}>
              + Создать папку
            </button>
          </div>
          <ul className="tree-root">
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
                onDelete={deleteFolder}
                onMove={setFolderMoveTarget}
              />
            ))}
          </ul>
        </aside>
        <div className="admin-main-col">
          <main className="admin-main">
            {selected == null ? (
              <p className="admin-muted admin-main-empty">
                Выберите папку слева. <HintButton text="Здесь список именованных текстур выбранной папки." />
              </p>
            ) : (
              <div className="admin-main-scroll">
                <div className="admin-heading-row">
                  <h2 className="admin-h2">Текстуры в папке</h2>
                </div>
                <button type="button" className="admin-primary" onClick={() => setEditing('new')}>
                  + Текстура
                </button>
                <div className="mat-list-table mat-list-table--textures" aria-label="Список текстур в папке">
                  <div className="mat-list-legend" role="row">
                    <span role="columnheader">Превью</span>
                    <span role="columnheader">Наименование</span>
                  </div>
                  <ul className="mat-list">
                    {items.map((it) => {
                      const url = resolveTextureImageUrl(it.image)
                      return (
                        <li key={it.id} className="mat-list-item">
                          <button
                            type="button"
                            className={
                              editing && editing !== 'new' && editing.id === it.id
                                ? 'mat-list-row mat-list-row--active mat-list-row--texture'
                                : 'mat-list-row mat-list-row--texture'
                            }
                            onClick={() => setEditing(it)}
                            title="Открыть карточку текстуры"
                            aria-current={
                              editing && editing !== 'new' && editing.id === it.id ? 'true' : undefined
                            }
                          >
                            <span className="mat-list-cell mat-list-cell-tex-prev">
                              {url ? (
                                <span className="mat-list-tex-thumb" style={{ backgroundImage: `url(${url})` }} />
                              ) : (
                                <span className="mat-list-tex-thumb mat-list-tex-thumb--empty">—</span>
                              )}
                            </span>
                            <span className="mat-list-cell mat-list-cell-name">{it.name}</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </div>
            )}
          </main>
        </div>
        <section className="admin-panel">
          {editing && selected != null && (
            <TextureCardForm
              key={editing === 'new' ? 'new' : editing.id}
              categoryId={selected}
              item={editing}
              onClose={() => setEditing(null)}
              onSaved={(t) => {
                setItems((prev) => {
                  if (editing === 'new') return [...prev, t]
                  return prev.map((x) => (x.id === t.id ? t : x))
                })
                setEditing(t)
              }}
              onDeleted={(id) => {
                setItems((prev) => prev.filter((x) => x.id !== id))
                setEditing(null)
              }}
            />
          )}
        </section>
      </div>
      {folderCreateOpen ? (
        <FolderCreateModal
          tree={tree}
          initialParentId={selected}
          onClose={() => setFolderCreateOpen(false)}
          onCreate={submitNewFolder}
        />
      ) : null}
      {folderMoveTarget ? (
        <FolderMoveModal
          key={folderMoveTarget.id}
          tree={tree}
          folderToMove={folderMoveTarget}
          onClose={() => setFolderMoveTarget(null)}
          onMove={applyFolderMove}
          fetchItemsInFolder={(id) => fetchTextureItems(id)}
          itemsLoadingLabel="Загрузка текстур…"
          itemsEmptySuffix="текстур"
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
            <div className="admin-modal" role="document" onClick={(e) => e.stopPropagation()}>
              <h4 id="tex-folder-delete-title" className="admin-modal-title">
                Удалить папку?
              </h4>
              <p className="admin-modal-text">
                Папка «{folderDeleteModal.name}» будет удалена вместе со всеми вложенными папками и текстурами.
                Материалы с привязкой к этим текстурам потеряют ссылку. Продолжить?
              </p>
              <div className="admin-modal-actions">
                <button type="button" className="admin-secondary" onClick={cancelDeleteFolder}>
                  Отмена
                </button>
                <button type="button" className="admin-primary admin-modal-confirm" onClick={confirmDeleteFolder}>
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
