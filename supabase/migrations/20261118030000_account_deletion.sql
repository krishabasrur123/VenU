-- Deleting an account (the delete-account Edge Function: auth.admin.deleteUser) must not fail and
-- must not take the other person's help history with it. Review before applying:
--   supabase db push   (or paste into the SQL editor)
--
-- What happens to each reference to auth.users when a user is deleted:
--   profiles.id, usernames.user_id, users.id (→ profiles_attendees/_volunteers)   cascade: gone, and the
--       username is free again (unchanged)
--   help_requests.visitor_id     was cascade (the volunteer's history of that request vanished);
--                                now set null: the row stays, with visitor_name as it was
--   help_requests.volunteer_id   set null (unchanged), volunteer_name etc. stay. Before this, the
--                                matched_has_volunteer check made the whole delete fail for any
--                                volunteer with a finished ('done') request
--   help_requests.closed_by      set null (unchanged)
--   messages.sender_id           cascade (unchanged): what the deleted user wrote goes with them; the
--                                other person keeps the request and their own messages
-- And a still-running request can't be left behind: before the user row goes, their open or matched
-- requests as a visitor are cancelled, and one they're helping with as a volunteer opens again for
-- the next volunteer (what release_help_request does when a volunteer signs out).
-- Tables added later that reference auth.users need ON DELETE CASCADE or SET NULL too, or the
-- function answers 502 ("Database error deleting user" in its logs).

-- 1. Requests outlive their visitor.
alter table public.help_requests alter column visitor_id drop not null;
alter table public.help_requests drop constraint help_requests_visitor_id_fkey;
alter table public.help_requests
  add constraint help_requests_visitor_id_fkey foreign key (visitor_id) references auth.users (id) on delete set null;

-- 2. Only a matched request needs its volunteer. A finished one keeps volunteer_name when the
-- volunteer's account is deleted (and a visitor can mark an open request done, which this check
-- used to refuse).
alter table public.help_requests drop constraint matched_has_volunteer;
alter table public.help_requests
  add constraint matched_has_volunteer check (status <> 'matched' or volunteer_id is not null);

-- 3. Close or hand back the user's running requests before the user row (and its FKs) go.
-- In schema private, owned by postgres; fires as Supabase Auth (supabase_auth_admin) deletes.
create schema if not exists private;

create function private.end_requests_of_deleted_user() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  update public.help_requests r
     set status = 'cancelled', closed_at = now()
   where r.visitor_id = old.id and r.status in ('open', 'matched');
  update public.help_requests r
     set status = 'open',
         volunteer_id = null,
         volunteer_name = null,
         volunteer_languages = null,
         volunteer_trainings = null,
         matched_at = null,
         opened_at = now()
   where r.volunteer_id = old.id and r.status = 'matched';
  return old;
end;
$$;

revoke all on function private.end_requests_of_deleted_user() from public, anon, authenticated;

create trigger end_requests_of_deleted_user before delete on auth.users
  for each row execute function private.end_requests_of_deleted_user();
