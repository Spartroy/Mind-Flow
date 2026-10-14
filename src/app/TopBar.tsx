import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { usePalette } from '@/features/palette/recents'

/** The "Search or jump to…" bar from the design: opens the command palette. */
export function TopBar() {
  const { t } = useTranslation()
  const setOpen = usePalette((s) => s.setOpen)
  return (
    <div className="px-4 pt-4 md:px-6">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('palette.label')}
        className="flex w-full max-w-md items-center gap-3 rounded-control border-[1.5px] border-border bg-surface px-4 py-2.5 text-start text-sm text-muted"
      >
        <Search size={16} strokeWidth={2} aria-hidden />
        <span className="flex-1 truncate">{t('palette.searchPlaceholder')}</span>
        <kbd className="rounded-[8px] bg-surface-muted px-2 py-0.5 text-xs font-bold text-fg-2" dir="ltr">Ctrl K</kbd>
      </button>
    </div>
  )
}
