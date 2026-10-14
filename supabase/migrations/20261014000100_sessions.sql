-- Server-anchored focus sessions. The database clock is the only clock that writes
-- started_at / paused_at / ended_at, so a wrong or sleeping browser cannot skew time.
-- Elapsed = (ended_at | paused_at | now) - started_at - paused_total_sec, computed by readers.
-- All functions are SECURITY INVOKER: RLS on time_sessions applies, so users only touch their own rows.

alter table public.time_sessions
  add column on_break boolean not null default false, -- Pomodoro break: paused, but not manually paused
  add column breaks_taken int not null default 0;      -- completed Pomodoro focus blocks

create function public.server_now() returns timestamptz
language sql stable as $$ select now() $$;

-- Ends the caller's running session, if any (folding an open pause into paused_total_sec).
create function public.session_finish() returns public.time_sessions
language plpgsql as $$
declare s public.time_sessions;
begin
  update public.time_sessions
     set paused_total_sec = paused_total_sec
           + case when paused_at is null then 0 else round(extract(epoch from now() - paused_at))::int end,
         paused_at = null,
         on_break = false,
         ended_at = now()
   where ended_at is null
   returning * into s;
  return s;
end $$;

-- Starts a session on a card. Any session already running is finished first, so there is
-- never more than one (the partial unique index is the backstop).
create function public.session_start(p_card uuid, p_mode text default 'timer', p_estimate int default null)
returns public.time_sessions
language plpgsql as $$
declare s public.time_sessions;
begin
  perform public.session_finish();
  insert into public.time_sessions (card_id, mode, estimate_snapshot_min)
  values (
    p_card,
    p_mode,
    coalesce(p_estimate, (select estimate_min from public.cards where id = p_card))
  )
  returning * into s;
  return s;
end $$;

create function public.session_pause(p_break boolean default false) returns public.time_sessions
language plpgsql as $$
declare s public.time_sessions;
begin
  update public.time_sessions
     set paused_at = now(), on_break = p_break,
         breaks_taken = breaks_taken + case when p_break then 1 else 0 end
   where ended_at is null and paused_at is null
   returning * into s;
  return s;
end $$;

create function public.session_resume() returns public.time_sessions
language plpgsql as $$
declare s public.time_sessions;
begin
  update public.time_sessions
     set paused_total_sec = paused_total_sec + round(extract(epoch from now() - paused_at))::int,
         paused_at = null,
         on_break = false
   where ended_at is null and paused_at is not null
   returning * into s;
  return s;
end $$;

-- "+10 min": raise the running session's estimate.
create function public.session_extend(p_minutes int) returns public.time_sessions
language plpgsql as $$
declare s public.time_sessions;
begin
  update public.time_sessions
     set estimate_snapshot_min = coalesce(estimate_snapshot_min, 0) + p_minutes
   where ended_at is null
   returning * into s;
  return s;
end $$;

grant execute on function
  public.server_now(), public.session_finish(), public.session_start(uuid, text, int),
  public.session_pause(boolean), public.session_resume(), public.session_extend(int)
  to authenticated;
