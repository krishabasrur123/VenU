-- What visitors report or rate, saved on the server. Review before applying:
--   supabase db push   (or paste into the SQL editor)
--
--   facility_reports  "Add report" on a facility (src/features/venue/reports.ts). Crowd-sourced, so
--                     every signed-in user reads them; you add them as yourself and may delete your own.
--                     The author shows by first name only, copied from their profile when the report
--                     is saved (set_report_author_name), so nobody can post under another name and no
--                     one reads anyone's profile or email.
--   help_feedback     After help: the visitor's stars ('rating') or "Report a problem" ('problem')
--                     (src/features/volunteer/supabase-backend.ts). Only the visitor or volunteer on
--                     the request may write one, one rating per person per request. The volunteer reads
--                     the visitor's ratings of the requests they helped (for their stats later: average
--                     stars, helps count), authors read their own ratings, and problem reports are
--                     write-only: staff read them in the dashboard.
--   app_feedback      Profile → Help & feedback (src/app/help.tsx). Write-only from the app.
--
-- Matches the mock in scripts/mock-supabase.mjs.

-- ---- facility reports

create table public.facility_reports (
  id           uuid primary key default gen_random_uuid(),
  -- e.g. 'sofi' and 'entry-4' (src/features/venue/mock.ts).
  venue_id     text not null check (char_length(venue_id) between 1 and 40),
  facility_id  text not null check (char_length(facility_id) between 1 and 80),
  author_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- The author's first name when they posted (set_report_author_name), '' when they had none.
  author_name  text not null default '' check (char_length(author_name) <= 40),
  title        text not null check (char_length(btrim(title)) between 1 and 80),
  topic        text not null check (topic in ('accessibility', 'directions', 'facility_condition', 'security', 'crowds', 'other')),
  body         text not null default '' check (char_length(body) <= 1000),
  -- The language the title and body were written in, e.g. 'es'. Shown as written, never translated.
  language     text check (char_length(language) between 2 and 12),
  created_at   timestamptz not null default now()
);

create index facility_reports_facility on public.facility_reports (venue_id, facility_id, created_at desc);
create index facility_reports_author on public.facility_reports (author_id);

-- The author's first name from their profile, whatever the app sent. Security definer so it reads
-- one column of the author's own row without a profiles policy for other readers.
create function private.set_report_author_name() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  new.author_name := coalesce((select left(btrim(p.first_name), 40) from public.profiles p where p.id = new.author_id), '');
  return new;
end;
$$;

-- A trigger function: nobody calls it (Postgres checks EXECUTE when the trigger is created, not when it fires).
revoke all on function private.set_report_author_name() from public, anon, authenticated;

create trigger facility_reports_author_name
  before insert on public.facility_reports
  for each row execute function private.set_report_author_name();

alter table public.facility_reports enable row level security;

create policy "signed-in users read reports" on public.facility_reports
  for select to authenticated using (true);

create policy "authors add reports" on public.facility_reports
  for insert to authenticated with check ((select auth.uid()) = author_id);

create policy "authors delete their reports" on public.facility_reports
  for delete to authenticated using ((select auth.uid()) = author_id);

revoke all on public.facility_reports from anon, authenticated;
-- No updates. author_id, author_name, id and created_at come from the server.
grant select, delete on public.facility_reports to authenticated;
grant insert (venue_id, facility_id, title, topic, body, language) on public.facility_reports to authenticated;

-- ---- ratings and problem reports after help

create table public.help_feedback (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.help_requests (id) on delete cascade,
  author_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('rating', 'problem')),
  -- Ratings: 1–5 stars and what went well (src/features/volunteer/mock.ts FEEDBACK_TAGS).
  stars       smallint check (stars between 1 and 5),
  tags        text[] not null default '{}' check (
                cardinality(tags) <= 6 and tags <@ array['language', 'venue', 'patient', 'fast', 'helpful', 'other']),
  -- Problem reports: what went wrong (PROBLEM_KINDS).
  problem     text check (problem in ('no_show', 'unsafe', 'rude', 'other')),
  note        text not null default '' check (char_length(note) <= 1000),
  created_at  timestamptz not null default now(),

  constraint rating_or_problem check (
    (kind = 'rating' and stars is not null and problem is null)
    or (kind = 'problem' and stars is null and problem is not null and cardinality(tags) = 0)
  )
);

create index help_feedback_request on public.help_feedback (request_id);
create index help_feedback_author on public.help_feedback (author_id);
-- One rating per person per request; a retried Submit gets 23505, which the app treats as sent.
create unique index help_feedback_one_rating on public.help_feedback (request_id, author_id) where kind = 'rating';

alter table public.help_feedback enable row level security;

-- The visitor or the volunteer on a request that a volunteer took (matched, or finished).
create policy "parties rate or report" on public.help_feedback
  for insert to authenticated with check (
    (select auth.uid()) = author_id
    and (select private.is_help_party(request_id))
    and exists (select 1 from public.help_requests r where r.id = request_id and r.status in ('matched', 'done'))
  );

-- Ratings only: problem reports aren't readable through the API, not even by their author.
create policy "authors and their volunteer read ratings" on public.help_feedback
  for select to authenticated using (
    kind = 'rating'
    and (
      (select auth.uid()) = author_id
      or exists (
        select 1 from public.help_requests r
        where r.id = request_id and r.volunteer_id = (select auth.uid()) and r.visitor_id = author_id
      )
    )
  );

revoke all on public.help_feedback from anon, authenticated;
grant select on public.help_feedback to authenticated;
grant insert (request_id, kind, stars, tags, problem, note) on public.help_feedback to authenticated;

-- ---- Help & feedback

create table public.app_feedback (
  id          uuid primary key default gen_random_uuid(),
  -- Kept (author cleared) when the account is deleted. The screen is only reachable signed in.
  author_id   uuid default auth.uid() references auth.users (id) on delete set null,
  note        text not null check (char_length(btrim(note)) between 1 and 1000),
  -- The app language at the time, e.g. 'es', and where it was sent from.
  language    text check (char_length(language) between 2 and 12),
  platform    text check (platform in ('ios', 'android', 'web')),
  created_at  timestamptz not null default now()
);

create index app_feedback_author on public.app_feedback (author_id);

alter table public.app_feedback enable row level security;

create policy "signed-in users send feedback" on public.app_feedback
  for insert to authenticated with check ((select auth.uid()) = author_id);

revoke all on public.app_feedback from anon, authenticated;
grant insert (note, language, platform) on public.app_feedback to authenticated;
