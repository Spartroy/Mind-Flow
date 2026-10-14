import { useEditorState, type Editor } from '@tiptap/react'
import { Bold, Code, Heading2, Italic, Link2, List, ListChecks, Quote, Table } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { DirMode } from '../editor/MarkdownEditor'

function ToolButton({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      // mousedown keeps the editor selection; click would blur it first
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn('grid size-8 place-items-center rounded-input', active ? 'bg-primary-soft text-primary' : 'text-fg-2 hover:bg-surface')}
    >
      {children}
    </button>
  )
}

/** Accept "example.com" as well as full URLs; Tiptap's Link blocks unsafe schemes such as javascript:. */
const withScheme = (url: string) => (/^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`)

export function EditorToolbar({ editor, dirMode, onDirMode }: { editor: Editor; dirMode: DirMode; onDirMode: (m: DirMode) => void }) {
  const { t } = useTranslation()
  const [linkOpen, setLinkOpen] = useState(false)
  const [href, setHref] = useState('')
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'), italic: e.isActive('italic'), heading: e.isActive('heading'), list: e.isActive('bulletList'),
      tasks: e.isActive('taskList'), link: e.isActive('link'), code: e.isActive('code'), quote: e.isActive('blockquote'),
      table: e.isActive('table'),
    }),
  })
  const c = () => editor.chain().focus()
  const icon = { size: 16, strokeWidth: 2, 'aria-hidden': true } as const

  function openLink() {
    setHref((editor.getAttributes('link').href as string | undefined) ?? '')
    setLinkOpen((v) => !v)
  }
  function applyLink() {
    const v = href.trim()
    if (v) c().extendMarkRange('link').setLink({ href: withScheme(v) }).run()
    else c().extendMarkRange('link').unsetLink().run()
    setLinkOpen(false)
  }

  return (
    <div className="mb-3 rounded-control border-[1.5px] border-border bg-surface-muted p-1.5">
      <div role="toolbar" aria-label={t('editor.note')} className="flex flex-wrap items-center gap-1">
        <ToolButton label={t('editor.bold')} active={s.bold} onClick={() => c().toggleBold().run()}><Bold {...icon} /></ToolButton>
        <ToolButton label={t('editor.italic')} active={s.italic} onClick={() => c().toggleItalic().run()}><Italic {...icon} /></ToolButton>
        <ToolButton label={t('editor.heading')} active={s.heading} onClick={() => c().toggleHeading({ level: 2 }).run()}><Heading2 {...icon} /></ToolButton>
        <ToolButton label={t('editor.bulletList')} active={s.list} onClick={() => c().toggleBulletList().run()}><List {...icon} /></ToolButton>
        <ToolButton label={t('editor.checklist')} active={s.tasks} onClick={() => c().toggleTaskList().run()}><ListChecks {...icon} /></ToolButton>
        <ToolButton label={t('editor.link')} active={s.link || linkOpen} onClick={openLink}><Link2 {...icon} /></ToolButton>
        <ToolButton label={t('editor.code')} active={s.code} onClick={() => c().toggleCode().run()}><Code {...icon} /></ToolButton>
        <ToolButton
          label={t('editor.table')}
          active={s.table}
          onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        >
          <Table {...icon} />
        </ToolButton>
        <ToolButton label={t('editor.quote')} active={s.quote} onClick={() => c().toggleBlockquote().run()}><Quote {...icon} /></ToolButton>

        <div role="group" aria-label={t('editor.direction')} className="ms-auto flex rounded-input bg-surface p-0.5">
          {(['auto', 'ltr', 'rtl'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={dirMode === m}
              onClick={() => onDirMode(m)}
              className={cn('rounded-[6px] px-2.5 py-1 text-xs font-bold', dirMode === m ? 'bg-primary text-primary-fg' : 'text-fg-2')}
            >
              {t(`editor.${m}`)}
            </button>
          ))}
        </div>
      </div>
      {linkOpen && (
        <form
          className="mt-1.5 flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            applyLink()
          }}
        >
          <Input autoFocus dir="ltr" value={href} onChange={(e) => setHref(e.target.value)} aria-label={t('editor.linkUrl')} placeholder="https://" />
          <button type="submit" className="rounded-input bg-primary px-3 text-xs font-bold text-primary-fg">{t('editor.applyLink')}</button>
        </form>
      )}
    </div>
  )
}
