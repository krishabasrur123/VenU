# VenU

One tap. Right help. Your language. Accessible venue help for LA28 visitors, matched with volunteers who speak their language. An Expo / React Native app for iOS, Android and web.

## Setup

Needs Node 22 (see `.nvmrc`). No global installs: every tool runs from `node_modules`.

```bash
npm ci          # install exactly what package-lock.json says
npm start       # dev server; press i / a / w for iOS, Android, web
```

## Backend modes

Pick one when you start the app. Each runs on its own port, so their accounts and data never mix.

| Command | Port | Backend | Sign-up |
| --- | --- | --- | --- |
| `npm run dev:local` | 8082 | none: data stays on the device | any email and password work |
| `npm run dev:mock` | 8083 | fake Supabase on this machine | signs you straight in |
| `npm run dev:mock:verify` | 8083 | fake Supabase on this machine | confirmation link prints in the terminal |
| `npm run dev:supabase` | 8081 | your Supabase project (`.env.local`) | confirm by email if "Confirm email" is on in Supabase |

`npm run stop` ends every VenU dev server, including ones started with `npx expo start` or left behind by a closed terminal. Ctrl+C stops the one in front of you.

- Extra flags go after `--`: `npm run dev:mock -- --reset` wipes the fake data, `-- --port 8090` picks another port, and anything else goes to `expo start` (`-- --web`).
- The fake backend saves to `.expo/mock-supabase.json` and follows the same rules as the migrations. It runs on `localhost`, so use it from the web or a simulator, not a phone.
- For `dev:supabase`: `cp .env.example .env.local`, then fill in the URL and the **publishable** key (Supabase → Project Settings → API Keys). Never the secret key: it bypasses row-level security.
- The schema lives in `supabase/migrations/`. Apply it in order with `supabase db push` or the SQL editor.

## Chat translation

Each reader sees incoming chat messages in their profile's main language, with "Translated from English · Show original" under them. The app calls the `translate` Edge Function (`supabase/functions/translate/`), which holds the provider key; the app never does. Local mode uses an offline stub that only knows the mock volunteer's lines.

The provider is one secret, so switching is a one-line change: `TRANSLATE_PROVIDER=anthropic` (Claude Haiku 5.5) or `TRANSLATE_PROVIDER=deepl`.

### Try a real provider on your machine

Put the keys in `.env.local` (or `.env.server.local`, which wins per key). Both are git-ignored; the mock backend reads only these three keys, on the server, and the app bundle never sees them:

```bash
TRANSLATE_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
# or
TRANSLATE_PROVIDER=deepl
DEEPL_API_KEY=...:fx
```

