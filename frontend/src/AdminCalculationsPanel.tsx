import { createPortal } from 'react-dom'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
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
import { AdminPanelLoadingHost, PanelLoadingFlags } from './AdminPanelLoadingHost'
import type {
  CalculationFormula,
  CalculationFormulaCategory,
  CalculationFormulaToken,
  MaterialClass,
} from './types'
import {
  formulaDisplayExpression,
  formulaTokenDisplayLabel,
  materialClassFormulaTokenLabel,
  syncClassTokenLabels,
} from './calculator/calculationFormula'
import { MaterialClassPickerBody } from './MaterialClassPickModal'

type Draft = {
  id: number | null
  name: string
  tokens: CalculationFormulaToken[]
  category: number | null
  is_active: boolean
}

const EMPTY_DRAFT: Draft = {
  id: null,
  name: '',
  tokens: [],
  category: null,
  is_active: true,
}

/** Список формул в основной колонке (как таблица материалов). */
const FORMULA_LIST_COLUMNS = ['Наименование', 'Формула'] as const

function truncateMiddle(text: string, maxLen: number): string {
  const t = text.trim()
  if (t.length <= maxLen) return t
  if (maxLen < 5) return t.slice(0, maxLen)
  const head = Math.ceil((maxLen - 1) / 2)
  const tail = Math.floor((maxLen - 1) / 2)
  return `${t.slice(0, head)}…${t.slice(t.length - tail)}`
}

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

type FormulaOp = '+' | '-' | '*' | '/' | '(' | ')' | '='

const FORMULA_KEYPAD_OPS = new Set<FormulaOp>(['+', '-', '*', '/', '(', ')', '='])

function isFormulaDigitKey(key: string): boolean {
  return /^\d$/.test(key) || key === '.'
}

function isFormulaOpKey(key: string): key is FormulaOp {
  return FORMULA_KEYPAD_OPS.has(key as FormulaOp)
}

type CalcKeypadCell =
  | { kind: 'digit'; value: string; label?: string; colSpan?: number }
  | { kind: 'op'; value: FormulaOp; colSpan?: number }
  | { kind: 'backspace' }
  | { kind: 'clear' }

/** 789/ 456* 123- 0() +  затем . · назад · очистить · = */
const CALC_KEYPAD_ROWS: ReadonlyArray<readonly CalcKeypadCell[]> = [
  [
    { kind: 'digit', value: '7' },
    { kind: 'digit', value: '8' },
    { kind: 'digit', value: '9' },
    { kind: 'op', value: '/' },
  ],
  [
    { kind: 'digit', value: '4' },
    { kind: 'digit', value: '5' },
    { kind: 'digit', value: '6' },
    { kind: 'op', value: '*' },
  ],
  [
    { kind: 'digit', value: '1' },
    { kind: 'digit', value: '2' },
    { kind: 'digit', value: '3' },
    { kind: 'op', value: '-' },
  ],
  [
    { kind: 'digit', value: '0' },
    { kind: 'op', value: '(' },
    { kind: 'op', value: ')' },
    { kind: 'op', value: '+' },
  ],
  [
    { kind: 'digit', value: '.' },
    { kind: 'backspace' },
    { kind: 'clear' },
    { kind: 'op', value: '=' },
  ],
]

type CfcRenameRequest = { targetId: number; nonce: number }

type FormulaEditResult = { tokens: CalculationFormulaToken[]; cursor: number }

function formulaBackspaceEnd(tokens: CalculationFormulaToken[]): FormulaEditResult {
  if (tokens.length === 0) return { tokens, cursor: 0 }
  const next = [...tokens]
  const lastIdx = next.length - 1
  const last = next[lastIdx]
  if (last?.type === 'number' && last.value.length > 1) {
    next[lastIdx] = { type: 'number', value: last.value.slice(0, -1) }
    return { tokens: next, cursor: next.length }
  }
  next.splice(lastIdx, 1)
  return { tokens: next, cursor: next.length }
}

