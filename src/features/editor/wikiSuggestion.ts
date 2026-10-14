import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { PluginKey } from '@tiptap/pm/state'

export interface LinkItem {
  id: string
  title: string
  hint?: string // e.g. column name
}

export interface WikiSuggestionOptions {
  /** Called on every keystroke so it always sees the latest cards. */
  getItems: (query: string) => LinkItem[]
  emptyLabel: string
}

/**
 * Typing `[[` opens a card picker. Picking inserts a WikiLink node (title + id), so the
 * link survives renames. The popup is plain DOM: it lives outside React's render tree.
 */
export const WikiSuggestion = Extension.create<WikiSuggestionOptions>({
  name: 'wikiSuggestion',

  addOptions() {
    return { getItems: () => [], emptyLabel: 'No matching cards' }
  },

  addProseMirrorPlugins() {
    const { getItems, emptyLabel } = this.options
    return [
      Suggestion<LinkItem>({
        editor: this.editor,
        pluginKey: new PluginKey('wikiSuggestion'),
        char: '[[',
        allowSpaces: true,
        startOfLine: false,
        items: ({ query }) => getItems(query),
        command: ({ editor, range, props }) => {
          editor
            .chain()
            .focus()
            .insertContentAt(range, [
              { type: 'wikiLink', attrs: { title: props.title, id: props.id } },
              { type: 'text', text: ' ' },
            ])
            .run()
        },
        render: () => {
          let el: HTMLDivElement | null = null
          let items: LinkItem[] = []
          let index = 0
          let pick: (i: LinkItem) => void = () => {}

          const paint = () => {
            if (!el) return
            el.replaceChildren()
            if (!items.length) {
              const empty = document.createElement('div')
              empty.className = 'nf-suggest-empty'
              empty.textContent = emptyLabel
              el.append(empty)
              return
            }
            items.forEach((item, i) => {
              const row = document.createElement('div')
              row.setAttribute('role', 'option')
              row.setAttribute('aria-selected', String(i === index))
              row.className = 'nf-suggest-item'
              const title = document.createElement('span')
              title.dir = 'auto'
              title.textContent = item.title || '…'
              row.append(title)
              if (item.hint) {
                const hint = document.createElement('small')
                hint.dir = 'auto'
                hint.textContent = item.hint
                row.append(hint)
              }
              // mousedown (not click) so the editor does not lose focus first
              row.addEventListener('mousedown', (e) => {
                e.preventDefault()
                pick(item)
              })
              el!.append(row)
            })
          }

          const place = (rect: DOMRect | null | undefined) => {
            if (!el || !rect) return
            const rtl = document.documentElement.dir === 'rtl'
            el.style.top = `${rect.bottom + 6}px`
            if (rtl) {
              el.style.insetInlineStart = ''
              el.style.left = `${Math.max(8, rect.right - el.offsetWidth)}px`
            } else {
              el.style.left = `${Math.min(rect.left, window.innerWidth - el.offsetWidth - 8)}px`
            }
          }

          return {
            onStart: (p) => {
              el = document.createElement('div')
              el.className = 'nf-suggest'
              el.setAttribute('role', 'listbox')
              document.body.append(el)
              items = p.items
              index = 0
              pick = (i) => p.command(i)
              paint()
              place(p.clientRect?.())
            },
            onUpdate: (p) => {
              items = p.items
              index = Math.min(index, Math.max(0, items.length - 1))
              pick = (i) => p.command(i)
              paint()
              place(p.clientRect?.())
            },
            onKeyDown: ({ event }) => {
              if (event.key === 'ArrowDown') {
                index = items.length ? (index + 1) % items.length : 0
                paint()
                return true
              }
              if (event.key === 'ArrowUp') {
                index = items.length ? (index - 1 + items.length) % items.length : 0
                paint()
                return true
              }
              if (event.key === 'Enter' || event.key === 'Tab') {
                if (!items.length) return false
                pick(items[index])
                return true
              }
              return false
            },
            onExit: () => {
              el?.remove()
              el = null
            },
          }
        },
      }),
    ]
  },
})
