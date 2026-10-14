-- NeuroFlow initial schema. Every table is user-scoped and protected by RLS.
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------- helpers
create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------- tables
create table public.columns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  color text not null default 'teal',
  position text not null,
  unique (id, user_id)
);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default '',
  body_md text not null default '',
  column_id uuid,
  position text not null,
  estimate_min int check (estimate_min is null or estimate_min >= 0),
  is_today boolean not null default false,
  today_position text,
  due_date date,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 'simple' config: no stemming, so Arabic and English tokenise the same way.
  search tsvector generated always as (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(body_md, ''))
  ) stored,
  unique (id, user_id),
  foreign key (column_id, user_id) references public.columns (id, user_id) on delete set null (column_id)
);
create index cards_user_column_idx on public.cards (user_id, column_id, position);
create index cards_today_idx on public.cards (user_id, today_position) where is_today;
create index cards_search_idx on public.cards using gin (search);
create index cards_title_trgm_idx on public.cards using gin (title gin_trgm_ops);
create index cards_body_trgm_idx on public.cards using gin (body_md gin_trgm_ops);
create trigger cards_updated_at before update on public.cards
  for each row execute function public.set_updated_at();

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  color_index int not null default 0 check (color_index between 0 and 7),
  unique (id, user_id),
  unique (user_id, name)
);

create table public.card_tags (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_id uuid not null,
  tag_id uuid not null,
  primary key (card_id, tag_id),
  foreign key (card_id, user_id) references public.cards (id, user_id) on delete cascade,
  foreign key (tag_id, user_id) references public.tags (id, user_id) on delete cascade
);

create table public.card_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  from_card_id uuid not null,
  to_card_id uuid not null,
  kind text not null check (kind in ('wikilink', 'manual', 'parent')),
  foreign key (from_card_id, user_id) references public.cards (id, user_id) on delete cascade,
  foreign key (to_card_id, user_id) references public.cards (id, user_id) on delete cascade,
  unique (from_card_id, to_card_id, kind),
  check (from_card_id <> to_card_id)
);
create index card_links_to_idx on public.card_links (to_card_id);

create table public.time_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_id uuid not null,
  started_at timestamptz not null default now(),   -- server time is the anchor
  ended_at timestamptz,
  paused_at timestamptz,                           -- set while paused; folded into paused_total_sec on resume
  paused_total_sec int not null default 0 check (paused_total_sec >= 0),
  mode text not null default 'timer' check (mode in ('timer', 'pomodoro', 'writing')),
  estimate_snapshot_min int,
  foreign key (card_id, user_id) references public.cards (id, user_id) on delete cascade
);
create index time_sessions_card_idx on public.time_sessions (card_id);
create index time_sessions_user_started_idx on public.time_sessions (user_id, started_at);
-- Only one running session per user.
create unique index time_sessions_one_running_idx on public.time_sessions (user_id) where ended_at is null;

create table public.mind_maps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  scope text not null default 'all',
  unique (id, user_id)
);

create table public.map_nodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  map_id uuid not null,
  card_id uuid,                                    -- null = free node
  x double precision not null default 0,
  y double precision not null default 0,
  label text,
  foreign key (map_id, user_id) references public.mind_maps (id, user_id) on delete cascade,
  foreign key (card_id, user_id) references public.cards (id, user_id) on delete cascade,
  check (card_id is not null or label is not null)
);
create unique index map_nodes_card_uniq on public.map_nodes (map_id, card_id) where card_id is not null;

create table public.settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  locale text not null default 'en' check (locale in ('en', 'ar')),
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  week_start int not null default 0 check (week_start between 0 and 6),
  default_estimate_min int not null default 25,
  pomodoro_focus_min int not null default 25,
  pomodoro_break_min int not null default 5,
  auto_float_timer boolean not null default false,
  overtime_message boolean not null default true,
  sound boolean not null default false
);

-- ---------------------------------------------------------------- RLS
do $$
declare t text;
begin
  foreach t in array array[
    'columns', 'cards', 'tags', 'card_tags', 'card_links',
    'time_sessions', 'mind_maps', 'map_nodes', 'settings'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t || '_owner', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- new-user bootstrap
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.settings (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
