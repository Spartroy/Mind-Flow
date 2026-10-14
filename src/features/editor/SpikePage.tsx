import { useState } from 'react'
import { MarkdownEditor, type DirMode } from './MarkdownEditor'

export const SPIKE_SAMPLE = `# درس الشبكات Networks

تحضير درس عن **LAN** و *WAN* في منهج IGCSE، والأمثلة من الحياة اليومية.

Start in English then عربي في المنتصف، then back (اختبار الترقيم).

- نقطة عربية first
- English bullet ثم عربي
- [[Card title]] رابط

1. الخطوة الأولى
2. Step two

- [ ] مهمة غير منجزة
- [x] Done task تم

> اقتباس: "Quote" مع أرقام 123 و 4.5

\`inline code\` داخل جملة عربية.
`

/** Dev-only page (#/spike) for exercising mixed Arabic/English editing by hand. */
export function SpikePage() {
  const [md, setMd] = useState(SPIKE_SAMPLE)
  const [dirMode, setDirMode] = useState<DirMode>('auto')
  return (
    <main className="mx-auto grid max-w-5xl gap-4 p-4 md:grid-cols-2">
      <section className="space-y-2">
        <div role="group" aria-label="Direction" className="flex gap-2">
          {(['auto', 'ltr', 'rtl'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={dirMode === m}
              onClick={() => setDirMode(m)}
              className="rounded-control border-[1.5px] border-border px-3 py-1 text-sm aria-pressed:border-primary aria-pressed:bg-surface-muted"
            >
              {m.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="rounded-card border-[1.5px] border-border bg-surface p-4">
          <MarkdownEditor value={md} onChange={setMd} dirMode={dirMode} />
        </div>
      </section>
      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted">Markdown (source of truth)</h2>
        <pre data-testid="md-out" dir="auto" className="whitespace-pre-wrap rounded-card border-[1.5px] border-border p-4 text-sm">{md}</pre>
      </section>
    </main>
  )
}
