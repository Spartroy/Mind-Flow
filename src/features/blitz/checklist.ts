export interface ChecklistItem {
  /** Index of the line in the Markdown source (stable key for toggling). */
  line: number
  checked: boolean
  text: string
}

const ITEM = /^(\s*[-*+]\s+\[)([ xX])(\]\s+)(.*)$/
const FENCE = /^\s*```/

/** Plain text for display: wikilinks show their title, light Markdown marks are dropped. */
export function plainText(md: string): string {
  return md
    .replace(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__|\*|_|`|~~)/g, '')
    .trim()
}

/** Task-list items in a note, ignoring anything inside code fences. */
export function parseChecklist(md: string): ChecklistItem[] {
  const items: ChecklistItem[] = []
  let fenced = false
  md.split('\n').forEach((raw, line) => {
    if (FENCE.test(raw)) {
      fenced = !fenced
      return
    }
    if (fenced) return
    const m = ITEM.exec(raw)
    if (m) items.push({ line, checked: m[2] !== ' ', text: plainText(m[4]) })
  })
  return items
}

/** Flip one item and return the new Markdown. Unknown or non-item lines leave the text unchanged. */
export function toggleChecklistItem(md: string, line: number): string {
  if (!parseChecklist(md).some((i) => i.line === line)) return md // also refuses lines inside code fences
  const lines = md.split('\n')
  const m = ITEM.exec(lines[line])
  if (!m) return md
  lines[line] = `${m[1]}${m[2] === ' ' ? 'x' : ' '}${m[3]}${m[4]}`
  return lines.join('\n')
}
