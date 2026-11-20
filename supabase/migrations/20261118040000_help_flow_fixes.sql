-- Help request lifecycle fixes (night batch 2026-11-18).
--
-- withdraw_open_request(id): the visitor's app gives up after 2 minutes with nobody free
-- (SEARCH_TIMEOUT_MS in src/features/volunteer/request-store.ts). It used to call
-- close_help_request(id, 'cancelled'), which also cancels a request a volunteer has just accepted:
-- a phone that locked its screen runs the 2-minute timer late, the volunteer accepts in between,
-- and is then thrown out of the chat with "<visitor> cancelled the request". This cancels only a
-- request that is still open, in one statement (an Accept landing at the same moment waits for the
-- row lock, then finds it cancelled; or the withdraw waits and finds it matched), and returns the
-- row either way, so the app shows the match instead of "No volunteer is free right now":
--   status 'cancelled'  withdrawn now (or closed before)    → "No volunteer is free right now"
--   status 'matched'    a volunteer took it first           → "Volunteer found"
--   null                not this caller's request
-- close_help_request is unchanged: the visitor's own Cancel still calls off a matched volunteer.
-- Matches src/features/volunteer/supabase-backend.ts (withdraw) and scripts/mock-supabase.mjs.
create function public.withdraw_open_request(p_request_id uuid) returns public.help_requests
  language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  result public.help_requests;
begin
  update public.help_requests r
     set status = 'cancelled', closed_by = me, closed_at = now()
   where r.id = p_request_id and r.visitor_id = me and r.status = 'open'
  returning * into result;
  if result.id is null then
    select * into result from public.help_requests r where r.id = p_request_id and r.visitor_id = me;
  end if;
  return result;
end;
$$;

-- Supabase's default privileges grant EXECUTE on new public functions to anon and authenticated
-- (see 20261118000000_db_hardening.sql): take it all away, then give back only signed-in users.
revoke all on function public.withdraw_open_request(uuid) from public, anon, authenticated;
grant execute on function public.withdraw_open_request(uuid) to authenticated;
