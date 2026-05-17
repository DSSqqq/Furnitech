import { createPortal } from 'react-dom'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createCalculationFormula,
  createCalculationFormulaCategory,
  deleteCalculationFormula,
  deleteCalculationFormulaCategory,
  fetchCalculationFormulaCategoryTree,
  fetchCalculationFormulas,
  fetchMaterialClasses,
  pickDefaultCalculationFormulaCategoryId,
  updateCalculationFormula,
  updateCalculationFormulaCategory,
} from './api'
import { AdminFolderToolbarIcon } from './AdminFolderToolbarIcon'
import type {
  CalculationFormula,
  CalculationFormulaCategory,
  CalculationFormulaToken,
  MaterialClass,
} from './types'
import { formulaDisplayExpression } from './calculator/calculationFormula'
import { MaterialClassPickModal } from './MaterialClassPickModal'

type Draft = {
  id: number | null
  name: string
  tokens: CalculationFormulaToken[]
  category: number | null
}

const EMPTY_DRAFT: Draft = {
  id: null,
  name: '',
  tokens: [],
  category: null,
}

/** Список формул в основной колонке (как таблица материалов). */
const FORMULA_LIST_COLUMNS = ['Наименование', 'Формула'] as const

const FORMULA_CLASS_LIST_COLUMNS = ['Код', 'Наименование класса'] as const

function truncateMiddle(text: string, maxLen: number): string {
  const t = text.trim()
  if (t.length <= maxLen) return t
  if (maxLen < 5) return t.slice(0, maxLen)
  const head = Math.ceil((maxLen - 1) / 2)
  const tail = Math.floor((maxLen - 1) / 2)
  return `${t.slice(0, head)}…${t.slice(t.length - tail)}`
}

const GEAR_SVG = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.43.992a6.575 6.575 0 0 1 0 .255c-.008.378.137.75.43.99l1.005.828c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.37.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.871a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.213-1.281Z" />
    <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </svg>
)

const MODAL_CLOSE_X_SVG = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

/** Назад — один шаг в поле формулы */
const FORMULA_BACKSPACE_SVG = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M15 18l-6-6 6-6" />
  </svg>
)

const FORMULA_CLEAR_SVG = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M10 11v6M14 11v6" />
  </svg>
)

const OPS: Array<{ value: '+' | '-' | '*' | '/' | '(' | ')'; label: string }> = [
  { value: '+', label: '+' },
  { value: '-', label: '-' },
  { value: '*', label: '*' },
  { value: '/', label: '/' },
  { value: '(', label: '(' },
  { value: ')', label: ')' },
]

type CfcRenameRequest = { targetId: number; nonce: number }

function collectCfcIdsWithChildren(tree: CalculationFormulaCategory[]): Set<number> {
  const out = new Set<number>()
  const walk = (nodes: CalculationFormulaCategory[]) => {
    for (const n of nodes) {
      const kids = n.children ?? []
      if (kids.length > 0) out.add(n.id)
      if (kids.length > 0) walk(kids)
    }
  }
  walk(tree)
  return out
}

