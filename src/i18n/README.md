# Translations

Screen text comes from string tables in `locales/<language>/<namespace>.json`, bundled into the app.
English (`en`) is the source; 12 more languages: es, zh, ko, tl, vi, hy, fa, ja, ru, ar, fr, pt.
Any other language in `LANGUAGES` shows English.

| Namespace    | For                                                    |
| ------------ | ------------------------------------------------------ |
| `common`     | shared components, tab bar, generic buttons and errors |
| `onboarding` | welcome, sign-in, sign-up, role, profile setup         |
| `profile`    | Profile tab, edit profile, privacy                     |
| `venue`      | venue list, map, facilities, reports                   |
| `volunteer`  | volunteer tab, requests, chat                          |

## Use it in a screen

```tsx
import { useT } from '@/i18n';
import { formatDate } from '@/i18n/format';

const t = useT('venue');
<Text>{t('report.title')}</Text>                                      // "Report a problem"
<Text>{t('report.submitted', { date: formatDate(r.createdAt) })}</Text> // "Submitted 10/24/2026"
<Text>{t('nearby', { count: 3 })}</Text>                              // nearby_one / nearby_other
```

Shared words live in `common`: `useT('common')('actions.save')`. Outside React (helpers, stores):
`import i18n from '@/i18n'; i18n.t('venue:report.title')`. Keys are typed from the English files,
so a typo'd key fails `npm run typecheck` (placeholder values aren't checked: pass them all).

Don't build sentences from pieces (`'Submitted ' + date`): give translators the whole sentence with
a placeholder. Dates, times and numbers go through `format.ts` (`formatDate`, `formatTime`,
`formatNumber`), never hand-built `mm/dd`.

## Add a string

1. Add it to `locales/en/<namespace>.json`, e.g. `"report": { "title": "Report a problem" }`.
2. Add the same key to the other 12 files of that namespace, translated (short UI copy, not literal).
3. Plurals: `"nearby_one": "{{count}} volunteer nearby"`, `"nearby_other": "..."`. Each language needs
   its own forms (ru: `_one _few _many _other`; ar: `_zero _one _two _few _many _other`; ja/ko/zh/vi: `_other`).
4. `npm test`: `__tests__/locales.test.ts` fails on any missing or extra key or lost placeholder.

## Add a language

1. Copy `locales/en/` to `locales/<code>/` and translate it. The code must be in `LANGUAGES`
   (`src/features/profile/options.ts`).
2. Add `<code>` to `TRANSLATED` in `languages.ts` and a line to `locales/index.ts`.
3. Right-to-left? Add it to `RTL` in `languages.ts`.

## Which language shows

`<LanguageSync />` (mounted in `app/_layout.tsx`) picks: signed-in profile's `appLanguage` → the
language picked on the welcome screen (`choosePendingLanguage(code)` from `pending-language.ts`)
→ the device language → English. Changing any of them re-renders the app without a restart.

Arabic and Persian mirror the layout. Web flips at once (`<html dir="rtl">`). iOS and Android flip
after a restart (the app asks); Expo Go can't flip. Use `marginStart`/`paddingEnd`/`start`/`end`
instead of left/right, and flip directional icons with `useLayoutRtl()`.
