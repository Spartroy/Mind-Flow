import { Extension } from '@tiptap/core'

/**
 * Puts dir="auto" on text blocks (paragraph, heading) so the browser picks direction per
 * block from its first strong character.
 *
 * Containers (lists, list items, quotes) must NOT get dir: Chrome's dir=auto skips
 * descendants that carry their own dir, so a container would always resolve to LTR.
 * Containers follow their first block via :has(:dir(rtl)) in editor.css instead.
 *
 * The Auto/LTR/RTL switch is pure CSS because direction is a view preference and
 * Markdown has no way to store it.
 */
export const DirAuto = Extension.create({
  name: 'dirAuto',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          dir: {
            default: 'auto',
            parseHTML: () => 'auto',
            renderHTML: () => ({ dir: 'auto' }),
          },
        },
      },
    ]
  },
})
