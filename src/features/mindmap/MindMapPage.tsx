import {
  applyNodeChanges, Background, BackgroundVariant, ConnectionMode, MarkerType, MiniMap, ReactFlow, ReactFlowProvider, useReactFlow,
  type Connection, type Edge, type Node, type NodeChange,
} from '@xyflow/react'
import { Check, Maximize, Minus, Plus, StickyNote, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { TagChip } from '@/features/board/CardTile'
import { useBoard, useBoardActions } from '@/features/board/hooks'
import { emptyBoard, type LinkKind } from '@/features/board/types'
import { plainText } from '@/features/blitz/checklist'
import { cardHref, navigate } from '@/lib/router'
import { cn } from '@/lib/utils'
import { buildGraph, layoutGraph, type GEdge, type Scope } from './graph'
import { CardNode, FreeNode, type CardNodeData, type FreeNodeData } from './Nodes'
import './mindmap.css'

const nodeTypes = { card: CardNode, free: FreeNode }
type ScopeKind = Scope['kind']

export function MindMapPage() {
  return (
    <ReactFlowProvider>
      <MapCanvas />
    </ReactFlowProvider>
  )
}

const EMPTY = emptyBoard()

function MapCanvas() {
  const { t } = useTranslation()
  const { data } = useBoard()
  const act = useBoardActions()
  const rf = useReactFlow()
  const wrap = useRef<HTMLDivElement>(null)

  const [scopeKind, setScopeKind] = useState<ScopeKind>('all')
  const [focusId, setFocusId] = useState<string | null>(null) // card the neighbourhood is centred on
  const [tagId, setTagId] = useState<string | null>(null)
  const [selNode, setSelNode] = useState<string | null>(null)
  const [selEdge, setSelEdge] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const savedTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [nodes, setNodes] = useState<Node[]>([])
  const [lastSig, setLastSig] = useState<string | null>(null)

  const scope = useMemo<Scope>(
    () =>
      scopeKind === 'neighbourhood' && focusId ? { kind: 'neighbourhood', cardId: focusId }
      : scopeKind === 'tag' && tagId ? { kind: 'tag', tagId }
      : { kind: 'all' },
    [scopeKind, focusId, tagId],
  )
  const graph = useMemo(() => buildGraph(data ?? EMPTY, scope), [data, scope])

  const safe = (p: Promise<unknown>) => void p.catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  const flashSaved = () => {
    setSaved(true)
    clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setSaved(false), 1800)
  }

  // Structure (which nodes exist, their labels and saved positions) syncs into React Flow's state while
  // rendering; dragging and measuring then update that state directly.
  const sig = graph.nodes.map((n) => `${n.id}:${n.label}:${n.tagColorIndex}:${n.saved ? `${n.saved.x},${n.saved.y}` : ''}`).join('|')
  if (sig !== lastSig) {
    setLastSig(sig)
    const layout = layoutGraph(graph)
    setNodes((prev) => {
      const old = new Map(prev.map((n) => [n.id, n]))
      return graph.nodes.map((g) => ({
        ...(old.get(g.id) ?? {}),
        id: g.id,
        type: g.kind,
        position: g.saved ?? old.get(g.id)?.position ?? layout[g.id],
        data: { label: g.label, tagColorIndex: g.tagColorIndex } as Record<string, unknown>,
      }))
    })
  }

  // Fit the view when the scope changes or the first nodes arrive.
  const fitKey = `${scopeKind}:${scope.kind === 'neighbourhood' ? scope.cardId : scope.kind === 'tag' ? scope.tagId : ''}:${graph.nodes.length > 0}`
  useEffect(() => {
    const id = requestAnimationFrame(() => void rf.fitView({ padding: 0.25, duration: 300, maxZoom: 1.1 }))
    return () => cancelAnimationFrame(id)
  }, [fitKey, rf])

  // ---- selection, dimming
  const selectedGNode = graph.nodes.find((n) => n.id === selNode)
  const selectedEdgeObj = graph.edges.find((e) => e.id === selEdge)
  const litIds = new Set<string>()
  if (selNode) {
    litIds.add(selNode)
    for (const e of graph.edges) {
      if (e.source === selNode) litIds.add(e.target)
      if (e.target === selNode) litIds.add(e.source)
    }
  }
  const dimming = selNode !== null

  const viewNodes: Node[] = nodes.map((n) => {
    const g = graph.nodes.find((x) => x.id === n.id)
    const base = (n.data ?? {}) as Record<string, unknown>
    const dim = dimming && !litIds.has(n.id)
    if (g?.kind === 'free') {
      const data: FreeNodeData = {
        label: g.label, editing: editing === n.id, dim,
        onLabel: (label) => g.mapNodeId && safe(act.saveMapNode({ id: g.mapNodeId, card_id: null, x: n.position.x, y: n.position.y, label }).then(flashSaved)),
        onDone: () => setEditing(null),
      }
      return { ...n, selected: selNode === n.id, data }
    }
    const data: CardNodeData = { label: String(base.label ?? ''), tagColorIndex: (base.tagColorIndex as number | null) ?? null, dim, lit: dimming && litIds.has(n.id) && selNode !== n.id }
    return { ...n, selected: selNode === n.id, data }
  })

  const viewEdges: Edge[] = graph.edges.map((e: GEdge) => {
    const touches = selNode !== null && (e.source === selNode || e.target === selNode)
    return {
      id: e.id, source: e.source, target: e.target, selected: selEdge === e.id,
      className: cn(`nf-edge-${e.kind}`, dimming && !touches && 'nf-dim', touches && 'nf-lit'),
      markerEnd: e.kind === 'parent' ? { type: MarkerType.ArrowClosed, color: 'var(--primary)', width: 14, height: 14 } : undefined,
      interactionWidth: 24,
    }
  })

  // ---- changes from React Flow
  function onNodesChange(changes: NodeChange[]) {
    setNodes((cur) => applyNodeChanges(changes.filter((c) => c.type !== 'remove' && c.type !== 'select'), cur))
    for (const c of changes) {
      if (c.type === 'select' && c.selected) {
        setSelNode(c.id)
        setSelEdge(null)
      }
    }
  }

  function savePosition(node: Node) {
    const g = graph.nodes.find((x) => x.id === node.id)
    if (!g) return
    const job =
      g.kind === 'free' && g.mapNodeId
        ? act.saveMapNode({ id: g.mapNodeId, card_id: null, x: node.position.x, y: node.position.y, label: g.label })
        : g.cardId
          ? act.saveMapNode({ card_id: g.cardId, x: node.position.x, y: node.position.y, label: null })
          : null
    if (job) safe(job.then(flashSaved))
  }

  function onConnect(c: Connection) {
    const a = graph.nodes.find((n) => n.id === c.source)
    const b = graph.nodes.find((n) => n.id === c.target)
    if (!a?.cardId || !b?.cardId || a.cardId === b.cardId) return
    if (graph.edges.some((e) => e.id === [a.cardId, b.cardId].sort().join('|'))) return // already linked
    safe(act.addLink(a.cardId, b.cardId, 'manual'))
  }

  function addFreeNode() {
    const box = wrap.current?.getBoundingClientRect()
    const p = rf.screenToFlowPosition({ x: (box?.left ?? 0) + (box?.width ?? 600) / 2, y: (box?.top ?? 0) + (box?.height ?? 400) / 2 })
    const id = crypto.randomUUID()
    safe(act.saveMapNode({ id, card_id: null, x: p.x - 70, y: p.y - 20, label: t('map.newNote') }).then(() => {
      setScopeKind('all')
      setSelNode(`f:${id}`)
      setEditing(`f:${id}`)
      flashSaved()
    }))
  }

  function relayout() {
    const pos = layoutGraph(graph, { ignoreSaved: true })
    setNodes((cur) => cur.map((n) => ({ ...n, position: pos[n.id] ?? n.position })))
    for (const g of graph.nodes) {
      const p = pos[g.id]
      if (!p) continue
      const job = g.kind === 'free' && g.mapNodeId
        ? act.saveMapNode({ id: g.mapNodeId, card_id: null, x: p.x, y: p.y, label: g.label })
        : g.cardId ? act.saveMapNode({ card_id: g.cardId, x: p.x, y: p.y, label: null }) : null
      if (job) safe(job)
    }
    flashSaved()
    requestAnimationFrame(() => void rf.fitView({ padding: 0.25, duration: 300, maxZoom: 1.1 }))
  }

  function removeSelectedNode() {
    const g = selectedGNode
    if (!g?.mapNodeId) return
    safe(act.removeMapNode(g.mapNodeId))
    setSelNode(null)
  }

  const editableIds = (e: GEdge) => (data?.links ?? []).filter((l) => e.linkIds.includes(l.id) && l.kind !== 'wikilink')
  function setKind(e: GEdge, kind: LinkKind) {
    const owned = editableIds(e)
    if (owned.length) safe(act.setLinkKind(owned.map((l) => l.id), kind))
    else safe(act.addLink(e.source.slice(2), e.target.slice(2), kind)) // text link: add a stronger link beside it
  }
  function swap(e: GEdge) {
    const owned = editableIds(e)
    safe(act.removeLinks(owned.map((l) => l.id)).then(() => act.addLink(e.target.slice(2), e.source.slice(2), 'parent')))
  }

  const tags = data?.tags ?? []
  const previewCard = selectedGNode?.cardId ? data?.cards.find((c) => c.id === selectedGNode.cardId) : undefined
  const previewTags = previewCard && data ? data.cardTags.filter((x) => x.card_id === previewCard.id).flatMap((x) => data.tags.find((tg) => tg.id === x.tag_id) ?? []) : []
  const isEmpty = graph.nodes.length === 0
  const icon = { size: 16, strokeWidth: 2, 'aria-hidden': true } as const

  const scopeBtn = (k: ScopeKind, label: string, disabled = false, title?: string) => (
    <button
      key={k}
      type="button"
      aria-pressed={scopeKind === k}
      disabled={disabled}
      title={title}
      onClick={() => {
        if (k === 'neighbourhood') setFocusId(selectedGNode?.cardId ?? focusId)
        if (k === 'tag' && !tagId && tags[0]) setTagId(tags[0].id)
        setScopeKind(k)
      }}
      className={cn('rounded-[10px] px-3 py-1.5 text-sm font-bold disabled:opacity-50', scopeKind === k ? 'bg-primary text-primary-fg' : 'text-fg-2')}
    >
      {label}
    </button>
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col p-4 pb-28">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold">{t('nav.map')}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label={t('map.scopeLabel')} className="flex rounded-control border-[1.5px] border-border bg-surface-muted p-1">
            {scopeBtn('all', t('map.all'))}
            {scopeBtn('neighbourhood', t('map.neighbourhood'), !selectedGNode?.cardId && !focusId, t('map.needSelection'))}
            {scopeBtn('tag', t('map.byTag'), tags.length === 0)}
          </div>
          {scopeKind === 'tag' && (
            <select
              aria-label={t('map.pickTag')}
              value={tagId ?? ''}
              onChange={(e) => setTagId(e.target.value)}
              className="rounded-control border-[1.5px] border-border bg-surface px-3 py-2 text-sm font-semibold"
            >
              {tags.map((tg) => <option key={tg.id} value={tg.id}>{tg.name}</option>)}
            </select>
          )}
          <Button variant="outline" onClick={relayout} disabled={isEmpty}>{t('map.relayout')}</Button>
          <Button onClick={addFreeNode}><Plus {...icon} /> {t('map.freeNode')}</Button>
        </div>
      </header>

      {error && <p role="alert" className="mb-2 rounded-control border-[1.5px] border-coral bg-coral-soft p-2 text-sm text-coral" dir="auto">{error}</p>}

      <div ref={wrap} dir="ltr" className="nf-map relative min-h-0 flex-1 overflow-hidden rounded-card border-[1.5px] border-border bg-surface" role="region" aria-label={t('map.canvasLabel')}>
        {isEmpty ? (
          <EmptyState scopeKind={scopeKind} onFree={addFreeNode} />
        ) : (
          <ReactFlow
            nodes={viewNodes}
            edges={viewEdges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onNodeDragStop={(_, n) => savePosition(n)}
            onNodeClick={(_, n) => {
              setSelNode(n.id)
              setSelEdge(null)
            }}
            onNodeDoubleClick={(_, n) => {
              const g = graph.nodes.find((x) => x.id === n.id)
              if (g?.cardId) navigate(cardHref(g.cardId))
              else setEditing(n.id)
            }}
            onEdgeClick={(_, e) => {
              setSelEdge(e.id)
              setSelNode(null)
            }}
            onPaneClick={() => {
              setSelNode(null)
              setSelEdge(null)
            }}
            onConnect={onConnect}
            onNodesDelete={(del) => {
              for (const n of del) {
                const g = graph.nodes.find((x) => x.id === n.id)
                if (g?.mapNodeId) safe(act.removeMapNode(g.mapNodeId))
              }
              setSelNode(null)
            }}
            onEdgesDelete={(del) => {
              for (const e of del) {
                const ge = graph.edges.find((x) => x.id === e.id)
                if (ge) {
                  const owned = editableIds(ge).map((l) => l.id)
                  if (owned.length) safe(act.removeLinks(owned))
                }
              }
              setSelEdge(null)
            }}
            connectionMode={ConnectionMode.Loose}
            minZoom={0.2}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
            deleteKeyCode={['Backspace', 'Delete']}
            nodesFocusable
            edgesFocusable
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1.4} color="var(--border)" />
            <MiniMap pannable zoomable ariaLabel={t('map.minimap')} nodeColor="var(--primary)" nodeStrokeWidth={0} maskColor="color-mix(in srgb, var(--surface) 55%, transparent)" />
          </ReactFlow>
        )}

        {/* saved indicator */}
        <div className="pointer-events-none absolute start-3 top-3" role="status" aria-live="polite">
          {saved && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1.5 text-sm font-bold text-success">
              <Check {...icon} /> {t('map.saved')}
            </span>
          )}
        </div>

        {/* zoom controls */}
        {!isEmpty && (
          <div className="absolute end-3 top-3 flex flex-col overflow-hidden rounded-control border-[1.5px] border-border bg-surface shadow-[var(--shadow-raised)]">
            {[
              { label: t('map.zoomIn'), Icon: Plus, run: () => void rf.zoomIn({ duration: 150 }) },
              { label: t('map.zoomOut'), Icon: Minus, run: () => void rf.zoomOut({ duration: 150 }) },
              { label: t('map.fit'), Icon: Maximize, run: () => void rf.fitView({ padding: 0.25, duration: 250, maxZoom: 1.1 }) },
            ].map(({ label, Icon, run }, i) => (
              <button key={label} type="button" aria-label={label} title={label} onClick={run} className={cn('grid size-10 place-items-center hover:bg-surface-muted', i > 0 && 'border-t-[1.5px] border-border')}>
                <Icon {...icon} />
              </button>
            ))}
          </div>
        )}

        {/* legend */}
        {!isEmpty && (
          <ul className="absolute start-3 bottom-3 flex items-center gap-4 rounded-control border-[1.5px] border-border bg-surface px-3 py-2 text-xs font-bold" aria-label={t('map.legend')}>
            <li className="flex items-center gap-2"><svg width="28" height="6" aria-hidden><line x1="0" y1="3" x2="28" y2="3" stroke="var(--primary)" strokeWidth="1.6" /></svg>[[link]]</li>
            <li className="flex items-center gap-2"><svg width="28" height="6" aria-hidden><line x1="0" y1="3" x2="28" y2="3" stroke="var(--text-muted)" strokeWidth="1.8" strokeDasharray="7 6" /></svg>{t('map.manual')}</li>
            <li className="flex items-center gap-2"><svg width="28" height="6" aria-hidden><line x1="0" y1="3" x2="28" y2="3" stroke="var(--primary)" strokeWidth="4.5" /></svg>{t('map.parent')}</li>
          </ul>
        )}

        {/* preview of the selected card */}
        {previewCard && (
          <aside dir="auto" className="absolute end-3 top-1/2 w-64 -translate-y-1/2 rounded-card border-[1.5px] border-border bg-surface p-4 shadow-[var(--shadow-floating)]" aria-label={t('map.preview')}>
            <p className="text-[11px] font-extrabold tracking-wide text-muted uppercase">{t('map.preview')}</p>
            <h2 className="mt-1 text-start text-base font-extrabold break-words">{previewCard.title || t('nav.untitled')}</h2>
            {previewCard.body_md.trim() && <p className="mt-1 line-clamp-4 text-start text-sm text-fg-2">{plainText(previewCard.body_md).slice(0, 220)}</p>}
            {(previewTags.length > 0 || previewCard.estimate_min !== null) && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {previewTags.map((tg) => <TagChip key={tg.id} tag={tg} />)}
                {previewCard.estimate_min !== null && <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-semibold tabular">{previewCard.estimate_min}m</span>}
              </div>
            )}
            <Button className="mt-3 w-full" onClick={() => navigate(cardHref(previewCard.id))}>{t('map.open')}</Button>
          </aside>
        )}

        {/* selected free node: remove */}
        {selectedGNode?.kind === 'free' && (
          <div className="absolute start-1/2 top-3 -translate-x-1/2">
            <Button variant="danger" onClick={removeSelectedNode}><Trash2 {...icon} /> {t('map.removeNote')}</Button>
          </div>
        )}

        {/* selected edge: change kind */}
        {selectedEdgeObj && (
          <div role="toolbar" aria-label={t('map.edgeTitle')} className="absolute start-1/2 top-3 flex -translate-x-1/2 flex-wrap items-center gap-2 rounded-control border-[1.5px] border-border bg-surface p-2 shadow-[var(--shadow-floating)]">
            <span className="px-1 text-xs font-bold text-fg-2">{t(`map.kind_${selectedEdgeObj.kind}`)}</span>
            {selectedEdgeObj.kind !== 'manual' && <Button variant="outline" className="py-1 text-xs" onClick={() => setKind(selectedEdgeObj, 'manual')}>{t('map.makeManual')}</Button>}
            {selectedEdgeObj.kind !== 'parent' && <Button variant="outline" className="py-1 text-xs" onClick={() => setKind(selectedEdgeObj, 'parent')}>{t('map.makeParent')}</Button>}
            {selectedEdgeObj.kind === 'parent' && <Button variant="outline" className="py-1 text-xs" onClick={() => swap(selectedEdgeObj)}>{t('map.swap')}</Button>}
            {editableIds(selectedEdgeObj).length > 0 ? (
              <Button variant="danger" className="py-1 text-xs" onClick={() => { safe(act.removeLinks(editableIds(selectedEdgeObj).map((l) => l.id))); setSelEdge(null) }}>{t('map.removeLink')}</Button>
            ) : (
              <span className="text-xs text-muted">{t('map.fromText')}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function EmptyState({ scopeKind, onFree }: { scopeKind: ScopeKind; onFree: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="grid h-full place-items-center p-6 text-center" dir="auto">
      <div className="max-w-md">
        <svg width="190" height="130" viewBox="0 0 190 130" aria-hidden className="mx-auto">
          <g stroke="var(--text-muted)" strokeWidth="2" strokeDasharray="4 5" fill="none">
            <path d="M95 65 L40 25" /><path d="M95 65 L150 25" /><path d="M95 65 L45 105" /><path d="M95 65 L148 100" />
          </g>
          <rect x="68" y="48" width="54" height="34" rx="10" fill="var(--primary)" />
          <rect x="20" y="12" width="40" height="26" rx="9" fill="var(--tag-5)" />
          <rect x="130" y="14" width="40" height="26" rx="9" fill="var(--tag-2)" />
          <rect x="24" y="92" width="40" height="26" rx="9" fill="var(--tag-8)" />
          <rect x="130" y="88" width="40" height="26" rx="9" fill="var(--tag-7)" />
        </svg>
        <h2 className="mt-3 text-xl font-extrabold">{scopeKind === 'all' ? t('map.emptyTitle') : t('map.noMatch')}</h2>
        <p className="mt-1 text-sm text-fg-2">{scopeKind === 'all' ? t('map.emptyBody') : t('map.noMatchBody')}</p>
        {scopeKind === 'all' && (
          <div className="mt-4 flex justify-center gap-2">
            <Button onClick={() => navigate('#/board')}>{t('map.openCard')}</Button>
            <Button variant="outline" onClick={onFree}><StickyNote size={16} strokeWidth={2} aria-hidden /> {t('map.addFree')}</Button>
          </div>
        )}
      </div>
    </div>
  )
}
