import { Node } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'

/** `[[Title]]` or `[[Title|id]]`. Stored as an atom so the serializer cannot escape the brackets. */
export const WIKILINK_RE = /^\[\[([^\][|\n]+?)(?:\|([^\][\n]+?))?\]\]/

export const WikiLink = Node.create({
  name: 'wikiLink',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      // Both live in data-* only: a bare title/id attribute would become a tooltip and a duplicate DOM id.
      title: { default: '', parseHTML: (el: HTMLElement) => el.textContent ?? '', renderHTML: () => ({}) },
      id: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-id'),
        renderHTML: (a: Record<string, unknown>) => (a.id ? { 'data-id': String(a.id) } : {}),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-wikilink]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      {
        ...HTMLAttributes,
        'data-wikilink': '',
        class: 'nf-wikilink',
        // Keep the link text as one directional unit inside a mixed-language paragraph.
        style: 'unicode-bidi: isolate',
      },
      node.attrs.title,
    ]
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          // Clicking a link opens its card (hash route; the app router listens for hashchange).
          handleClickOn(_view, _pos, node) {
            if (node.type.name !== 'wikiLink' || !node.attrs.id) return false
            window.location.hash = '#/card/' + encodeURIComponent(String(node.attrs.id))
            return true
          },
        },
      }),
    ]
  },

  markdownTokenName: 'wikiLink',
  markdownTokenizer: {
    name: 'wikiLink',
    level: 'inline',
    start: (src: string) => src.indexOf('[['),
    tokenize(src: string) {
      const m = WIKILINK_RE.exec(src)
      if (!m) return undefined
      return { type: 'wikiLink', raw: m[0], title: m[1].trim(), id: m[2]?.trim() ?? null }
    },
  },
  parseMarkdown(token, helpers) {
    return helpers.createNode('wikiLink', { title: token.title, id: token.id })
  },
  renderMarkdown(node) {
    const { title, id } = node.attrs ?? {}
    return `[[${title}${id ? `|${id}` : ''}]]`
  },
})
