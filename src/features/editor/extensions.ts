import Placeholder from '@tiptap/extension-placeholder'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import { TaskItem } from '@tiptap/extension-task-item'
import { TaskList } from '@tiptap/extension-task-list'
import { Markdown } from '@tiptap/markdown'
import StarterKit from '@tiptap/starter-kit'
import { DirAuto } from './dirAuto'
import { WikiLink } from './wikiLink'
import { WikiSuggestion, type WikiSuggestionOptions } from './wikiSuggestion'

export interface ExtensionOptions {
  placeholder?: string
  suggestion?: WikiSuggestionOptions
}

/** One list of extensions shared by the app editor and the round-trip tests. */
export function buildExtensions({ placeholder, suggestion }: ExtensionOptions = {}) {
  return [
    StarterKit.configure({ link: { openOnClick: false, autolink: true } }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Table,
    TableRow,
    TableHeader,
    TableCell,
    Placeholder.configure({ placeholder: placeholder ?? '' }),
    Markdown,
    DirAuto,
    WikiLink,
    ...(suggestion ? [WikiSuggestion.configure(suggestion)] : []),
  ]
}
