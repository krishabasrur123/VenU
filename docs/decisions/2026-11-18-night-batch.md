# Night batch 2026-11-18: decisions

Answers from Jayden before the run, and calls made during it. Each line: decision, then why.

## From Jayden
- Matching uses the `profiles` table, not `users` / `profiles_attendees` / `profiles_volunteers`.
- Matching: GPS radius, the app assigns the closest volunteer using the visitor's preferences. Krisha designs and implements the algorithm; this batch only stores what it needs (availability, verified).
- Translation: Anthropic (Claude Haiku). Key is in `.env.local`; the live Edge Function secret must be added by Jayden in the dashboard (agents never paste API keys).
- Save facility reports, ratings and problem reports to the database.
- Store volunteer settings (Free/Busy/Off, notification settings) on the server.
- Verified: an admin flips `profiles.verified` in the dashboard. Unverified volunteers finish setup and see requests, but can't accept (a "Waiting for verification" note). Demo volunteer starts verified.
- Password reset, and deleting an account also deletes the sign-in (auth user).
- Social sign-in: add it (Figma shows Facebook, Google, Apple). Providers need client IDs set in the Supabase dashboard by Jayden.
- Event data after the Games: keep it. Later idea: sort history by recency / filter by event.
- Calling, read aloud, stickers: stay "coming soon".
- Onboarding: follow Figma (step-by-step Onboarding 2.0; Figma's newest frames build on it).
- Live DB: agents may apply tested migrations and create 2 demo accounts tonight.

## Made during the run
- 2026-11-18: `20261118000000_db_hardening` applied to live through the dashboard (pasted text hash-checked against the file); all 12 checks in 4-hardening-check.sql true.
- Figma refresh (2 REST calls): newest frames are visitor-side (Find a Volunteer v3, role choice, preferences), not volunteer-side helper screens; those are built tonight. Step-by-step onboarding stays (Figma's newest frames build on it).
- Live demo accounts and end-to-end tests: created and run by script (supabase-js), never by typing passwords into a page. Browser tests with two agents (visitor + volunteer in sync) run against the mock backend on localhost.
- Merged so far: translate-e2e, figma-nov18, volunteer-settings, reports-db (gate after each: lint 0, typecheck 0, jest 577/577). Two tests needed the volunteer verified first now that volunteers start unverified (mock feedback test; reports PGlite harness).
- Applied to live (hash-checked paste, then read back): `20261118010000_reports_feedback`, `20261118020000_volunteer_settings_verified`. Live check: 3 new tables with RLS, profiles has availability / availability_updated_at / notification_prefs, `profiles_guard` trigger, anon has no privileges on profiles, accept_help_request authenticated-only.
- Deployed Edge Function `translate` to live from the deploy folder (6 files, lengths checked), Verify JWT off (it checks tokens itself). It answers 503 until Jayden adds TRANSLATE_PROVIDER and ANTHROPIC_API_KEY under Edge Functions → Secrets.
- Live demo accounts: blocked. Live auth requires email confirmation, rejects the `.demo` domain ("email_address_invalid"), and the built-in email sender hit its rate limit (429 over_email_send_rate_limit), so no accounts were created. Real visitors signing up would hit the same limit: Jayden should set up custom SMTP (Authentication → Emails → SMTP) or decide to turn off "Confirm email". Retrying later with example.com addresses, then confirming them with SQL.
- Figma choices made by the Figma worker (no migration tonight): kept 6 help types (Figma shows 5 incl. "Find a facility", which needs a new help_types value), kept age bands any / under 40 / 40+ (Figma shows 20-30 / 30-40), "Speech impairment" not added (needs an access_needs value). Help type is single-choice now, stored as a one-item list.
- Merged account-auth (conflicts in README, mock server, profile context resolved keeping both sides). Fixed the mock's delete-account to drop the deleted user's facility reports and help feedback like the database's cascades (test fails without the fix). Reports and help feedback cascade on account deletion (reports worker's choice); app feedback keeps the note with no author.
- Applied `20261118030000_account_deletion` to live (hash-checked). Deployed Edge Functions `delete-account` and `password-reset` (Verify JWT off: both check tokens themselves / serve signed-out callers). The dashboard editor only takes flat files, so the deployed `password-reset` carries a copy of `username-sign-in/handler.ts` as `username-sign-in-handler.ts` with its one import line pointed at it; the repo is unchanged. Smoke test: translate and delete-account answer 401 without a session, password-reset answers 200 {"sent":true} for an unknown username.
- Live demo accounts: still not created. Retry an hour later: Supabase rejects example.com addresses ("email_address_invalid") and the email limit was still exhausted. Needs Jayden: custom SMTP or turning off "Confirm email", then run `scripts/e2e.mjs` against live.
- Two Chrome testers (visitor + volunteer) ran the full flow on mock. Findings: scratchpad night/sync/findings-*.md. Top bug: the visitor's 2-minute search timeout could cancel a request a volunteer had just accepted. Fix workers: fix-help-flow (lifecycle), fix-chat-polish (chat/translation), fix-profile-i18n (profile, fonts, wording).
- Merged fix-help-flow (jest 671/671). The search timeout now withdraws through `withdraw_open_request`, which cancels only a still-open request, so a late timer shows the match instead of cancelling it; deliberate Cancel is unchanged. Volunteers get "Can't make it" (release_help_request, inline confirm). End-of-help banners stay until dismissed. Stored availability isn't switched to Busy while helping (a crash would strand it); the status line says who they're helping instead. Applied `20261118040000_help_flow_fixes` to live (hash-checked; anon can't execute, authenticated can).
- Merged fix-chat-polish and fix-profile-i18n (two import-line conflicts, both sides kept). The font fix had missed one style that chat-polish moved into translation-note.tsx; fixed so "Show original" stays bold in ru/hy/CJK. Gate: lint 0, typecheck 0, jest 695/695.
- scripts/e2e.mjs: the verified, rating and facility-report steps now run (the report is deleted again by its author so the venue list stays clean). Merged branch on a fresh mock: 22 PASS, 0 FAIL, 4 SKIP (no Realtime in the mock, stub translator).
- Smoke screenshots of the merged app (role choice en/ar/hy, preferences, Find a Volunteer en/ar/hy/ru incl. note open): scratchpad night/final/shots.
- Review server for the morning: night-batch on http://localhost:8090 (mock, real Haiku translation, demo accounts rosa_m / sam_helps copied from the main checkout; Sam verified). main stays on http://localhost:8083.

## For Jayden in the morning
1. Live sign-ups: set up custom SMTP (Authentication → Emails) or turn off "Confirm email"; until then nobody new can sign up on live. Then create demo accounts and run `node scripts/e2e.mjs --url https://chkepjtqskdxsdcezwoh.supabase.co --anon <publishable key> --visitor ... --volunteer ...` (verify the volunteer first: profiles.verified = true).
2. Edge Function secrets: TRANSLATE_PROVIDER=anthropic and ANTHROPIC_API_KEY (translate answers 503 until then).
3. Auth → URL Configuration: add <site>/reset-password, <site>/auth-callback, venu://reset-password, venu://auth-callback. Auth → Providers: Google, Facebook, Apple client IDs (steps in README "Accounts").
4. Authentication → Passwords: turn on leaked password protection.
5. Tell Krisha: matching can use profiles (role = volunteer, verified, availability = 'free', availability_updated_at, notification_prefs->>'volunteer'); new public functions must revoke anon/public EXECUTE (Supabase's default privileges grant it).
6. Figma options that need a migration + matching work, not built: a "Find a facility" help type, helper age bands 20-30 / 30-40, "Speech impairment" need.
7. Review and open PRs from jayden/night-batch (not pushed).

## Review fixes
Branch `jayden/review-fixes` (on night-batch 73ad38c), from the code review of `main...jayden/night-batch`.
- Volunteer tab after a restart: a search that ran out while the app was closed shows "No volunteer is free" at once and is withdrawn in the background (it used to wait for the network, leaving the tab blank). A volunteer who accepted meanwhile still becomes the match; if the visitor already searched again, that late match is called off.
- Free / Busy / Off and the alert switches saved on a device before they moved to the profile are carried over once (only while the profile still has the default), then the old keys go (`src/features/profile/device-settings.ts`).
- Help nobody gave can't be rated or reported: `close_help_request(id, 'done')` on a request still open cancels it, `done` requires `matched_at` (check `done_was_matched`), and the rate-or-report policy requires `matched_at` (kept when the volunteer deletes their account after finishing, cleared by a hand-back).
- Report authors are private: signed-in users read every `facility_reports` column except `author_id`; the app lists `public.facility_report_cards` (security_invoker view) whose `mine` comes from `private.is_own_report(id)`. Delete-own works as before.
- Request notes in the reader's language aren't sent to the translator (the request's language goes along as the note's). A slow translation of an id's old text no longer replaces the new one. The sample reports still show when the report list can't load.
- Not changed: a report's title and body are two cache entries but already one translator call (same batch; a list of cards is one call), so they weren't merged into one text, which would need splitting the translation back apart. `shownText()` is now shared by notes and reports; reports keep their one switch for both parts.
- Edge functions username-sign-in, password-reset and delete-account share `supabase/functions/_shared/edge.ts` (CORS, json, clientIpOf, serverKey). translate keeps its own copy.

To do (orchestrator):
1. Apply `supabase/migrations/20261118050000_review_fixes.sql` to live (PGlite: 45 checks pass).
2. Redeploy username-sign-in, password-reset and delete-account. Each deploys `index.ts`, `handler.ts`, `deno.json` and `_shared/edge.ts`; in the dashboard's flat editor upload it as `edge.ts` and change `'../_shared/edge.ts'` to `'./edge.ts'` (password-reset no longer needs the `username-sign-in-handler.ts` copy). Settings unchanged: Verify JWT off for all three.
3. After both: `node scripts/e2e.mjs` against live (it now also checks author_id is hidden and that `facility_report_cards.mine` is right).

## Sponsored stands demo
For the Intuit demo: sponsored stands on the map, one promoted list card, an offer on the stand, and one ad slot on the waiting screen. Data and helpers in `src/features/venue/sponsors.ts`, look in `sponsor-ui.tsx`, banner in `src/components/volunteer/sponsor-banner.tsx`.
- Demo placements only, not partnerships: real brand names as plain text (Coca-Cola at all three venues, Panda Express at Intuit Dome, Ben & Jerry's at SoFi), no logos or brand colours. Said in the data file's header comment; no UI copy claims endorsement.
- An optional `sponsor` field (brand, offer) on food facilities, not a new category: no new chips or empty-state strings, and the Food & Drinks chip shows the stands.
- Stands are kept out of `facilitiesFor()` (the meeting-spot picker, help requests, emergency screens read it); only the venue screen adds them (`venueFacilitiesFor`). Their page has no "I'm here", so an ad never becomes a meeting spot. Kept `mock.ts` untouched for the Intuit data fix.
- Look: VenU's own glyph (a tag with a star cut out, drawn like the Figma icon sheet) in the theme accent (orange "U") on its soft tint; "Sponsored" pill on every pin card, row, card and banner, and "Sponsored" first in every screen-reader label.
- Promoted card: one per venue (the featured stand, first in its list), only for "All" and "Food & Drinks" and only while the stand matches the search. Browsing: first in the list. Searching: after the first result, so the best match stays on top. The stand isn't listed twice; other sponsored stands are normal rows with the pill.
- Offer on the pin card (pill, name, two-line offer instead of walk and wait) and in a tinted box on the stand's page, with "Show this screen at the stand" and "Paid listing, not venue information".
- Waiting banner: below Cancel in the page flow, so it never covers the request, notices or Cancel; only for a visitor whose request is searching (`waitingBannerFor`, tested), never on match, chat, feedback, volunteer or emergency screens. Tapping opens the stand (Back and the Volunteer tab return to the search, which keeps running); × hides it for that request. The walk is from the visitor's spot, else the main way in.
- Stand `walkMinutes` equal the route from the venue's main way in (tested), so the list, the page and the banner agree.
- No tap or impression counting (no DB tables, the mock server untouched). Next step if the pitch wants numbers: a small `sponsor_events` table (stand id, kind, time) with insert-only RLS.

## Intuit Dome map fixes (branch jayden/intuit-map)
From the three vetters' brief (pins, facts, demo walkthrough). Decisions:
- Pins moved to where the seating chart, laid over the exterior map, puts their sections: First Aid Floor (Wall 19, east tunnel), Answers Portal Terrace (Terrace 18), First Aid Terrace (Terrace 27), First Aid Main (Main 6). Added Infant Care Room Terrace (Terrace Wall 16) and Elevators (lobby by the Main Entrance).
- Spots the venue doesn't publish (Sensory Room, Elevators) are `approximate`: the pin stays as a placeholder, there's no route, the detail says to ask staff, and the list says "Spot not published". An "I'm here" on one of them doesn't start walks (they start at the way in).
- Walk times everywhere use the route panel's calculation (from the visitor's spot, else the way in), so the stand-in `walkMinutes` in mock.ts is only a fallback now. The start itself reads "Walks start here" / "You're here". Some numbers changed a lot (Answers Portal Terrace 9 → 4 min): it's the straight-line estimate the route already showed.
- Chips with no facilities at the venue are hidden (the selected one stays). No venue lists food, so "Food & Drinks" is gone at all three until food stands are added (if the sponsors branch adds them, the chip comes back on its own).
- Search also matches category and tag labels (English and the app language) plus a few English everyday words ("bathroom", "toilet", "elevator", "wheelchair").
- Published map images stop zooming out once they fit (it was 75% of fit: a grey field with the pins piled up). The schematic Crypto.com Arena keeps its margin. Intuit Dome's map area is near-black like the image. No pin clustering.
- While a pin card shows, the map may pan up until the image's bottom meets the card, so a tapped pin at the bottom (First Aid Terrace) is lifted clear of it.
- Directions and I'm here moved right under the facility name (Figma has them after the tags), so they show on the half-open sheet.
- "From Main Entrance." drops "the main way in" through a per-map flag (`arrivalNamedMain`) and a new string `directions.fromArrivalPlain` in 13 languages.
- Garages: a new "Pass needed" tag replaces "Permit needed"; both garages count as accessible (accessible spaces are sold with a parking pass).
- Contact: Intuit Dome's event-day text line +1 310-282-5779 (FAQ), so "Text venue staff" shows in the emergency dialog, as it does for SoFi.

Left: ru "Отзывы" → "Сообщения" (about 12 ru strings call reports "отзыв", so renaming one would be inconsistent; needs a native pass). Also left: scrolling a selected chip at the row's end into view, and a pin under the − button when zoomed in. Sensory Room keeps the wheelchair icon and Infant Care the restroom icon, and routes stay straight lines through the bowl.

## Demo review fixes (branch jayden/demo-review-fixes)
From the code review of the sponsors + Intuit Dome map merge. Decisions:
- Ads never answer accessibility or safety: a sponsored stand matches search only on its name, brand, offer, description and food words, never tag or "wheelchair" words, and only the Food & Drinks chip (not Accessibility). Its page keeps the wheelchair badge. Search "wheelchair" → no Sponsored card or rows; "drinks", "egg roll", "Panda" still find stands.
- No reports on a paid listing: a stand's page has no Reports block or Add report, and `/reports/new` for a stand reads "not found".
- Unpublished spots (Elevators, Sensory Room) have no "I'm here" and aren't in the "Where are you?" picker (`isMeetSpot`, `meetSpotsFor`). One saved before this is dropped on load, keeping the venue ("I'm not sure"); requests already sent keep naming it.
- Kept the Food & Drinks chip on the venue screen, though at Intuit Dome it lists only the two stands (each marked Sponsored): it is how the demo shows them. Fixed the comment that said the chip was gone. Revisit once real food stands are listed.
- One walk everywhere: the promoted card and the waiting banner use the list's walk (`walkTo`) and its wording (`walkLabel`), so after "I'm here" at First Aid Terrace the card says 5 min, not 1. The card stays first while browsing, as before.
- +/− zoom clamps like pan and pinch, so a pin lifted clear of the pin card stays clear. The start spot reads "Walks start here" / "You're here" before "Spot not published".
- The list finds the walk start once per render and caches each facility's search text per language.