Then `npm run dev:mock -- --web`. The terminal says which provider it uses: `Translate: anthropic, keys from .env.local`, or `offline stub` without keys. Restart after changing a file. Needs Node 22.18+ (it loads the function's `.ts` files directly).

- `npm run dev:mock -- --stub-translate`: offline stub even with keys (tests, no network, no cost).
- `npm run dev:mock -- --env-file ../VenU/.env.local`: keys from another file, e.g. the main checkout's when you work in a worktree.

Test hooks on the mock backend (port 47330, or your `-- --mock-port N`): `curl -X POST localhost:47330/__control -d '{"failTranslate":2}'` (next 2 calls fail), `-d '{"translateDelayMs":4000}'` (slow), `-d '{"clockOffsetMs":7200000}'` (two hours on, so a username held by an unconfirmed sign-up is free again), `-d '{"verify":"sam_helps"}'` (verify a volunteer by username or email, as LA28 staff do in the dashboard; add `"verified":false` to undo).

## Verified volunteers

New volunteers start unverified: they finish setup and see requests, but Accept stays off under "Waiting for verification" until LA28 staff verify them. The app re-checks every 30 seconds while they wait.

- Live: Supabase → Table Editor → `profiles` → set `verified` to `true` (or `update public.profiles set verified = true where id = '<user id>';` in the SQL editor). The app can't change it; a trigger keeps it as is.
- Mock: the `verify` hook above. Mock sign-ups start unverified too; volunteers saved before this rule load as verified, so the demo's volunteer keeps working.
- Local mode has no verification: its example requests never accept anyway.

### Deploy (Supabase project owner)

```bash
supabase login
supabase link --project-ref <project-ref>
supabase secrets set TRANSLATE_PROVIDER=anthropic ANTHROPIC_API_KEY=sk-ant-...
#   or: supabase secrets set TRANSLATE_PROVIDER=deepl DEEPL_API_KEY=...
supabase functions deploy translate --no-verify-jwt
```

- Only signed-in users can call it: the function checks the token itself (the anon key and anonymous sign-ins get 401), so the gateway check stays off; it can reject valid sessions under the new JWT signing keys.
- Dashboard instead of the CLI: Edge Functions → Deploy a new function → Via Editor, name it `translate`, add `index.ts`, `handler.ts`, `core.ts`, `anthropic.ts`, `deepl.ts` and `deno.json` from `supabase/functions/translate/`, and turn off "Verify JWT" (the function checks the token itself). Secrets go in Edge Functions → Secrets.
- Limits: 2,000 characters per message, 16 messages and 8,000 characters per request.
- Switch providers later with `supabase secrets set TRANSLATE_PROVIDER=deepl DEEPL_API_KEY=...`; no redeploy or app update needed.

### Rough costs

| Provider | Price | A 40-character chat message |
| --- | --- | --- |
| Claude Haiku 5.5 | $0.10 / M input tokens, $0.50 / M output tokens | about 300 tokens in, 30 out: roughly $0.00005, or 20,000 messages per $1 |
| DeepL API Free | 500,000 characters / month free | about 12,000 messages / month |

DeepL can't translate into Tagalog, Vietnamese, Armenian or Persian (and some other app languages); those messages show the original with "Translation isn't available for Tagalog yet". Claude covers all of them.

## End-to-end API test

`scripts/e2e.mjs` runs the core flow as two users against any backend and prints PASS / FAIL / SKIP per step (exit code 1 on any FAIL): sign in (username through `username-sign-in`, or email), read profiles, open a help request, the volunteer finds and accepts it, both chat (Realtime delivery when the backend has it), translate, rate, file a facility report, close.

```bash
# the mock (start it first with npm run dev:mock); --signup creates two throwaway accounts
node scripts/e2e.mjs --url http://localhost:47330 --anon mock-publishable-key --signup
# a real project, with existing confirmed accounts (or set E2E_VISITOR / E2E_VOLUNTEER to keep passwords out of shell history)
node scripts/e2e.mjs --url https://<ref>.supabase.co --anon <publishable key> --visitor rosa_m:<pw> --volunteer sam_helps:<pw>
```

- Safe on a shared project: it creates accounts only with `--signup`, writes only rows it created (one request, its messages and rating, the `--signup` profiles), deletes only the facility report it filed, and cancels its own request if a step fails. An unverified volunteer must be refused; the mock then verifies it through `/__control`, a real project needs `profiles.verified = true` set in the dashboard first.
- SKIP means "not checkable here": no Realtime on the mock, `translate` not deployed (404) or without a provider (503), or a feature not built yet (TODO steps).
- New feature, new step: add `{ id, needs, run }` to `STEPS` in `scripts/e2e.mjs`; `run` throws to FAIL or returns `{ skip: 'why' }`.

## Accounts: password reset, social sign-in, delete account

- **Forgot Password** (Sign In → Forgot Password?) takes a username or an email and always answers "If an account exists…". An email goes to Supabase Auth; a username goes to the `password-reset` Edge Function, which looks the email up server-side. The link opens `/reset-password`, which sets the new password and signs out everywhere.
- **Social sign-in** (landing: Facebook, Google, Apple) returns to `/auth-callback`. A new account goes on to setup like an email sign-up, with no username (it signs in with the provider).
- **Delete my data** (Profile) calls the `delete-account` Edge Function: photos, then the auth user; the database drops the profile and username, and keeps finished help requests for the other person (`supabase/migrations/20261118030000_account_deletion.sql`). Until it's deployed, the app deletes the profile and photo and says the sign-in remains.

On the mock backend: the reset link prints in the terminal, social sign-in comes straight back as "Google User" etc., and `POST /__control` takes `{"disabledProviders":["apple"]}` or `{"missingFunctions":["delete-account"]}` to try the "isn't set up" and "not deployed" paths.

### Set up on Supabase (project owner)

```bash
supabase db push                                         # 20261118030000_account_deletion.sql first
supabase functions deploy delete-account                 # add --no-verify-jwt if the gateway rejects new signing keys
supabase functions deploy password-reset --no-verify-jwt # callers are signed out
```

- Authentication → URL Configuration → Redirect URLs: add `<site>/reset-password`, `<site>/auth-callback`, `venu://reset-password`, `venu://auth-callback` (and `http://localhost:8081/**` for `npm run dev:supabase`).
- Authentication → Sign In / Providers: turn on Google, Facebook and Apple with each provider's client ID and secret. Each provider's console needs the callback `https://<project-ref>.supabase.co/auth/v1/callback`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Start the Expo dev server (mode from `.env.local`) |
| `npm run dev:local` / `dev:mock` / `dev:mock:verify` / `dev:supabase` | Start in a backend mode (above) |
| `npm run stop` | End every VenU dev server |
| `npm run lint` | ESLint, fails on any warning |
| `npm run typecheck` | Generate typed routes, then `tsc --noEmit` |
| `npm test` | Jest unit tests (`src/**/__tests__`, `supabase/functions/**/__tests__`, `scripts/__tests__`) |
| `npm run check` | Lint, typecheck, tests and `expo-doctor`; run before opening a PR (CI runs the same) |

## Adding packages

```bash
npx expo install <package>   # picks the version that matches our Expo SDK
```

Use `npm install` only for packages unrelated to Expo / React Native (e.g. a dev tool).

## Layout

```
src/app/            routes (Expo Router): every file is a screen
  index.tsx         entry gate: sign-in → onboarding → tabs
  onboarding/       role.tsx (step 1), profile.tsx (step 2)
  (tabs)/           venue, volunteer, profile + floating nav bar
  edit-profile.tsx, privacy.tsx, sign-in.tsx
src/features/profile/  profile types, options, validation, store (Supabase or local), context, form
src/features/translate/  chat translation client, cache, bubble hook, offline stub
src/lib/            supabase client, auth
src/components/     shared UI (chips, buttons, avatar, language picker, nav bar)
src/constants/      design tokens (Colors, Spacing, Radius, Type)
supabase/           SQL migrations; functions/translate (Edge Function, providers)
scripts/            dev.mjs (backend modes, stop), mock-supabase.mjs (fake backend), e2e.mjs (API test)
assets/             app icon, splash, favicon
.kiro/figma/        Figma export the first screens were built from
```
