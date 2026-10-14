import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useBoard, useBoardActions } from '@/features/board/hooks'
import { download } from '@/features/data/download'
import { BackupError, buildExportZip, expandFiles, planImport, type ImportPlan } from '@/features/data/backup'

export function DataSection() {
  const { t } = useTranslation()
  const { data } = useBoard()
  const act = useBoardActions()
  const fileRef = useRef<HTMLInputElement>(null)
  const dirRef = useRef<HTMLInputElement>(null)
  const [plan, setPlan] = useState<ImportPlan | null>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  if (!data) return null

  function doExport() {
    const stamp = new Date().toISOString().slice(0, 10)
    download(`neuroflow-${stamp}.zip`, buildExportZip(data!), 'application/zip')
    setMsg({ kind: 'ok', text: t('settings.exported', { count: data!.cards.filter((c) => !c.archived_at).length }) })
  }

  async function pick(list: FileList | null) {
    if (!list || !list.length) return
    setMsg(null)
    try {
      const files = await Promise.all([...list].map(async (f) => ({ name: f.webkitRelativePath || f.name, bytes: new Uint8Array(await f.arrayBuffer()) })))
      setPlan(planImport(expandFiles(files), data!))
    } catch (e) {
      setMsg({ kind: 'error', text: e instanceof BackupError ? e.message : t('settings.importFailed', { message: e instanceof Error ? e.message : String(e) }) })
    } finally {
      if (fileRef.current) fileRef.current.value = ''
      if (dirRef.current) dirRef.current.value = ''
    }
  }

  async function confirmImport() {
    if (!plan) return
    setBusy(true)
    try {
      await act.importBackup(plan.backup)
      setMsg({ kind: 'ok', text: t('settings.imported') })
      setPlan(null)
    } catch (e) {
      setMsg({ kind: 'error', text: t('settings.importFailed', { message: e instanceof Error ? e.message : String(e) }) })
    } finally {
      setBusy(false)
    }
  }

  async function deleteAll() {
    if (!window.confirm(t('settings.confirmDeleteAll'))) return
    try {
      await act.deleteAllCards()
      setMsg({ kind: 'ok', text: t('settings.deletedAll') })
    } catch (e) {
      setMsg({ kind: 'error', text: e instanceof Error ? e.message : String(e) })
    }
  }

  const row = 'flex flex-wrap items-center justify-between gap-3 border-b-[1.5px] border-border py-4 last:border-b-0'
  return (
    <>
      <div className={row}>
        <div>
          <p className="font-bold">{t('settings.export')}</p>
          <p className="text-sm text-muted">{t('settings.exportHint')}</p>
        </div>
        <Button variant="outline" onClick={doExport}>{t('settings.exportBtn')}</Button>
      </div>
      <div className={row}>
        <div>
          <p className="font-bold">{t('settings.import')}</p>
          <p className="text-sm text-muted">{t('settings.importHint')}</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" multiple accept=".zip,.json,.md" className="sr-only" id="import-files" onChange={(e) => void pick(e.target.files)} />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>{t('settings.importFiles')}</Button>
          {/* webkitdirectory: pick a whole folder of Markdown files */}
          <input
            ref={dirRef}
            type="file"
            className="sr-only"
            id="import-folder"
            {...({ webkitdirectory: '' } as Record<string, string>)}
            onChange={(e) => void pick(e.target.files)}
          />
          <Button variant="outline" onClick={() => dirRef.current?.click()}>{t('settings.importFolder')}</Button>
        </div>
      </div>
      <div className={row}>
        <div>
          <p className="font-bold">{t('settings.deleteAll')}</p>
          <p className="text-sm text-muted">{t('settings.deleteAllHint')}</p>
        </div>
        <Button variant="danger" onClick={() => void deleteAll()}>{t('settings.deleteAllBtn')}</Button>
      </div>

      {msg && (
        <p role={msg.kind === 'error' ? 'alert' : 'status'} dir="auto" className={msg.kind === 'error' ? 'mt-3 text-sm text-coral' : 'mt-3 text-sm text-success'}>
          {msg.text}
        </p>
      )}

      {plan && (
        <dialog
          open
          aria-labelledby="import-title"
          className="fixed inset-0 z-50 m-auto w-full max-w-md rounded-card border-[1.5px] border-border bg-surface p-6 text-fg shadow-[var(--shadow-floating)]"
        >
          <h3 id="import-title" className="text-xl font-extrabold">{t('settings.importTitle')}</h3>
          <p className="mt-2 text-sm text-fg-2" dir="auto">
            {plan.kind === 'backup'
              ? t('settings.planBackup', { cards: plan.summary.cards, columns: plan.summary.columns, sessions: plan.summary.sessions, date: plan.summary.exportedAt.slice(0, 10) })
              : t('settings.planMarkdown', { created: plan.summary.created, updated: plan.summary.updated, columns: plan.summary.columns })}
          </p>
          <p className="mt-2 text-sm text-muted" dir="auto">{plan.kind === 'backup' ? t('settings.mergeNote') : t('settings.mdNote')}</p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPlan(null)} disabled={busy}>{t('board.cancel')}</Button>
            <Button onClick={() => void confirmImport()} disabled={busy}>{busy ? t('auth.loading') : t('settings.importConfirm')}</Button>
          </div>
        </dialog>
      )}
    </>
  )
}
