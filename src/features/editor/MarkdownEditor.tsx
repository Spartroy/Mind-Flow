import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { buildExtensions } from './extensions'
import type { LinkItem } from './wikiSuggestion'
import './editor.css'

export type DirMode = 'auto' | 'ltr' | 'rtl'

interface Props {
  /** Markdown source of truth (initial value; later changes only when it differs from the editor). */
  value: string
  onChange: (markdown: string) => void
  dirMode?: DirMode
  placeholder?: string
  ariaLabel?: string
  /** Cards offered by the `[[` picker. Omit to disable the picker. */
  getLinkItems?: (query: string) => LinkItem[]
  noMatchLabel?: string
  toolbar?: (editor: Editor) => ReactNode
}

export function MarkdownEditor({
  value, onChange, dirMode = 'auto', placeholder, ariaLabel, getLinkItems, noMatchLabel, toolbar,
}: Props) {
  // The suggestion plugin is created once; it reads the latest getLinkItems through this ref.
  const itemsRef = useRef(getLinkItems)
  useEffect(() => {
    itemsRef.current = getLinkItems
  })
  const extensions = useMemo(
    () =>
      buildExtensions({
        placeholder,
        suggestion: getLinkItems
          ? { getItems: (q) => itemsRef.current?.(q) ?? [], emptyLabel: noMatchLabel ?? 'No matching cards' }
          : undefined,
      }),
    // Created once per editor instance on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const editor = useEditor({
    extensions,
    content: value,
    contentType: 'markdown',
    editorProps: { attributes: { role: 'textbox', 'aria-multiline': 'true', 'aria-label': ariaLabel ?? 'Note' } },
    onUpdate: ({ editor: e }) => onChange(e.getMarkdown()),
  })

  useEffect(() => {
    if (editor && value !== editor.getMarkdown()) {
      editor.commands.setContent(value, { contentType: 'markdown', emitUpdate: false })
    }
  }, [value, editor])

  return (
    <div className="nf-editor" data-dir={dirMode}>
      {editor && toolbar?.(editor)}
      <EditorContent editor={editor} />
    </div>
  )
}
