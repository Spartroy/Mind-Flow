import { Markdown } from '@tiptap/markdown'
import Placeholder from '@tiptap/extension-placeholder'
import { TaskItem } from '@tiptap/extension-task-item'
import { TaskList } from '@tiptap/extension-task-list'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect } from 'react'
import { DirAuto } from './dirAuto'
import { WikiLink } from './wikiLink'
import './editor.css'

export type DirMode = 'auto' | 'ltr' | 'rtl'

interface Props {
  /** Markdown source of truth. */
  value: string
  onChange: (markdown: string) => void
  dirMode?: DirMode
  placeholder?: string
  ariaLabel?: string
}

export function MarkdownEditor({ value, onChange, dirMode = 'auto', placeholder, ariaLabel }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: placeholder ?? '' }),
      Markdown,
      DirAuto,
      WikiLink,
    ],
    content: value,
    contentType: 'markdown',
    editorProps: { attributes: { role: 'textbox', 'aria-multiline': 'true', 'aria-label': ariaLabel ?? 'Note' } },
    onUpdate: ({ editor: e }) => onChange(e.getMarkdown()),
  })

  // Accept external changes (e.g. switching cards) without clobbering the user's typing.
  useEffect(() => {
    if (editor && value !== editor.getMarkdown()) {
      editor.commands.setContent(value, { contentType: 'markdown', emitUpdate: false })
    }
  }, [value, editor])

  return (
    <div className="nf-editor" data-dir={dirMode}>
      <EditorContent editor={editor} />
    </div>
  )
}
