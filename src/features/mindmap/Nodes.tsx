import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export interface CardNodeData extends Record<string, unknown> {
  label: string
  tagColorIndex: number | null
  dim: boolean
  lit: boolean // neighbour of the selected node
}
export interface FreeNodeData extends Record<string, unknown> {
  label: string
  editing: boolean
  dim: boolean
  onLabel: (label: string) => void
  onDone: () => void
}

type CardNodeT = Node<CardNodeData, 'card'>
type FreeNodeT = Node<FreeNodeData, 'free'>

/** A card on the map: tag colour bar at the start edge, selected = filled teal. */
export function CardNode({ data, selected }: NodeProps<CardNodeT>) {
  const { t } = useTranslation()
  const bar = data.tagColorIndex === null ? 'var(--border)' : `var(--tag-${(data.tagColorIndex % 8) + 1})`
  return (
    <div
      dir="auto"
      className={cn(
        'w-[200px] rounded-control border-[1.5px] px-3 py-2.5 text-start text-sm font-bold shadow-[var(--shadow-raised)]',
        selected ? 'border-primary bg-primary text-primary-fg' : data.lit ? 'border-primary bg-surface text-fg' : 'border-border bg-surface text-fg',
        data.dim && 'nf-node-dim',
      )}
      style={{ borderInlineStartWidth: 5, borderInlineStartColor: selected ? 'var(--primary-edge)' : bar }}
    >
      <Handle type="target" position={Position.Left} />
      <span className="line-clamp-2 break-words">{data.label || t('nav.untitled')}</span>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

/** A note on the map that is not a card: dashed sun-yellow, double-click to rename. */
export function FreeNode({ data, selected }: NodeProps<FreeNodeT>) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(data.label)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!data.editing) return
    // A new node is hidden until React Flow has measured it, and focus fails on hidden elements:
    // retry briefly until the input really has focus.
    let tries = 0
    const id = setInterval(() => {
      ref.current?.focus()
      ref.current?.select()
      if (document.activeElement === ref.current || ++tries > 20) clearInterval(id)
    }, 50)
    return () => clearInterval(id)
  }, [data.editing])
  return (
    <div
      dir="auto"
      className={cn(
        'min-w-[140px] max-w-[220px] rounded-control border-[1.5px] border-dashed border-sun bg-sun-soft px-3 py-2 text-start text-sm font-bold text-[#3d2f00]',
        selected && 'ring-2 ring-primary',
        data.dim && 'nf-node-dim',
      )}
    >
      {data.editing ? (
        <input
          ref={ref}
          dir="auto"
          value={draft}
          aria-label={t('map.noteLabel')}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            data.onLabel(draft.trim() || t('map.newNote'))
            data.onDone()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') {
              setDraft(data.label)
              data.onDone()
            }
            e.stopPropagation() // keep Delete/Backspace for the text, not for removing the node
          }}
          className="nodrag w-full bg-transparent font-bold outline-none"
        />
      ) : (
        <span className="break-words">{data.label}</span>
      )}
    </div>
  )
}
