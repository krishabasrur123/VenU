-- Fixes from the review of the night batch (2026-11-18). Review before applying:
--   supabase db push   (or paste into the SQL editor)
--
-- 1. Ratings and problem reports only for help that happened. 20261118030000 relaxed
--    matched_has_volunteer so a finished request can outlive its volunteer's account, which also let
--    a visitor mark a request nobody took as 'done' (close_help_request(id, 'done') on an open one),
--    and the help_feedback insert policy took 'done' as proof a volunteer took it: a visitor could
--    rate, or report a "no-show" for, help that never happened.
--    matched_at is what marks that a volunteer accepted: accept_help_request sets it, a hand-back
--    (release_help_request, or the volunteer deleting their account mid-help) clears it with the
--    volunteer, and finishing keeps it. A volunteer who deletes their account after finishing leaves
--    volunteer_id null but matched_at set, so their visitor can still rate or report that help.
--    a. close_help_request(id, 'done') on a request still open (nobody took it) cancels it instead.
--    b. A 'done' request must have been matched (done_was_matched). Any 'done' row that never was is
--       turned into 'cancelled' first (live had none when this was written).
--    c. The rate-or-report policy requires matched_at.
-- 2. facility_reports.author_id (an auth user id) was readable by every signed-in user, so anyone
--    could follow one person's reports across venues. The app only needed it to mark your own
--    reports (`mine`, to offer Delete). Now:
--    - authenticated reads every column of facility_reports except author_id (column grants);
--    - public.facility_report_cards (a security_invoker view, so the table's RLS and grants apply to
--      the caller) adds `mine`, worked out on the server by private.is_own_report(id);
--    - insert and delete are unchanged: the policies still compare author_id with auth.uid()
--      (policies don't need the caller to have the column), and the app reads the inserted row back
--      without author_id (src/features/venue/report-db.ts).
-- Matches scripts/mock-supabase.mjs.

-- ---- 1. help that happened

-- a. Same as 20261117010000, except 'done' on a request nobody took (still open) cancels it.
create or replace function public.close_help_request(p_request_id uuid, p_status text) returns void
  language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if p_status not in ('cancelled', 'done') then
    raise exception 'bad_status' using errcode = '22023';
  end if;
  update public.help_requests r
     set status = case when r.status = 'matched' then p_status else 'cancelled' end,
         closed_by = me,
         closed_at = now()
   where r.id = p_request_id
     and r.status in ('open', 'matched')
     and (r.visitor_id = me or (r.volunteer_id = me and r.status = 'matched' and p_status = 'done'));
end;
$$;

-- create or replace keeps the existing grants; restated so this file says who may call it.
revoke all on function public.close_help_request(uuid, text) from public, anon, authenticated;
grant execute on function public.close_help_request(uuid, text) to authenticated;

-- b.
update public.help_requests set status = 'cancelled' where status = 'done' and matched_at is null;
alter table public.help_requests
  add constraint done_was_matched check (status <> 'done' or matched_at is not null);

-- c. The visitor or the volunteer on a request a volunteer took (matched, or finished).
drop policy "parties rate or report" on public.help_feedback;
create policy "parties rate or report" on public.help_feedback
  for insert to authenticated with check (
    (select auth.uid()) = author_id
    and (select private.is_help_party(request_id))
    and exists (
      select 1 from public.help_requests r
      where r.id = request_id and r.status in ('matched', 'done') and r.matched_at is not null
    )
  );

-- ---- 2. report authors stay private

revoke select on public.facility_reports from authenticated;
grant select (id, venue_id, facility_id, author_name, title, topic, body, language, created_at)
  on public.facility_reports to authenticated;

-- True when the caller wrote the report. Security definer: it reads author_id, which the caller
-- can't. It only ever answers about the caller's own reports.
create function private.is_own_report(p_report_id uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.facility_reports r
    where r.id = p_report_id and r.author_id = (select auth.uid())
  );
$$;

-- The view calls it as the reader (authenticated). Schema private isn't exposed, so it's no RPC,
-- and API roles have no USAGE on private: the view calls it by oid, like the policies' helpers
-- (20261118000000_db_hardening.sql).
revoke all on function private.is_own_report(uuid) from public, anon, authenticated;
grant execute on function private.is_own_report(uuid) to authenticated;

-- What the app lists: every report column but author_id, plus mine.
create view public.facility_report_cards with (security_invoker = true) as
  select r.id, r.venue_id, r.facility_id, r.author_name, r.title, r.topic, r.body, r.language, r.created_at,
         private.is_own_report(r.id) as mine
    from public.facility_reports r;

revoke all on public.facility_report_cards from public, anon, authenticated;
grant select on public.facility_report_cards to authenticated;
