import { DndContext } from '@dnd-kit/core'
import { SortableContext } from '@dnd-kit/sortable'
import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it } from 'vitest'
import i18n from '@/i18n'
import { CardTile } from './CardTile'
import { formatMinutes } from './logic'
import type { Card } from './types'

const card: Card = {
  id: 'c1', title: 'تحضير درس الشبكات Networks', body_md: '', column_id: 'a', position: 'a0',
  estimate_min: 90, is_today: true, due_date: null, archived_at: null,
}

describe('CardTile (mixed Arabic/English)', () => {
  it('lets the browser pick direction per text block and flags Today and estimate', () => {
    document.documentElement.dir = 'rtl'
    render(
      <I18nextProvider i18n={i18n}>
        <DndContext>
          <SortableContext items={[card.id]}>
            <ul>
              <CardTile card={card} tags={[{ id: 't', name: 'منهج IGCSE', color_index: 2 }]} linkCount={3} onOpen={() => {}} onKeyMove={() => {}} />
            </ul>
          </SortableContext>
        </DndContext>
      </I18nextProvider>,
    )
    const title = screen.getByRole('button', { name: card.title })
    expect(title).toHaveAttribute('dir', 'auto')
    expect(title.className).toContain('text-start')
    expect(screen.getByText('منهج IGCSE')).toHaveAttribute('dir', 'auto')
    expect(screen.getByText('1h 30m')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /today/i })).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('formats minutes', () => {
    expect([25, 60, 90].map(formatMinutes)).toEqual(['25m', '1h', '1h 30m'])
  })
})