function formulaInsertDigit(tokens: CalculationFormulaToken[], cursor: number, key: string): FormulaEditResult {
  const next = [...tokens]

  if (key === '.' || key === ',') {
    const prevNum = next[cursor - 1]
    if (prevNum?.type === 'number') {
      const norm = prevNum.value.replace(',', '.')
      if (norm.includes('.')) return { tokens, cursor }
      next[cursor - 1] = { type: 'number', value: `${norm}.` }
      return { tokens: next, cursor }
    }
    next.splice(cursor, 0, { type: 'number', value: '0.' })
    return { tokens: next, cursor: cursor + 1 }
  }

  if (!/^\d$/.test(key)) return { tokens, cursor }

  if (next[cursor - 1]?.type === 'number') {
    const prev = next[cursor - 1]
    if (prev.type !== 'number') return { tokens, cursor }
    const norm = prev.value.replace(',', '.')
    const hasDec = norm.includes('.')
    const value =
      !hasDec && /^0+$/.test(norm) ? (key === '0' ? '0' : key) : `${prev.value}${key}`
    next[cursor - 1] = { type: 'number', value }
    return { tokens: next, cursor }
  }

  if (next[cursor]?.type === 'number') {
    const nxt = next[cursor]
    if (nxt.type !== 'number') return { tokens, cursor }
    const norm = nxt.value.replace(',', '.')
    const hasDec = norm.includes('.')
    const value =
      !hasDec && /^0+$/.test(norm) ? (key === '0' ? '0' : key) : `${key}${nxt.value}`
    next[cursor] = { type: 'number', value }
    return { tokens: next, cursor }
  }

  next.splice(cursor, 0, { type: 'number', value: key })
  return { tokens: next, cursor: cursor + 1 }
}

function formulaInsertOp(
  tokens: CalculationFormulaToken[],
  cursor: number,
  op: FormulaOp,
): FormulaEditResult {
  const next = [...tokens]
  next.splice(cursor, 0, { type: 'op', value: op })
  return { tokens: next, cursor: cursor + 1 }
}

function formulaInsertToken(
  tokens: CalculationFormulaToken[],
  cursor: number,
  token: CalculationFormulaToken,
): FormulaEditResult {
  const next = [...tokens]
  next.splice(cursor, 0, token)
  return { tokens: next, cursor: cursor + 1 }
}

function formulaStringPosToTokenCursor(tokens: CalculationFormulaToken[], strPos: number): number {
  if (tokens.length === 0 || strPos <= 0) return 0
  let pos = 0
  for (let i = 0; i < tokens.length; i++) {
    const label = formulaTokenDisplayLabel(tokens[i])
    if (strPos <= pos) return i
    const segmentEnd = pos + label.length
    if (strPos <= segmentEnd) {
      const mid = pos + label.length / 2
      return strPos <= mid ? i : i + 1
    }
    pos = segmentEnd
  }
  return tokens.length
}

type StringFormulaEditResult = {
  tokens: CalculationFormulaToken[]
  strPos: number
}

function formulaBackspaceAtStringPos(
  tokens: CalculationFormulaToken[],
  strPos: number,
): StringFormulaEditResult {
  if (strPos <= 0) return { tokens, strPos: 0 }
  const delPos = strPos - 1
  let pos = 0
  const next = [...tokens]
  for (let i = 0; i < next.length; i++) {
    const label = formulaTokenDisplayLabel(next[i])
    const start = pos
    const end = pos + label.length
    if (delPos >= start && delPos < end) {
      const t = next[i]
      if (t.type === 'number') {
        const charIdx = delPos - start
        const newValue = `${t.value.slice(0, charIdx)}${t.value.slice(charIdx + 1)}`
        if (!newValue || newValue === '.') {
          next.splice(i, 1)
          return { tokens: next, strPos: start }
        }
        next[i] = { type: 'number', value: newValue }
        return { tokens: next, strPos: delPos }
      }
      next.splice(i, 1)
      return { tokens: next, strPos: start }
    }
    pos = end
  }
  return { tokens, strPos: delPos }
}

function formulaDeleteStringRange(
  tokens: CalculationFormulaToken[],
  start: number,
  end: number,
): StringFormulaEditResult {
  if (start >= end) return { tokens, strPos: start }
  let current = tokens
  let pos = end
  while (pos > start) {
    const result = formulaBackspaceAtStringPos(current, pos)
    current = result.tokens
    pos = result.strPos
  }
  return { tokens: current, strPos: start }
}