function findPathToCfcId(tree: CalculationFormulaCategory[], id: number): number[] | null {
  const walk = (nodes: CalculationFormulaCategory[], path: number[]): number[] | null => {
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

function findCfcNode(tree: CalculationFormulaCategory[], id: number): CalculationFormulaCategory | null {
  for (const n of tree) {
    if (n.id === id) return n
    const f = findCfcNode(n.children ?? [], id)
    if (f) return f
  }
  return null
}

function CfcTreeRow({
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
  c: CalculationFormulaCategory
  depth: number
  selectedId: number | null
  expandedIds: Set<number>
  onToggleExpanded: (id: number) => void
  onSelect: (id: number) => void
  onRename: (id: number, name: string) => Promise<void>
  folderRenameRequest: CfcRenameRequest | null
  onFolderRenameConsumed: () => void
}) {
  const isSel = c.id === selectedId
  const hasKids = (c.children?.length ?? 0) > 0
  const isExpanded = hasKids ? expandedIds.has(c.id) : false
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(c.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDraftName(c.name)
  }, [c.id, c.name])

  useEffect(() => {
    if (!folderRenameRequest || folderRenameRequest.targetId !== c.id) return
    setEditing(true)
    setDraftName(c.name)
    onFolderRenameConsumed()
  }, [folderRenameRequest, c.id, c.name, onFolderRenameConsumed])

  const commit = () => {
    const t = draftName.trim()
    if (!t) {
      setDraftName(c.name)
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
        setDraftName(c.name)
      })
  }

  const cancel = () => {
    setDraftName(c.name)
    setEditing(false)
  }

  const lineClass =
    isSel && !editing ? 'folder-explorer-tree-line folder-explorer-tree-line--active' : 'folder-explorer-tree-line'

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
            value={draftName}
            draggable={false}
            onChange={(e) => setDraftName(e.target.value)}
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
          <button type="button" className="folder-explorer-tree-link" draggable={false} onClick={() => onSelect(c.id)} title={c.path}>
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
            <CfcTreeRow
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

function draftFromFormula(f: CalculationFormula): Draft {
  return {
    id: f.id,
    name: f.name,
    tokens: f.tokens ?? [],
    category: f.category,
  }
}

export function AdminCalculationsPanel() {
  const [formulas, setFormulas] = useState<CalculationFormula[]>([])
  const [cfcTree, setCfcTree] = useState<CalculationFormulaCategory[]>([])
  const [cfcSelected, setCfcSelected] = useState<number | null>(null)
  const [cfcExpandedIds, setCfcExpandedIds] = useState<Set<number>>(new Set())
  const [cfcRootExpanded, setCfcRootExpanded] = useState(true)
  const [cfcFolderCreateOpen, setCfcFolderCreateOpen] = useState(false)
  const [newCfcFolderName, setNewCfcFolderName] = useState('')
  const [cfcFolderRenameRequest, setCfcFolderRenameRequest] = useState<CfcRenameRequest | null>(null)
  const [cfcCreateErr, setCfcCreateErr] = useState<string | null>(null)
  const clearCfcFolderRenameRequest = useCallback(() => setCfcFolderRenameRequest(null), [])

  const [classChips, setClassChips] = useState<MaterialClass[]>([])
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [numberValue, setNumberValue] = useState('')
  const [treeLoading, setTreeLoading] = useState(true)
  const [listLoading, setListLoading] = useState(true)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [classPickOpen, setClassPickOpen] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [formulaDeleteOpen, setFormulaDeleteOpen] = useState(false)

  const expression = useMemo(() => formulaDisplayExpression(draft.tokens), [draft.tokens])

  const selectedCfcCat = useMemo(
    () => (cfcSelected == null ? null : findCfcNode(cfcTree, cfcSelected)),
    [cfcTree, cfcSelected],
  )

  const classById = useMemo(() => {
    const m = new Map<number, MaterialClass>()
    for (const c of classChips) m.set(c.id, c)
    return m
  }, [classChips])

  const formulaClassRows = useMemo(
    () =>
      draft.tokens
        .map((t, tokenIndex) => ({ t, tokenIndex }))
        .filter(
          (x): x is { t: { type: 'class'; class_id: number; label?: string }; tokenIndex: number } =>
            x.t.type === 'class',
        ),
    [draft.tokens],
  )

  const reloadTree = useCallback(() => {
    setTreeLoading(true)
    setErr(null)
    return fetchCalculationFormulaCategoryTree()
      .then((t) => setCfcTree(t))
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setTreeLoading(false))
  }, [])

  const reloadFormulas = useCallback(() => {
    setListLoading(true)
    const p =
      cfcSelected == null
        ? fetchCalculationFormulas()
        : fetchCalculationFormulas({ category: cfcSelected, subtree: true })
    return p
      .then((r) => {
        setFormulas((r.results ?? []).slice().sort((a, b) => a.name.localeCompare(b.name, 'ru')))
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => {
        setListLoading(false)
        setLoading(false)
      })
  }, [cfcSelected])

  const reloadShared = useCallback(() => {
    setLoading(true)
    setErr(null)
    return Promise.all([fetchMaterialClasses(), reloadTree()])
      .then(([mcRes]) => {
        setClassChips((mcRes.results ?? []).slice().sort((a, b) => a.name.localeCompare(b.name, 'ru')))
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
  }, [reloadTree])

  useEffect(() => {
    void reloadShared()
  }, [reloadShared])

  useEffect(() => {
    if (!formulaDeleteOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (!busy) setFormulaDeleteOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [formulaDeleteOpen, busy])

  useEffect(() => {
    setCfcExpandedIds((prev) => {
      if (prev.size > 0 || cfcTree.length === 0) return prev
      return collectCfcIdsWithChildren(cfcTree)
    })
  }, [cfcTree])

  useEffect(() => {
    if (cfcSelected != null) setCfcRootExpanded(true)
  }, [cfcSelected])

  useEffect(() => {
    if (cfcSelected == null) return
    const path = findPathToCfcId(cfcTree, cfcSelected)
    if (!path || path.length < 2) return
    setCfcExpandedIds((prev) => {
      const next = new Set(prev)
      for (const id of path.slice(0, -1)) next.add(id)
      return next
    })
  }, [cfcSelected, cfcTree])

  useEffect(() => {
    setLoading(true)
    void reloadFormulas()
  }, [reloadFormulas])

  const toggleCfcExpanded = useCallback((id: number) => {
    setCfcExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const renameCfcFolder = useCallback(
    (id: number, name: string) => {
      setErr(null)
      return updateCalculationFormulaCategory(id, { name })
        .then(() => reloadTree())
        .then(() => undefined)
        .catch((e) => {
          setErr(String(e))
          throw e
        })
    },
    [reloadTree],
  )

  const triggerCfcRenameSelected = useCallback(() => {
    if (cfcSelected == null) return
    setCfcFolderRenameRequest((r) => ({ targetId: cfcSelected, nonce: (r?.nonce ?? 0) + 1 }))
  }, [cfcSelected])

  const deleteCfcFolder = useCallback(() => {
    if (!selectedCfcCat) return
    if (
      !window.confirm(
        `Удалить папку «${selectedCfcCat.name}»? (Только если в ней нет формул и вложенных папок.)`,
      )
    ) {
      return
    }
    setBusy(true)
    setErr(null)
    deleteCalculationFormulaCategory(selectedCfcCat.id)
      .then(() => {
        setCfcSelected(null)
        return reloadTree()
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false))
  }, [selectedCfcCat, reloadTree])

  const submitNewCfcFolder = useCallback(() => {
    const name = newCfcFolderName.trim()
    if (!name) {
      setCfcCreateErr('Укажите имя папки.')
      return
    }
    setBusy(true)
    setCfcCreateErr(null)
    createCalculationFormulaCategory({ parent: cfcSelected, name, sort_order: 0 })
      .then(() => {
        setNewCfcFolderName('')
        setCfcFolderCreateOpen(false)
        return reloadTree()
      })
      .catch((e) => setCfcCreateErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false))
  }, [newCfcFolderName, cfcSelected, reloadTree])

  const appendToken = (token: CalculationFormulaToken) => {
    setDraft((d) => ({ ...d, tokens: [...d.tokens, token] }))
    setMsg(null)
  }

  const appendNumber = () => {
    const raw = numberValue.trim().replace(',', '.')
    if (!raw || Number.isNaN(Number(raw))) {
      setErr('Введите число для вставки в формулу.')
      return
    }
    appendToken({ type: 'number', value: raw })
    setNumberValue('')
    setErr(null)
  }

  const backspace = () => {
    setDraft((d) => ({ ...d, tokens: d.tokens.slice(0, -1) }))
    setMsg(null)
  }

  const clear = () => {
    setDraft((d) => ({ ...d, tokens: [] }))
    setMsg(null)
  }

  const removeTokenAt = (tokenIndex: number) => {
    setDraft((d) => ({ ...d, tokens: d.tokens.filter((_, i) => i !== tokenIndex) }))
    setMsg(null)
  }

  const resolveCategoryForSave = (): number | null => {
    if (draft.category != null) return draft.category
    const def = pickDefaultCalculationFormulaCategoryId(cfcTree)
    if (cfcSelected != null) return cfcSelected
    return def
  }

  const newFormula = () => {
    const def = pickDefaultCalculationFormulaCategoryId(cfcTree)
    setDraft({
      ...EMPTY_DRAFT,
      category: cfcSelected ?? def,
    })
    setNumberValue('')
    setErr(null)
    setMsg(null)
  }

  const openNewFormulaEditor = () => {
    newFormula()
    setEditorOpen(true)
  }

  const openFormulaEditor = (f: CalculationFormula) => {
    setDraft(draftFromFormula(f))
    setNumberValue('')
    setErr(null)
    setMsg(null)
    setEditorOpen(true)
  }

  const closeFormulaEditor = () => {
    setEditorOpen(false)
  }

  const save = async () => {
    const name = draft.name.trim()
    if (!name) {
      setErr('Укажите название формулы.')
      return
    }
    if (draft.tokens.length === 0) {
      setErr('Соберите формулу из классов, знаков и чисел.')
      return
    }
    const category = resolveCategoryForSave()
    if (category == null) {
      setErr('Не выбрана папка для формулы. Создайте папку слева или обновите страницу.')
      return
    }
    setBusy(true)
    setErr(null)
    setMsg(null)
    const payload = {
      name,
      category,
      tokens: draft.tokens,
      expression,
      is_active: true,
      sort_order: 0,
    }
    try {
      const saved = draft.id
        ? await updateCalculationFormula(draft.id, payload)
        : await createCalculationFormula(payload)
      await reloadFormulas()
      setDraft(draftFromFormula(saved))
      closeFormulaEditor()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const cancelFormulaDelete = () => setFormulaDeleteOpen(false)

  const confirmRemoveFormula = async () => {
    if (!draft.id) return
    setFormulaDeleteOpen(false)
    setBusy(true)
    setErr(null)
    try {
      await deleteCalculationFormula(draft.id)
      await reloadFormulas()
      newFormula()
      setEditorOpen(false)
      setMsg('Формула удалена.')
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div
        className="admin-body admin-calculations"
        id="admin-panel-calculations"
        role="tabpanel"
        aria-labelledby="admin-tab-calculations"
      >
        <aside className="admin-aside admin-calculations-list">
          <div className="admin-heading-row">
            <h2 className="admin-h2">Папки формул</h2>
          </div>
          <div className="admin-folder-toolbar" role="toolbar" aria-label="Действия с папками формул">
            <AdminFolderToolbarIcon
              label="Создать папку"
              disabled={busy}
              onClick={() => {
                setCfcCreateErr(null)
                setCfcFolderCreateOpen(true)
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 19h8a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-5l-1.33-1.5H5A1 1 0 0 0 4 6.5V18a1 1 0 0 0 1 1h7" />
                <path d="M12 11v6M9 14h6" />
              </svg>
            </AdminFolderToolbarIcon>
            <AdminFolderToolbarIcon
              label="Переименовать выбранную папку"
              disabled={busy || cfcSelected == null}
              onClick={triggerCfcRenameSelected}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
              </svg>
            </AdminFolderToolbarIcon>
            <AdminFolderToolbarIcon
              className="admin-folder-toolbar-btn--danger"
              label="Удалить выбранную папку"
              disabled={busy || selectedCfcCat == null}
              onClick={() => void deleteCfcFolder()}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6h12zM10 11v6M14 11v6" />
              </svg>
            </AdminFolderToolbarIcon>
          </div>
          {treeLoading ? <p className="admin-muted">Загрузка дерева…</p> : null}
          <ul className="folder-explorer-tree-root admin-materials-tree-root" aria-label="Дерево папок формул">
            <li className="folder-explorer-tree-item folder-explorer-tree-item--materials-root">
              <div
                className={
                  cfcSelected == null
                    ? 'folder-explorer-tree-line folder-explorer-tree-line--active'
                    : 'folder-explorer-tree-line'
                }
              >
                {cfcTree.length > 0 ? (
                  <button
                    type="button"
                    className="folder-explorer-tree-expander"
                    draggable={false}
                    aria-label={cfcRootExpanded ? 'Свернуть список папок' : 'Развернуть список папок'}
                    aria-expanded={cfcRootExpanded}
                    onClick={(e) => {
                      e.stopPropagation()
                      setCfcRootExpanded((v) => !v)
                    }}
                  >
                    <span aria-hidden>{cfcRootExpanded ? '▾' : '▸'}</span>
                  </button>
                ) : (
                  <span className="folder-explorer-tree-expander folder-explorer-tree-expander--spacer" aria-hidden />
                )}
                <button type="button" className="folder-explorer-tree-link" draggable={false} onClick={() => setCfcSelected(null)} title="База формул — показать все формулы">
                  <span className="folder-explorer-icon" aria-hidden>
                    🗂️
                  </span>
                  <span className="folder-explorer-tree-name">База формул</span>
                </button>
              </div>
              {cfcRootExpanded && cfcTree.length > 0 ? (
                <ul className="folder-explorer-tree-children">
                  {cfcTree.map((c) => (
                    <CfcTreeRow
                      key={c.id}
                      c={c}
                      depth={0}
                      selectedId={cfcSelected}
                      expandedIds={cfcExpandedIds}
                      onToggleExpanded={toggleCfcExpanded}
                      onSelect={setCfcSelected}
                      onRename={renameCfcFolder}
                      folderRenameRequest={cfcFolderRenameRequest}
                      onFolderRenameConsumed={clearCfcFolderRenameRequest}
                    />
                  ))}
                </ul>
              ) : null}
            </li>
          </ul>
        </aside>

        <div className="admin-main-col admin-calculations-editor">
          <main className="admin-main">
            <div className="admin-main-scroll">
              {err ? <div className="admin-error">{err}</div> : null}
              <div className="admin-heading-row">
                <h2 className="admin-h2">
                  {cfcSelected == null
                    ? 'Формулы: база формул'
                    : `Формулы в папке: ${selectedCfcCat?.name?.trim() || '—'}`}
                </h2>
              </div>
              <button type="button" className="admin-primary" onClick={openNewFormulaEditor}>
                + Формула
              </button>
              {editorOpen ? (
                <p className="admin-material-card-context" aria-live="polite">
                  {draft.id ? draft.name.trim() || '—' : 'Новая формула'}
                </p>
              ) : null}
              {listLoading ? <p className="admin-muted">Загрузка списка…</p> : null}
              {!listLoading && formulas.length === 0 ? (
                <p className="admin-muted">
                  {cfcSelected == null
                    ? 'Пока нет формул.'
                    : 'В этой папке (и вложенных) пока нет формул — нажмите «+ Формула».'}
                </p>
              ) : null}
              <div
                className="mat-list-table"
                aria-label={cfcSelected == null ? 'Список всех формул' : 'Список формул в папке и вложенных'}
              >
                <div className="mat-list-item-inner mat-list-item-inner--legend" role="row">
                  <div className="mat-list-legend" role="presentation">
                    {FORMULA_LIST_COLUMNS.map((label) => (
                      <span key={label} role="columnheader">
                        {label}
                      </span>
                    ))}
                  </div>
                  <span className="mat-list-legend-gear-slot" aria-hidden />
                </div>
                <ul className="mat-list">
                  {!listLoading &&
                    formulas.map((f) => {
                      const preview = truncateMiddle(formulaDisplayExpression(f.tokens), 64)
                      const rowCardOpen = editorOpen && draft.id === f.id
                      return (
                        <li key={f.id} className="mat-list-item">
                          <div className="mat-list-item-inner">
                            <div
                              className={rowCardOpen ? 'mat-list-row mat-list-row--active' : 'mat-list-row'}
                              aria-current={rowCardOpen ? 'true' : undefined}
                            >
                              <span className="mat-list-cell mat-list-cell-name">{f.name.trim() || '—'}</span>
                              <span className="mat-list-cell mat-list-cell-article">{preview || '—'}</span>
                            </div>
                            <button
                              type="button"
                              className="mat-list-gear-btn"
                              title="Открыть настройки формулы"
                              aria-label={`Настройки формулы: ${f.name || 'формула'}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                openFormulaEditor(f)
                              }}
                            >
                              {GEAR_SVG}
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
      </div>

      {editorOpen
        ? createPortal(
            <div
              className="admin-modal-backdrop"
              role="presentation"
              onClick={(e) => {
                if (e.target === e.currentTarget && !busy) closeFormulaEditor()
              }}
            >
              <section
                className="admin-panel admin-panel--in-material-modal admin-calculations-modal-surface admin-calculations-formula-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="formula-card-dialog-title"
                onClick={(e) => e.stopPropagation()}
              >
                  <div className="mat-form">
                    <div className="mat-form-head">
                      <div className="admin-heading-row mat-form-title-line">
                        <h3 id="formula-card-dialog-title" className="admin-h2">
                          {draft.id ? (draft.name.trim() || 'Формула') : 'Новая формула'}
                        </h3>
                      </div>
                      <button
                        type="button"
                        className="admin-primary admin-modal-head-icon-close"
                        aria-label="Закрыть"
                        title="Закрыть"
                        disabled={busy}
                        onClick={closeFormulaEditor}
                      >
                        {MODAL_CLOSE_X_SVG}
                      </button>
                    </div>
                    {err ? <div className="admin-error">{err}</div> : null}
                    {msg ? <p className="admin-muted">{msg}</p> : null}

                    <div className="admin-calculations-formula-modal-body">
                      <label className="field">
                        <span>Название</span>
                        <input
                          className="admin-input"
                          value={draft.name}
                          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                          placeholder="Например: Рамочный фасад"
                        />
                      </label>

                      <section className="admin-calculations-section-classes">
                        <div className="admin-heading-row">
                          <h2 className="admin-h2">Классы в формуле</h2>
                        </div>
                        <button
                          type="button"
                          className="admin-primary"
                          disabled={loading}
                          onClick={() => setClassPickOpen(true)}
                        >
                          + Класс
                        </button>
                        <div
                          className="mat-list-table admin-calculations-formula-classes-table"
                          aria-label="Классы, добавленные в формулу"
                        >
                          <div className="mat-list-item-inner mat-list-item-inner--legend" role="row">
                            <div className="mat-list-legend" role="presentation">
                              {FORMULA_CLASS_LIST_COLUMNS.map((label) => (
                                <span key={label} role="columnheader">
                                  {label}
                                </span>
                              ))}
                              <span className="mat-list-legend-formula-class-action" aria-hidden />
                            </div>
                          </div>
                          {formulaClassRows.length === 0 ? (
                            <p className="admin-muted admin-calculations-formula-classes-empty">
                              Добавьте классы кнопкой «+ Класс».
                            </p>
                          ) : (
                            <ul className="mat-list">
                              {formulaClassRows.map(({ t, tokenIndex }) => {
                                const mc = classById.get(t.class_id)
                                const code = (mc?.code ?? '').trim()
                                const name = mc?.name ?? t.label ?? `Класс #${t.class_id}`
                                return (
                                  <li key={tokenIndex} className="mat-list-item">
                                    <div className="mat-list-row admin-calculations-formula-class-row" role="row">
                                      <span className="mat-list-cell mat-list-cell-article">{code ? code : '—'}</span>
                                      <span className="mat-list-cell mat-list-cell-name">{name}</span>
                                      <button
                                        type="button"
                                        className="admin-primary admin-calculations-formula-class-remove admin-calculations-icon-btn"
                                        aria-label="Убрать класс из формулы"
                                        title="Убрать"
                                        onClick={() => removeTokenAt(tokenIndex)}
                                      >
                                        {MODAL_CLOSE_X_SVG}
                                      </button>
                                    </div>
                                  </li>
                                )
                              })}
                            </ul>
                          )}
                        </div>
                      </section>

                      <div className="admin-calculations-builder">
                        <section>
                          <h3 className="admin-calculations-subtitle">Знаки</h3>
                          <div className="admin-calculations-chip-row">
                            {OPS.map((op) => (
                              <button
                                key={op.value}
                                type="button"
                                className="admin-primary admin-calculations-icon-btn"
                                onClick={() => appendToken({ type: 'op', value: op.value })}
                              >
                                {op.label}
                              </button>
                            ))}
                            <input
                              className="admin-input admin-calculations-number"
                              value={numberValue}
                              onChange={(e) => setNumberValue(e.target.value.replace(/[^\d.,]/g, ''))}
                              placeholder="Число"
                              inputMode="decimal"
                            />
                            <button
                              type="button"
                              className="admin-primary admin-calculations-formula-insert-number"
                              onClick={appendNumber}
                            >
                              Вставить число
                            </button>
                          </div>
                        </section>
                      </div>

                      <section>
                        <div className="admin-calculations-output-head">
                          <h3 className="admin-calculations-subtitle">Поле формулы</h3>
                          <div>
                            <button
                              type="button"
                              className="admin-primary admin-calculations-icon-btn"
                              aria-label="Шаг назад в поле формулы"
                              title="Назад"
                              onClick={backspace}
                            >
                              {FORMULA_BACKSPACE_SVG}
                            </button>
                            <button
                              type="button"
                              className="admin-primary admin-calculations-icon-btn"
                              aria-label="Очистить поле формулы"
                              title="Очистить"
                              onClick={clear}
                            >
                              {FORMULA_CLEAR_SVG}
                            </button>
                          </div>
                        </div>
                        <div className="admin-calculations-output" aria-live="polite">
                          {expression || 'Добавляйте классы через «+ Класс», затем знаки и числа.'}
                        </div>
                      </section>
                    </div>

                    <div className="admin-row mat-form-actions">
                      {draft.id ? (
                        <button
                          type="button"
                          className="admin-secondary admin-danger"
                          disabled={busy}
                          onClick={() => setFormulaDeleteOpen(true)}
                        >
                          Удалить
                        </button>
                      ) : null}
                      <button type="button" className="admin-primary" disabled={busy || loading} onClick={() => void save()}>
                        {busy ? 'Сохранение…' : 'Сохранить'}
                      </button>
                    </div>
                  </div>
                </section>
            </div>,
            document.body,
          )
        : null}

      {formulaDeleteOpen && draft.id
        ? createPortal(
            <div
              className="admin-modal-backdrop admin-modal-backdrop--stack-top"
              role="dialog"
              aria-modal="true"
              aria-labelledby="formula-delete-title"
              onClick={(e) => {
                if (e.target === e.currentTarget && !busy) cancelFormulaDelete()
              }}
            >
              <div className="admin-modal" role="document" onClick={(e) => e.stopPropagation()}>
                <h4 id="formula-delete-title" className="admin-modal-title">
                  Удалить формулу расчёта?
                </h4>
                <p className="admin-modal-text">
                  Формула «{draft.name.trim() || '—'}» будет удалена безвозвратно везде, где используется: в
                  калькуляторе и связанных записях. Продолжить?
                </p>
                <div className="admin-modal-actions">
                  <button type="button" className="admin-secondary" disabled={busy} onClick={cancelFormulaDelete}>
                    Отмена
                  </button>
                  <button
                    type="button"
                    className="admin-primary admin-modal-confirm"
                    disabled={busy}
                    onClick={() => void confirmRemoveFormula()}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {classPickOpen ? (
        <MaterialClassPickModal
          onClose={() => setClassPickOpen(false)}
          onPick={(c) => {
            appendToken({ type: 'class', class_id: c.id, label: `Класс: ${c.name}` })
            setClassPickOpen(false)
          }}
        />
      ) : null}

      {cfcFolderCreateOpen
        ? createPortal(
            <div
              className="admin-modal-backdrop"
              role="dialog"
              aria-modal="true"
              aria-labelledby="cfc-folder-create-title"
              onClick={(e) => {
                if (e.target === e.currentTarget && !busy) {
                  setCfcFolderCreateOpen(false)
                  setCfcCreateErr(null)
                }
              }}
            >
              <div className="admin-modal" role="document" onClick={(e) => e.stopPropagation()}>
                <h4 id="cfc-folder-create-title" className="admin-modal-title">
                  Новая папка формул
                </h4>
                <p className="admin-modal-text">
                  Родитель: <strong>{cfcSelected == null ? 'корень' : selectedCfcCat?.name ?? '—'}</strong>
                </p>
                <label className="field">
                  <span>Имя папки</span>
                  <input
                    className="admin-input"
                    value={newCfcFolderName}
                    onChange={(e) => setNewCfcFolderName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        void submitNewCfcFolder()
                      }
                    }}
                    autoFocus
                  />
                </label>
                {cfcCreateErr ? <p className="admin-error">{cfcCreateErr}</p> : null}
                <div className="admin-modal-actions">
                  <button
                    type="button"
                    className="admin-secondary"
                    disabled={busy}
                    onClick={() => {
                      setCfcFolderCreateOpen(false)
                      setCfcCreateErr(null)
                    }}
                  >
                    Отмена
                  </button>
                  <button type="button" className="admin-primary" disabled={busy} onClick={() => void submitNewCfcFolder()}>
                    {busy ? 'Создание…' : 'Создать'}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
