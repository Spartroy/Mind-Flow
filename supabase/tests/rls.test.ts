import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const A = '00000000-0000-0000-0000-00000000000a'
const B = '00000000-0000-0000-0000-00000000000b'

// Minimal stand-in for Supabase's auth schema and roles so the real migrations run unchanged.
const PRELUDE = `
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  create role authenticated nologin;
  create role anon nologin;
  grant usage on schema public, auth to authenticated, anon;
  grant execute on function auth.uid() to authenticated, anon;
`
const GRANTS = `
  grant select, insert, update, delete on all tables in schema public to authenticated;
`

let db: PGlite

async function as(uid: string, fn: () => Promise<void>) {
  await db.exec(`set test.uid = '${uid}'; set role authenticated;`)
  try {
    await fn()
  } finally {
    await db.exec(`reset role; reset test.uid;`)
  }
}

beforeAll(async () => {
  db = new PGlite({ extensions: { pg_trgm } })
  await db.exec(PRELUDE)
  const dir = join(process.cwd(), 'supabase', 'migrations')
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(dir, f), 'utf8'))
  }
  await db.exec(GRANTS)
  await db.exec(`insert into auth.users (id) values ('${A}'), ('${B}');`)
})

afterAll(async () => {
  await db.close()
})

describe('RLS isolation', () => {
  let cardA: string

  it('creates a settings row for each new user', async () => {
    const r = await db.query<{ n: number }>(`select count(*)::int as n from public.settings`)
    expect(r.rows[0].n).toBe(2)
  })

  it('lets a user insert and read their own rows', async () => {
    await as(A, async () => {
      const r = await db.query<{ id: string }>(
        `insert into public.cards (title, position) values ('مرحبا Hello', 'a0') returning id`,
      )
      cardA = r.rows[0].id
      const s = await db.query(`select * from public.cards`)
      expect(s.rows).toHaveLength(1)
    })
  })

  it("hides another user's rows", async () => {
    await as(B, async () => {
      expect((await db.query(`select * from public.cards`)).rows).toHaveLength(0)
      expect((await db.query(`select * from public.settings`)).rows).toHaveLength(1)
    })
  })

  it("cannot update or delete another user's rows", async () => {
    await as(B, async () => {
      const u = await db.query(`update public.cards set title = 'hacked' where id = '${cardA}' returning id`)
      expect(u.rows).toHaveLength(0)
      const d = await db.query(`delete from public.cards where id = '${cardA}' returning id`)
      expect(d.rows).toHaveLength(0)
    })
  })

  it('rejects inserting a row owned by someone else', async () => {
    await as(B, async () => {
      await expect(
        db.query(`insert into public.cards (user_id, title, position) values ('${A}', 'x', 'a0')`),
      ).rejects.toThrow(/row-level security/)
    })
  })

  it("rejects linking to another user's card (composite FK)", async () => {
    await as(B, async () => {
      const mine = await db.query<{ id: string }>(
        `insert into public.cards (title, position) values ('mine', 'a0') returning id`,
      )
      await expect(
        db.query(
          `insert into public.card_links (from_card_id, to_card_id, kind) values ('${mine.rows[0].id}', '${cardA}', 'manual')`,
        ),
      ).rejects.toThrow()
    })
  })

  it("rejects putting a card in another user's column", async () => {
    let colA = ''
    await as(A, async () => {
      colA = (await db.query<{ id: string }>(
        `insert into public.columns (name, position) values ('Todo', 'a0') returning id`,
      )).rows[0].id
    })
    await as(B, async () => {
      await expect(
        db.query(`insert into public.cards (title, position, column_id) values ('x', 'a1', '${colA}')`),
      ).rejects.toThrow()
    })
  })
})

describe('time_sessions', () => {
  it('allows only one running session per user, but one per user in parallel', async () => {
    let c1 = ''
    let c2 = ''
    await as(A, async () => {
      const r = await db.query<{ id: string }>(`select id from public.cards limit 1`)
      c1 = r.rows[0].id
      c2 = (await db.query<{ id: string }>(
        `insert into public.cards (title, position) values ('second', 'a2') returning id`,
      )).rows[0].id
      await db.query(`insert into public.time_sessions (card_id) values ('${c1}')`)
      await expect(db.query(`insert into public.time_sessions (card_id) values ('${c2}')`)).rejects.toThrow(
        /duplicate key/,
      )
      await db.query(`update public.time_sessions set ended_at = now() where ended_at is null`)
      await db.query(`insert into public.time_sessions (card_id) values ('${c2}')`)
    })
    await as(B, async () => {
      const mine = (await db.query<{ id: string }>(`select id from public.cards limit 1`)).rows[0].id
      await db.query(`insert into public.time_sessions (card_id) values ('${mine}')`)
    })
  })
})

describe('search (Arabic + English)', () => {
  it('finds Arabic text by full-text and trigram fallback', async () => {
    await as(A, async () => {
      await db.query(
        `insert into public.cards (title, body_md, position) values ('درس الشبكات', 'مقدمة في الشبكات و network basics', 'b0')`,
      )
      const fts = await db.query(
        `select title from public.cards where search @@ plainto_tsquery('simple', 'الشبكات')`,
      )
      expect(fts.rows.length).toBeGreaterThanOrEqual(1)
      // Partial / prefix-ish match that FTS 'simple' misses falls back to trigram similarity.
      const trgm = await db.query(`select title from public.cards where title % 'الشبكة' or title ilike '%شبك%'`)
      expect(trgm.rows.length).toBeGreaterThanOrEqual(1)
      const en = await db.query(`select title from public.cards where search @@ plainto_tsquery('simple', 'network')`)
      expect(en.rows).toHaveLength(1)
    })
  })
})