function formulaPrepareInsertAtStringPos(
  tokens: CalculationFormulaToken[],
  strPos: number,
): { tokens: CalculationFormulaToken[]; tokenCursor: number; strPos: number } {
  let pos = 0
  for (let i = 0; i < tokens.length; i++) {
    const label = formulaTokenDisplayLabel(tokens[i])
    const start = pos
    const end = pos + label.length
    if (strPos <= start) return { tokens, tokenCursor: i, strPos: start }
    if (strPos < end) {
      const t = tokens[i]
      if (t.type === 'number') {
        const charIdx = strPos - start
        if (charIdx <= 0) return { tokens, tokenCursor: i, strPos: start }
        if (charIdx >= t.value.length) return { tokens, tokenCursor: i + 1, strPos: end }
        const left = t.value.slice(0, charIdx)
        const right = t.value.slice(charIdx)
        const next = [...tokens]
        const replacement: CalculationFormulaToken[] = []
        if (left) replacement.push({ type: 'number', value: left })
        if (right) replacement.push({ type: 'number', value: right })
        next.splice(i, 1, ...replacement)
        const tokenCursor = i + (left ? 1 : 0)
        return { tokens: next, tokenCursor, strPos: start + (left ? left.length : 0) }
      }
      const tokenCursor = strPos - start <= label.length / 2 ? i : i + 1
      return { tokens, tokenCursor, strPos: tokenCursor === i ? start : end }
    }
    pos = end
  }
  return { tokens, tokenCursor: tokens.length, strPos: pos }
}

function formulaInsertDigitAtStringPos(
  tokens: CalculationFormulaToken[],
  strPos: number,
  key: string,
): StringFormulaEditResult {
  let pos = 0
  for (let i = 0; i < tokens.length; i++) {
    const label = formulaTokenDisplayLabel(tokens[i])
    const start = pos
    const end = pos + label.length
    if (strPos > start && strPos < end && tokens[i].type === 'number') {
      const charIdx = strPos - start
      const next = [...tokens]
      const t = next[i]
      if (t.type !== 'number') break
      if (key === '.' || key === ',') {
        const norm = t.value.replace(',', '.')
        if (norm.includes('.')) return { tokens, strPos }
        const newValue = `${t.value.slice(0, charIdx)}.${t.value.slice(charIdx)}`
        next[i] = { type: 'number', value: newValue }
        return { tokens: next, strPos: strPos + 1 }
      }
      if (/^\d$/.test(key)) {
        const newValue = `${t.value.slice(0, charIdx)}${key}${t.value.slice(charIdx)}`
        next[i] = { type: 'number', value: newValue }
        return { tokens: next, strPos: strPos + 1 }
      }
      return { tokens, strPos }
    }
    if (strPos <= start) break
    pos = end
  }
  const prepared = formulaPrepareInsertAtStringPos(tokens, strPos)
  const result = formulaInsertDigit(prepared.tokens, prepared.tokenCursor, key)
  const oldLen = formulaDisplayExpression(tokens).length
  const newLen = formulaDisplayExpression(result.tokens).length
  return { tokens: result.tokens, strPos: prepared.strPos + (newLen - oldLen) }
}

function formulaInsertOpAtStringPos(
  tokens: CalculationFormulaToken[],
  strPos: number,
  op: FormulaOp,
): StringFormulaEditResult {
  const prepared = formulaPrepareInsertAtStringPos(tokens, strPos)
  const result = formulaInsertOp(prepared.tokens, prepared.tokenCursor, op)
  const oldLen = formulaDisplayExpression(tokens).length
  const newLen = formulaDisplayExpression(result.tokens).length
  return { tokens: result.tokens, strPos: prepared.strPos + (newLen - oldLen) }
}

function formulaInsertClassAtStringPos(
  tokens: CalculationFormulaToken[],
  strPos: number,
  token: CalculationFormulaToken,
): StringFormulaEditResult {
  const prepared = formulaPrepareInsertAtStringPos(tokens, strPos)
  const result = formulaInsertToken(prepared.tokens, prepared.tokenCursor, token)
  const oldLen = formulaDisplayExpression(tokens).length
  const newLen = formulaDisplayExpression(result.tokens).length
  return { tokens: result.tokens, strPos: prepared.strPos + (newLen - oldLen) }
}

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

