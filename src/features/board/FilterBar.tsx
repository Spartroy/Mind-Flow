import { Check, Search, Sun, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { TagChip } from './CardTile'
import { emptyFilter, isFiltering, type Filter } from './logic'
import type { Tag } from './types'

export function FilterBar({ filter, onChange, tags }: { filter: Filter; onChange: (f: Filter) => void; tags: Tag[] }) {
  const { t } = useTranslation()
  const toggleTag = (id: string) =>
    onChange({ ...filter, tagIds: filter.tagIds.includes(id) ? filter.tagIds.filter((x) => x !== id) : [...filter.tagIds, id] })

  return (
    <div role="search" className="flex flex-wrap items-center gap-2 px-4 pt-3">
      <div className="relative w-64 max-w-full">
        <Search size={16} strokeWidth={2} aria-hidden className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
        <Input
          type="search"
          value={filter.query}
          onChange={(e) => onChange({ ...filter, query: e.target.value })}
          placeholder={t('board.search')}
          aria-label={t('board.search')}
          className="ps-9"
        />
      </div>
      <button
        type="button"
        aria-pressed={filter.todayOnly}
        onClick={() => onChange({ ...filter, todayOnly: !filter.todayOnly })}
        className={cn(
          'inline-flex items-center gap-1 rounded-full border-[1.5px] px-3 py-1 text-sm',
          filter.todayOnly ? 'border-sun bg-sun-soft' : 'border-border',
        )}
      >
        <Sun size={14} strokeWidth={2} aria-hidden /> {t('board.today')}
        {filter.todayOnly && <Check size={14} strokeWidth={2} aria-hidden />}
      </button>
      {tags.map((tag) => {
        const on = filter.tagIds.includes(tag.id)
        return (
          <button type="button" key={tag.id} aria-pressed={on} onClick={() => toggleTag(tag.id)} className={cn('inline-flex items-center gap-1 rounded-full', on ? 'ring-2 ring-primary' : 'opacity-75')}>
            <TagChip tag={tag} />
            {on && <Check size={14} strokeWidth={2} aria-hidden />}
          </button>
        )
      })}
      {isFiltering(filter) && (
        <Button variant="ghost" onClick={() => onChange(emptyFilter)}>
          <X size={14} strokeWidth={2} aria-hidden /> {t('board.clearFilters')}
        </Button>
      )}
    </div>
  )
}
