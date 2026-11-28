-- Volunteer settings on the server, and verified volunteers. Review before applying:
--   supabase db push   (or paste into the SQL editor)
--
-- 1. profiles.availability (Free / Busy / Off, the volunteer tab's "Your status") and
--    profiles.notification_prefs (Profile → Notifications), so they follow the account to any
--    device and matching can read them. The owner writes both; availability_updated_at is stamped
--    by the server whenever availability changes.
-- 2. profiles.verified: only an admin changes it (Table Editor / SQL editor run as postgres, or the
--    service role). A trigger forces it, so a client insert with verified = true comes out false and
--    no client update can change it (the column grants already leave it out; this holds even if a
--    later migration grants update on the whole table).
-- 3. accept_help_request refuses unverified volunteers with 'not_verified' (the app says "LA28 is
--    still verifying you"). They still finish setup and see open requests.
--
-- For matching (src/features/volunteer, Krisha): a volunteer can take requests when
--   role = 'volunteer' and verified and availability = 'free'
-- and notification_prefs->>'volunteer' says whether they want request alerts.

-- 1. Settings columns. Default Free, as the app shows before anything is saved
-- (src/features/volunteer/availability.ts), and every alert on (src/features/settings/notification-prefs.ts).
alter table public.profiles
  add column availability text not null default 'free' check (availability in ('free', 'busy', 'off')),
  add column availability_updated_at timestamptz not null default now(),
  add column notification_prefs jsonb not null
    default '{"volunteer": true, "chat": true, "venue": true, "reports": true}'::jsonb
    constraint notification_prefs_shape check (
      jsonb_typeof(notification_prefs) = 'object'
      and notification_prefs - array['volunteer', 'chat', 'venue', 'reports'] = '{}'::jsonb
      and not jsonb_path_exists(notification_prefs, '$.* ? (@.type() != "boolean")')
    );

-- The owner changes them (the "update own profile" policy limits it to their own row).
grant update (availability, notification_prefs) on public.profiles to authenticated;

-- 2. The guard. Security invoker on purpose: current_user is the caller's role (authenticated from
-- the app; postgres from the dashboard; service_role from a server key).
create function private.profiles_guard() returns trigger
  language plpgsql set search_path = '' as $$
begin
  if current_user not in ('postgres', 'service_role', 'supabase_admin') then
    if tg_op = 'INSERT' then
      new.verified := false;
    else
      new.verified := old.verified;
    end if;
  end if;

  if tg_op = 'INSERT' or new.availability is distinct from old.availability then
    new.availability_updated_at := now();
  else
    new.availability_updated_at := old.availability_updated_at;
  end if;
  return new;
end;
$$;

revoke all on function private.profiles_guard() from public, anon, authenticated;

create trigger profiles_guard before insert or update on public.profiles
  for each row execute function private.profiles_guard();

-- Nothing on profiles is for signed-out callers (every policy is for authenticated), and the API
-- never needs TRUNCATE, REFERENCES or TRIGGER (TRUNCATE skips row-level security).
revoke all on public.profiles from anon;
revoke truncate, references, trigger on public.profiles from authenticated;

-- 3. Accept: as in 20261117010000_help_requests_chat.sql, plus the verified check. Raises
--   'not_verified'     this volunteer isn't verified yet ("LA28 is still verifying you")
-- and the earlier 'not_a_volunteer', 'already_helping', 'already_taken', 'request_closed'.
create or replace function public.accept_help_request(p_request_id uuid) returns public.help_requests
  language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  vol public.profiles;
  accepted public.help_requests;
begin
  select * into vol from public.profiles p where p.id = me and p.role = 'volunteer';
  if not found then
    raise exception 'not_a_volunteer' using errcode = '42501';
  end if;

  if not vol.verified then
    raise exception 'not_verified' using errcode = '42501';
  end if;

  if exists (select 1 from public.help_requests r where r.volunteer_id = me and r.status = 'matched') then
    raise exception 'already_helping' using errcode = 'P0001';
  end if;

  begin
    update public.help_requests r
       set status = 'matched',
           volunteer_id = me,
           volunteer_name = vol.first_name,
           volunteer_languages = array[vol.main_language] || array_remove(vol.languages, vol.main_language),
           volunteer_trainings = vol.trainings,
           matched_at = now()
     where r.id = p_request_id and r.status = 'open' and r.visitor_id <> me
     returning * into accepted;
  exception when unique_violation then
    -- help_requests_one_per_volunteer: this volunteer's other Accept landed first.
    raise exception 'already_helping' using errcode = 'P0001';
  end;

  if accepted.id is null then
    if exists (select 1 from public.help_requests r where r.id = p_request_id and r.status in ('open', 'matched')) then
      raise exception 'already_taken' using errcode = 'P0001';
    end if;
    raise exception 'request_closed' using errcode = 'P0001';
  end if;
  return accepted;
end;
$$;

-- create or replace keeps the existing grants; restate them so this file alone is the whole story.
revoke all on function public.accept_help_request(uuid) from public, anon;
grant execute on function public.accept_help_request(uuid) to authenticated;