function draftFromFormula(
  f: CalculationFormula,
  classesById?: ReadonlyMap<number, MaterialClass>,
): Draft {
  const raw = f.tokens ?? []
  const tokens =
    classesById && classesById.size > 0 ? syncClassTokenLabels(raw, classesById) : raw
  return {
    id: f.id,
    name: f.name,
    tokens,
    category: f.category,
    is_active: f.is_active,
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

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const formulaCursorRef = useRef(0)
  const formulaInputRef = useRef<HTMLInputElement>(null)
  const formulaBackdropDownRef = useRef(false)
  const [formulaStringCursor, setFormulaStringCursor] = useState(0)
  const formulaStringCursorRef = useRef(0)
  const [treeLoading, setTreeLoading] = useState(true)
  const [listLoading, setListLoading] = useState(true)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [formulaDeleteOpen, setFormulaDeleteOpen] = useState(false)
  const [materialClassesById, setMaterialClassesById] = useState<Map<number, MaterialClass>>(
    () => new Map(),
  )

  const expression = useMemo(() => formulaDisplayExpression(draft.tokens), [draft.tokens])

  const selectedCfcCat = useMemo(
    () => (cfcSelected == null ? null : findCfcNode(cfcTree, cfcSelected)),
    [cfcTree, cfcSelected],
  )

  /** Подсветка строк в списке классов — какие id уже есть среди токенов формулы */
  const formulaSelectedClassIds = useMemo(
    () =>
      draft.tokens
        .filter((t): t is { type: 'class'; class_id: number } => t.type === 'class')
        .map((t) => Number(t.class_id)),
    [draft.tokens],
  )

  useEffect(() => {
    let cancelled = false
    fetchMaterialClasses()
      .then((r) => {
        if (cancelled) return
        const m = new Map<number, MaterialClass>()
        for (const c of r.results ?? []) m.set(c.id, c)
        setMaterialClassesById(m)
      })
      .catch(() => {
        if (!cancelled) setMaterialClassesById(new Map())
      })
    return () => {
      cancelled = true
    }
  }, [])

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
    return reloadTree().catch((e) => setErr(e instanceof Error ? e.message : String(e)))
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

  const setFormulaCaret = useCallback((pos: number) => {
    formulaCursorRef.current = pos
  }, [])

  const setFormulaStringCaret = useCallback((pos: number) => {
    formulaStringCursorRef.current = pos
    setFormulaStringCursor(pos)
  }, [])

  const getActiveStringCursor = useCallback((): number => {
    const el = formulaInputRef.current
    if (el && document.activeElement === el) {
      const pos = el.selectionStart ?? formulaStringCursorRef.current
      formulaStringCursorRef.current = pos
      return pos
    }
    return formulaStringCursorRef.current
  }, [])

  const applyFormulaStringEdit = useCallback(
    (edit: (tokens: CalculationFormulaToken[], strPos: number) => StringFormulaEditResult) => {
      setErr(null)
      setDraft((d) => {
        const strPos = getActiveStringCursor()
        const { tokens, strPos: newStrPos } = edit(d.tokens, strPos)
        formulaStringCursorRef.current = newStrPos
        setFormulaStringCursor(newStrPos)
        formulaCursorRef.current = formulaStringPosToTokenCursor(tokens, newStrPos)
        return { ...d, tokens }
      })
      setMsg(null)
    },
    [getActiveStringCursor],
  )

  const insertClassToken = useCallback(
    (c: MaterialClass) => {
      applyFormulaStringEdit((tokens, strPos) =>
        formulaInsertClassAtStringPos(tokens, strPos, {
          type: 'class',
          class_id: c.id,
          label: materialClassFormulaTokenLabel(c),
        }),
      )
    },
    [applyFormulaStringEdit],
  )

  const appendDigitToFormula = useCallback(
    (key: string) => {
      applyFormulaStringEdit((tokens, strPos) => formulaInsertDigitAtStringPos(tokens, strPos, key))
    },
    [applyFormulaStringEdit],
  )

  const insertOpToken = useCallback(
    (op: FormulaOp) => {
      applyFormulaStringEdit((tokens, strPos) => formulaInsertOpAtStringPos(tokens, strPos, op))
    },
    [applyFormulaStringEdit],
  )

  const backspaceAtCursor = useCallback(() => {
    applyFormulaStringEdit((tokens, strPos) => formulaBackspaceAtStringPos(tokens, strPos))
  }, [applyFormulaStringEdit])

  const backspaceEnd = () => {
    setErr(null)
    setDraft((d) => {
      const { tokens, cursor } = formulaBackspaceEnd(d.tokens)
      const endPos = formulaDisplayExpression(tokens).length
      formulaStringCursorRef.current = endPos
      setFormulaStringCursor(endPos)
      formulaCursorRef.current = cursor
      return { ...d, tokens }
    })
    setMsg(null)
  }

  const syncFormulaStringCursorFromInput = useCallback(() => {
    const el = formulaInputRef.current
    if (!el) return
    const pos = el.selectionStart ?? 0
    formulaStringCursorRef.current = pos
    setFormulaStringCursor(pos)
  }, [])

  const onFormulaInputKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      const el = e.currentTarget
      const start = el.selectionStart ?? 0
      const end = el.selectionEnd ?? 0
      formulaStringCursorRef.current = start
      if (start !== end) {
        applyFormulaStringEdit((tokens) => formulaDeleteStringRange(tokens, start, end))
      } else {
        backspaceAtCursor()
      }
      return
    }
    if (
      e.key === 'ArrowLeft' ||
      e.key === 'ArrowRight' ||
      e.key === 'ArrowUp' ||
      e.key === 'ArrowDown' ||
      e.key === 'Home' ||
      e.key === 'End'
    ) {
      requestAnimationFrame(() => syncFormulaStringCursorFromInput())
      return
    }
    if (e.key === 'Delete') {
      e.preventDefault()
      return
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V' || e.key === 'x' || e.key === 'X')) {
      e.preventDefault()
      return
    }
    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      if (isFormulaDigitKey(e.key)) {
        e.preventDefault()
        appendDigitToFormula(e.key)
        return
      }
      if (isFormulaOpKey(e.key)) {
        e.preventDefault()
        insertOpToken(e.key)
        return
      }
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
    }
  }

  const onFormulaInputBeforeInput = (e: FormEvent<HTMLInputElement>) => {
    const inputType = (e.nativeEvent as InputEvent).inputType
    if (inputType === 'deleteContentBackward') return
    if (inputType.startsWith('insert') || inputType.startsWith('delete')) {
      e.preventDefault()
    }
  }

  useEffect(() => {
    if (!editorOpen) return
    const el = formulaInputRef.current
    if (!el || document.activeElement !== el) return
    const pos = formulaStringCursorRef.current
    el.setSelectionRange(pos, pos)
  }, [editorOpen, draft.tokens, formulaStringCursor, expression])

  const clear = () => {
    setDraft((d) => ({ ...d, tokens: [] }))
    setFormulaCaret(0)
    setFormulaStringCaret(0)
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
    setFormulaCaret(0)
    setFormulaStringCaret(0)
    setErr(null)
    setMsg(null)
  }

  const openNewFormulaEditor = () => {
    newFormula()
    setEditorOpen(true)
  }

  const openFormulaEditor = (f: CalculationFormula) => {
    const next = draftFromFormula(f, materialClassesById)
    setDraft(next)
    const endPos = formulaDisplayExpression(next.tokens).length
    setFormulaCaret(next.tokens.length)
    setFormulaStringCaret(endPos)
    setErr(null)
    setMsg(null)
    setEditorOpen(true)
  }

  const closeFormulaEditor = () => {
    setEditorOpen(false)
  }

  const onFormulaBackdropPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    formulaBackdropDownRef.current = e.target === e.currentTarget
  }

  const onFormulaBackdropPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (formulaBackdropDownRef.current && e.target === e.currentTarget && !busy) {
      closeFormulaEditor()
    }
    formulaBackdropDownRef.current = false
  }

  const save = async () => {
    if (draft.tokens.length === 0) {
      setErr('Соберите формулу из классов, знаков и чисел.')
      return
    }
    const name = draft.name.trim() || expression.trim() || 'Формула'
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
      is_active: draft.is_active,
      sort_order: 0,
    }
    try {
      const saved = draft.id
        ? await updateCalculationFormula(draft.id, payload)
        : await createCalculationFormula(payload)
      await reloadFormulas()
      setDraft(draftFromFormula(saved, materialClassesById))
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
      <AdminPanelLoadingHost
        className="admin-body admin-calculations"
        id="admin-panel-calculations"
        role="tabpanel"
        aria-labelledby="admin-tab-calculations"
        ariaLabel="Загрузка формул"
      >
        <PanelLoadingFlags tree={treeLoading} list={listLoading} data={loading} />
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
                              role="button"
                              tabIndex={0}
                              aria-current={rowCardOpen ? 'true' : undefined}
                              aria-label={`Редактировать формулу: ${f.name.trim() || 'формула'}`}
                              onClick={() => openFormulaEditor(f)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  openFormulaEditor(f)
                                }
                              }}
                            >
                              <span className="mat-list-cell mat-list-cell-name">{f.name.trim() || '—'}</span>
                              <span className="mat-list-cell mat-list-cell-article">{preview || '—'}</span>
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
      </AdminPanelLoadingHost>

      {editorOpen
        ? createPortal(
            <div
              className="admin-modal-backdrop"
              role="presentation"
              onPointerDown={onFormulaBackdropPointerDown}
              onPointerUp={onFormulaBackdropPointerUp}
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
                        <input
                          id="formula-card-dialog-title"
                          className="admin-input mat-form-title-input"
                          type="text"
                          value={draft.name}
                          placeholder={draft.id ? 'Наименование формулы' : 'Новая формула'}
                          aria-label="Наименование формулы"
                          disabled={busy}
                          autoFocus={!draft.id}
                          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                        />
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
                      <div className="admin-calculations-formula-editor-row">
                        <section className="admin-calculations-section-classes">
                          <div className="admin-heading-row">
                            <h2 className="admin-h2">Классы для формулы</h2>
                          </div>
                          <div className="admin-calculations-picker-keypad-row">
                            <MaterialClassPickerBody
                              onPick={(c) => insertClassToken(c)}
                              selectedClassIds={formulaSelectedClassIds}
                              autoFocusSearch={false}
                              hidePickChrome
                            />
                            <div className="admin-calculations-builder">
                              <section className="admin-calculations-keypad-section">
                                <div className="admin-calculations-keypad">
                                  <div
                                    className="admin-calculations-keypad-grid"
                                    role="group"
                                    aria-label="Цифры и знаки формулы"
                                  >
                                    {CALC_KEYPAD_ROWS.flatMap((row, ri) =>
                                      row.map((cell, ci) => {
                                        const key = `${ri}-${ci}-${cell.kind}`
                                        const spanStyle =
                                          'colSpan' in cell && cell.colSpan && cell.colSpan > 1
                                            ? { gridColumn: `span ${cell.colSpan}` }
                                            : undefined
                                        if (cell.kind === 'digit') {
                                          const label = cell.label ?? cell.value
                                          const isDot = cell.value === '.'
                                          return (
                                            <button
                                              key={key}
                                              type="button"
                                              style={spanStyle}
                                              className={`admin-calculations-keypad-key${
                                                isDot
                                                  ? ' admin-calculations-keypad-key--op'
                                                  : ' admin-calculations-keypad-key--digit'
                                              }`}
                                              aria-label={
                                                isDot ? 'Десятичная точка' : `Цифра ${label}`
                                              }
                                              onClick={() => appendDigitToFormula(cell.value)}
                                            >
                                              {label}
                                            </button>
                                          )
                                        }
                                        if (cell.kind === 'backspace') {
                                          return (
                                            <button
                                              key={key}
                                              type="button"
                                              style={spanStyle}
                                              className="admin-calculations-keypad-key admin-calculations-keypad-key--op admin-calculations-keypad-action-btn"
                                              aria-label="Удалить последний символ или класс"
                                              title="Назад"
                                              onClick={backspaceEnd}
                                            >
                                              {FORMULA_BACKSPACE_SVG}
                                            </button>
                                          )
                                        }
                                        if (cell.kind === 'clear') {
                                          return (
                                            <button
                                              key={key}
                                              type="button"
                                              style={spanStyle}
                                              className="admin-calculations-keypad-key admin-calculations-keypad-key--op admin-calculations-keypad-action-btn"
                                              aria-label="Очистить поле формулы"
                                              title="Очистить"
                                              onClick={clear}
                                            >
                                              {FORMULA_CLEAR_SVG}
                                            </button>
                                          )
                                        }
                                        const isParen = cell.value === '(' || cell.value === ')'
                                        return (
                                          <button
                                            key={key}
                                            type="button"
                                            style={spanStyle}
                                            className={`admin-calculations-keypad-key${
                                              isParen
                                                ? ' admin-calculations-keypad-key--digit'
                                                : ' admin-calculations-keypad-key--op'
                                            }${
                                              'colSpan' in cell && cell.colSpan && cell.colSpan > 1
                                                ? ' admin-calculations-keypad-key--wide'
                                                : ''
                                            }`}
                                            aria-label={`Знак ${cell.value}`}
                                            onClick={() => insertOpToken(cell.value)}
                                          >
                                            {cell.value}
                                          </button>
                                        )
                                      }),
                                    )}
                                  </div>
                                </div>
                              </section>
                            </div>
                          </div>
                        </section>
                      </div>

                      <section>
                        <div className="admin-calculations-output-head">
                          <h3 className="admin-calculations-subtitle">Поле формулы</h3>
                        </div>
                        <input
                          ref={formulaInputRef}
                          type="text"
                          className="admin-input admin-calculations-output admin-calculations-output--text"
                          value={expression}
                          aria-label="Поле формулы"
                          aria-live="polite"
                          placeholder="Цифры и знаки: 0–9 . + - * / ( ) = — ввод с клавиатуры или keypad справа. Классы — из списка слева."
                          disabled={busy}
                          onKeyDown={onFormulaInputKeyDown}
                          onBeforeInput={onFormulaInputBeforeInput}
                          onClick={syncFormulaStringCursorFromInput}
                          onSelect={syncFormulaStringCursorFromInput}
                          onChange={() => {}}
                        />
                      </section>
                    </div>

                    <label className="mat-form-rounding-check-wrap admin-calculations-active-flag">
                      <input
                        type="checkbox"
                        checked={draft.is_active}
                        disabled={busy}
                        onChange={(e) => setDraft((d) => ({ ...d, is_active: e.target.checked }))}
                      />
                      <span>Активна (участвует в расчёте калькулятора)</span>
                    </label>

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
                <div className="admin-row mat-form-actions">
                  <button type="button" className="admin-secondary" disabled={busy} onClick={cancelFormulaDelete}>
                    Отмена
                  </button>
                  <button
                    type="button"
                    className="admin-primary"
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

      {cfcFolderCreateOpen
        ? createPortal(
            <div
              className="admin-modal-backdrop"
              role="presentation"
              onClick={(e) => {
                if (e.target === e.currentTarget && !busy) {
                  setCfcFolderCreateOpen(false)
                  setCfcCreateErr(null)
                }
              }}
            >
              <section
                className="admin-panel admin-panel--in-material-modal admin-calculations-modal-surface admin-modal--material-card admin-material-card-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="cfc-folder-create-title"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mat-form">
                  <div className="mat-form-head">
                    <div className="admin-heading-row mat-form-title-line">
                      <h3 id="cfc-folder-create-title" className="admin-h2">
                        Новая папка формул
                      </h3>
                    </div>
                    <button
                      type="button"
                      className="admin-primary admin-modal-head-icon-close"
                      aria-label="Закрыть"
                      title="Закрыть"
                      disabled={busy}
                      onClick={() => {
                        setCfcFolderCreateOpen(false)
                        setCfcCreateErr(null)
                      }}
                    >
                      {MODAL_CLOSE_X_SVG}
                    </button>
                  </div>
                  {cfcCreateErr ? <div className="admin-error">{cfcCreateErr}</div> : null}
                  <div className="mat-form-tab-panel" role="region" aria-label="Новая папка формул">
                    <p className="admin-modal-text mat-form-field-span-2">
                      Родитель:{' '}
                      <strong>{cfcSelected == null ? 'корень' : selectedCfcCat?.name ?? '—'}</strong>
                    </p>
                    <label className="field mat-form-field-span-2">
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
                    <div className="admin-row mat-form-actions">
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
                      <button
                        type="button"
                        className="admin-primary"
                        disabled={busy}
                        onClick={() => void submitNewCfcFolder()}
                      >
                        {busy ? 'Создание…' : 'Создать'}
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
