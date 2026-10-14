import { BarChart3, Columns3, Network, Plus, Settings, Sun, Timer, User } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { PrefsBar } from '@/components/PrefsBar'
import { Button } from '@/components/ui/button'
import { useBoard, useBoardActions } from '@/features/board/hooks'
import { useFilter } from '@/features/board/filterStore'
import { sorted } from '@/features/board/logic'
import { isDemo } from '@/features/board/repo'
import { cardHref, navigate, type Route } from '@/lib/router'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

function NavLink({ href, active, icon, label, badge }: { href: string; active: boolean; icon: ReactNode; label: string; badge?: number }) {
  return (
    <a
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-semibold',
        active ? 'bg-primary-soft text-primary' : 'text-fg-2 hover:bg-surface-muted',
      )}
    >
      {icon}
      <span className="flex-1 truncate">{label}</span>
      {badge ? <span className="grid min-w-5 place-items-center rounded-full bg-sun px-1.5 text-xs font-bold text-[#1d2733] tabular">{badge}</span> : null}
    </a>
  )
}

export function Sidebar({ route }: { route: Route }) {
  const { t } = useTranslation()
  const { data } = useBoard()
  const act = useBoardActions()
  const { filter, setFilter } = useFilter()
  const [account, setAccount] = useState(false)
  const icon = { size: 20, strokeWidth: 2, 'aria-hidden': true } as const

  const todayCount = data?.cards.filter((c) => c.is_today && !c.archived_at).length ?? 0
  const tagCount = (id: string) => data?.cardTags.filter((x) => x.tag_id === id).length ?? 0
  const onBoard = route.name === 'board' || route.name === 'card'

  async function newCard() {
    if (!act.snapshot()) return
    if (!act.snapshot()!.columns.length) {
      await act.addStarterColumns(t('board.starter', { returnObjects: true }) as string[])
    }
    const first = sorted(act.snapshot()!.columns)[0]
    if (!first) return
    const { id, done } = act.addCard('', first.id)
    navigate(cardHref(id))
    await done
  }

  return (
    <nav aria-label={t('nav.main')} className="flex h-full w-60 shrink-0 flex-col gap-2 border-e-[1.5px] border-border bg-surface p-4">
      <div className="flex items-center gap-3 px-1 pb-2">
        <span className="grid size-10 place-items-center rounded-control bg-primary text-primary-fg" aria-hidden>
          <Timer size={22} strokeWidth={2} />
        </span>
        <span className="text-lg font-extrabold">{t('app.name')}</span>
      </div>

      <Button onClick={() => void newCard()} className="mb-2 w-full">
        <Plus {...icon} /> {t('nav.newCard')}
      </Button>

      <NavLink href="#/board" active={onBoard} icon={<Columns3 {...icon} />} label={t('nav.board')} />
      <NavLink href="#/today" active={route.name === 'today'} icon={<Sun {...icon} />} label={t('nav.today')} badge={todayCount} />
      <NavLink href="#/map" active={route.name === 'map'} icon={<Network {...icon} />} label={t('nav.map')} />
      <NavLink href="#/reports" active={route.name === 'reports'} icon={<BarChart3 {...icon} />} label={t('nav.reports')} />

      <h2 className="mt-4 px-3 text-xs font-bold tracking-wide text-muted uppercase">{t('nav.tags')}</h2>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {data?.tags.map((tag) => {
          const on = filter.tagIds.includes(tag.id)
          return (
            <li key={tag.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setFilter({ ...filter, tagIds: on ? filter.tagIds.filter((x) => x !== tag.id) : [...filter.tagIds, tag.id] })
                  navigate('#/board')
                }}
                className={cn('flex w-full items-center gap-3 rounded-control px-3 py-2 text-sm', on ? 'bg-primary-soft font-semibold text-primary' : 'text-fg-2 hover:bg-surface-muted')}
              >
                <span className="size-2.5 rounded-full" style={{ background: `var(--tag-${(tag.color_index % 8) + 1})` }} aria-hidden />
                <span dir="auto" className="flex-1 truncate text-start">{tag.name}</span>
                <span className="text-xs text-muted tabular">{tagCount(tag.id)}</span>
              </button>
            </li>
          )
        })}
      </ul>

      <div className="space-y-1 border-t-[1.5px] border-border pt-3">
        <NavLink href="#/settings" active={route.name === 'settings'} icon={<Settings {...icon} />} label={t('nav.settings')} />
        <button
          type="button"
          onClick={() => setAccount((v) => !v)}
          aria-expanded={account}
          className="flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-sm font-semibold text-fg-2 hover:bg-surface-muted"
        >
          <span className="grid size-8 place-items-center rounded-full bg-sun text-[#1d2733]" aria-hidden>
            <User size={16} strokeWidth={2} />
          </span>
          {t('nav.account')}
        </button>
        {account && (
          <div className="space-y-2 px-1 pb-1">
            <PrefsBar />
            {isDemo ? (
              <p className="rounded-control bg-sun-soft px-2 py-1 text-xs">{t('home.demo')}</p>
            ) : (
              <Button variant="outline" className="w-full" onClick={() => void supabase.auth.signOut()}>
                {t('nav.signOut')}
              </Button>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
