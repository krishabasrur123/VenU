-- Fixes what the Supabase advisors flag. Review before applying:
--   supabase db push   (or paste into the SQL editor)
--
-- Why anon could call everything: Supabase's default privileges grant EXECUTE on every new function
-- in public straight to anon, authenticated and service_role. The earlier migrations' `revoke all …
-- from public` only removed the PUBLIC grant, so those direct grants stayed and every function was
-- an RPC at /rest/v1/rpc/<name> for anyone with the anon key. So each revoke below names public,
-- anon (and authenticated where needed) explicitly.
--
-- Who can execute afterwards:
--   claim_username, reclaim_username_on_confirm, touch_updated_at   nobody (triggers fire anyway:
--       Postgres checks EXECUTE when a trigger is created, not each time it fires)
--   accept/close/release_help_request, open_help_requests            authenticated
--   is_volunteer, is_help_party, can_read_message                    authenticated, in schema private
--   username_available                                               anon, authenticated (unchanged)
--   email_for_username                                               service_role (unchanged)

-- 1. Trigger functions: nobody calls them directly.
revoke all on function public.claim_username() from public, anon, authenticated;
revoke all on function public.reclaim_username_on_confirm() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;

-- 2. Help-request RPCs: signed-in only (src/features/volunteer/supabase-backend.ts; a volunteer
-- releases a request before signing out, src/lib/before-sign-out.ts).
revoke all on function public.accept_help_request(uuid) from public, anon;
revoke all on function public.close_help_request(uuid, text) from public, anon;
revoke all on function public.release_help_request(uuid) from public, anon;
revoke all on function public.open_help_requests() from public, anon;
grant execute on function public.accept_help_request(uuid) to authenticated;
grant execute on function public.close_help_request(uuid, text) to authenticated;
grant execute on function public.release_help_request(uuid) to authenticated;
grant execute on function public.open_help_requests() to authenticated;

-- 3. The helpers the help_requests and messages policies call. A policy runs with the caller's
-- privileges, so authenticated must keep EXECUTE (without it every read of those tables fails with
-- "permission denied for function is_volunteer"), but nothing needs them as RPCs. Schema private
-- isn't in the API's exposed schemas (keep it out of Settings → API → Exposed schemas), so moving
-- them there removes the endpoints while the policies keep working: a policy stores the function's
-- oid, not its name, and ALTER … SET SCHEMA keeps the oid. pg_policies now shows private.is_volunteer()
-- etc. Calling by oid skips the schema USAGE check, so no API role gets USAGE on private; a later
-- policy (created by postgres) can still name private.*, and one that redefines a helper must use
-- the private.* name. No policy is for anon, so anon gets no EXECUTE either.
create schema if not exists private;
revoke all on schema private from public;

alter function public.is_volunteer() set schema private;
alter function public.is_help_party(uuid) set schema private;
alter function public.can_read_message(uuid, uuid, timestamptz) set schema private;

revoke all on function private.is_volunteer() from public, anon;
revoke all on function private.is_help_party(uuid) from public, anon;
revoke all on function private.can_read_message(uuid, uuid, timestamptz) from public, anon;
grant execute on function private.is_volunteer() to authenticated;
grant execute on function private.is_help_party(uuid) to authenticated;
grant execute on function private.can_read_message(uuid, uuid, timestamptz) to authenticated;

-- username_available stays callable by anon: Create Account checks the name before sign-up, signed
-- out (src/lib/auth.ts). The advisor's warning for it is accepted; it says only whether a name is
-- taken, which the sign-up itself would reveal anyway.

-- 4. Indexes for the two foreign keys without one (deleting an auth user scans these columns).
create index if not exists help_requests_closed_by on public.help_requests (closed_by);
create index if not exists messages_sender on public.messages (sender_id);

-- 5. usernames has RLS on and no policies on purpose (advisor: rls_enabled_no_policy).
comment on table public.usernames is
  'RLS on with no policies on purpose: clients never read or write this table. Sign-up claims a name '
  'through the claim_username trigger, Create Account checks with username_available(), and Sign In '
  'looks the email up server-side (email_for_username, service role only).';
