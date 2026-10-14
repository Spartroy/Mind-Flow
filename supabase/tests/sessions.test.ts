import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const A = '00000000-0000-0000-0000-0000000000a1'
const B = '00000000-0000-0000-0000-0000000000b1'

const PRELUDE = `
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  create role authenticated nologin;
  grant usage on schema public, auth to authenticated;
  grant execute on function auth.uid() to authenticated;
`

interface Session {
  id: string
  card_id: string
  ended_at: string | null
  paused_at: string | null
  paused_total_sec: number
  mode: string
  on_break: boolean
  estimate_snapshot_min: number | null
}

let db: PGlite
let cardA1: string
let cardA2: string

async function as<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set test.uid = '${uid}'; set role authenticated;`)
  try {
    return await fn()
  } finally {
    await db.exec(`reset role; reset test.uid;`)
  }
}
const one = async (sql: string) => (await db.query<Session>(sql)).rows[0]
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

beforeAll(async () => {
  db = new PGlite({ extensions: { pg_trgm } })
  await db.exec(PRELUDE)
  const dir = join(process.cwd(), 'supabase', 'migrations')
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.sql')).sort()) await db.exec(readFileSync(join(dir, f), 'utf8'))
  await db.exec(`grant select, insert, update, delete on all tables in schema public to authenticated;`)
  await db.exec(`insert into auth.users (id) values ('${A}'), ('${B}');`)
  await as(A, async () => {
    cardA1 = (await db.query<{ id: string }>(`insert into public.cards (title, position, estimate_min) values ('one', 'a0', 45) returning id`)).rows[0].id
    cardA2 = (await db.query<{ id: string }>(`insert into public.cards (title, position) values ('two', 'a1') returning id`)).rows[0].id
  })
})
afterAll(async () => db.close())

describe('session functions', () => {
  it('starts a session anchored to the server clock, snapshotting the card estimate', async () => {
    const s = await as(A, () => one(`select * from public.session_start('${cardA1}', 'timer')`))
    expect(s.ended_at).toBeNull()
    expect(s.paused_at).toBeNull()
    expect(s.estimate_snapshot_min).toBe(45)
    expect(s.mode).toBe('timer')
  })

  it('finishes the running session when another one starts: never two running', async () => {
    await as(A, () => one(`select * from public.session_start('${cardA2}', 'pomodoro', 25)`))
    const running = await db.query(`select 1 from public.time_sessions where user_id = '${A}' and ended_at is null`)
    expect(running.rows).toHaveLength(1)
    const first = await db.query<Session>(`select * from public.time_sessions where card_id = '${cardA1}'`)
    expect(first.rows[0].ended_at).not.toBeNull()
  })

  it('pauses and resumes, adding the paused time to paused_total_sec', async () => {
    await as(A, async () => {
      const p = await one(`select * from public.session_pause()`)
      expect(p.paused_at).not.toBeNull()
      expect(p.on_break).toBe(false)
      await sleep(1100)
      const r = await one(`select * from public.session_resume()`)
      expect(r.paused_at).toBeNull()
      expect(r.paused_total_sec).toBeGreaterThanOrEqual(1)
    })
  })

  it('pausing twice or resuming when not paused changes nothing', async () => {
    await as(A, async () => {
      await one(`select * from public.session_pause(true)`)
      const again = await one(`select * from public.session_pause()`)
      expect(again?.on_break ?? true).toBe(true) // second pause matched no row
      const before = (await one(`select * from public.time_sessions where ended_at is null`)).paused_total_sec
      await one(`select * from public.session_resume()`)
      const none = await one(`select * from public.session_resume()`)
      expect(none?.id ?? null).toBeNull()
      expect((await one(`select * from public.time_sessions where ended_at is null`)).paused_total_sec).toBeGreaterThanOrEqual(before)
    })
  })

  it('extends the estimate by 10 minutes', async () => {
    const s = await as(A, () => one(`select * from public.session_extend(10)`))
    expect(s.estimate_snapshot_min).toBe(35)
  })

  it('finishing while paused folds the open pause into the total', async () => {
    await as(A, async () => {
      const before = (await one(`select * from public.time_sessions where ended_at is null`)).paused_total_sec
      await one(`select * from public.session_pause()`)
      await sleep(1100)
      const done = await one(`select * from public.session_finish()`)
      expect(done.ended_at).not.toBeNull()
      expect(done.paused_at).toBeNull()
      expect(done.paused_total_sec).toBeGreaterThanOrEqual(before + 1)
    })
  })

  it("never touches another user's session", async () => {
    await as(A, () => one(`select * from public.session_start('${cardA1}')`))
    await as(B, async () => {
      expect(await one(`select * from public.session_pause()`)).toSatisfy((r: Session | undefined) => !r || r.id === null)
      expect(await one(`select * from public.session_finish()`)).toSatisfy((r: Session | undefined) => !r || r.id === null)
    })
    const a = await db.query(`select 1 from public.time_sessions where user_id = '${A}' and ended_at is null and paused_at is null`)
    expect(a.rows).toHaveLength(1)
  })

  it("cannot start a session on someone else's card", async () => {
    await as(B, async () => {
      await expect(db.query(`select * from public.session_start('${cardA1}')`)).rejects.toThrow()
    })
  })

  it('server_now returns a timestamp', async () => {
    const r = await db.query<{ server_now: Date }>(`select public.server_now()`)
    expect(r.rows[0].server_now).toBeInstanceOf(Date)
  })
})
