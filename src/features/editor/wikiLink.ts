import { mergeAttributes, Node } from '@tiptap/core'

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
      title: { default: '' },
      id: { default: null },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-wikilink]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-wikilink': '',
        'data-id': node.attrs.id ?? undefined,
        class: 'nf-wikilink',
        // Keep the link text as one directional unit inside a mixed-language paragraph.
        style: 'unicode-bidi: isolate',
      }),
      node.attrs.title,
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
