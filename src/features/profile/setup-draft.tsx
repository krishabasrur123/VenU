/**
 * The profile being built across the Onboarding 2.0 steps (languages → preferences or volunteer
 * questions → photo), kept in the onboarding layout so Back and Continue keep every answer, and
 * saved on the device (setup-draft-storage) so a web reload resumes on the same step.
 */
import { router } from 'expo-router';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useProfile, type AvatarChange } from './profile-context';
import { readSavedDraft, writeSavedDraft } from './setup-draft-storage';
import { emptyDraft, type ProfileDraft, type Role } from './types';
import { firstNameFrom, validateDraft, type DraftErrors, type DraftField } from './validate';

interface SetupDraft {
  /** False until the saved draft (if any) is read; steps render nothing until then. */
  ready: boolean;
  draft: ProfileDraft | null;
  avatar: AvatarChange;
  start: (draft: ProfileDraft) => void;
  update: (patch: Partial<ProfileDraft>) => void;
  setAvatar: (avatar: AvatarChange) => void;
}

const Ctx = createContext<SetupDraft | null>(null);

export function SetupDraftProvider({ children }: { children: ReactNode }) {
  const { userId } = useProfile();
  const [ready, setReady] = useState(false);
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [avatar, setAvatar] = useState<AvatarChange>(null);

  useEffect(() => {
    let live = true;
    readSavedDraft(userId).then(saved => {
      if (!live) return;
      if (saved) setDraft(prev => prev ?? saved);
      setReady(true);
    });
    return () => { live = false; };
  }, [userId]);

  // Every answer, as it changes (only after the read, so an empty start never overwrites it).
  useEffect(() => {
    if (ready && draft) void writeSavedDraft(userId, draft);
  }, [ready, draft, userId]);

  const value = useMemo<SetupDraft>(() => ({
    ready,
    draft,
    avatar,
    start: setDraft,
    update: patch => setDraft(prev => (prev ? { ...prev, ...patch } : prev)),
    setAvatar,
  }), [ready, draft, avatar]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSetupDraft(): SetupDraft {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSetupDraft needs <SetupDraftProvider> (the onboarding layout)');
  return ctx;
}

/**
 * The draft the languages step starts with. Switching role on the role step keeps the answers both
 * roles share (languages, first name) and starts the role's own questions over.
 * A fresh draft prefills only the first word of the Create Account name; a name already in the draft
 * was typed in the First name field, so it stays as typed.
 * e.g. draftForRole('volunteer', visitorDraft with ['es','en'], 'en', 'Rosa') → volunteer, ['es','en'], gender unset
 *      draftForRole('visitor', null, 'es', 'Lucia Vistest') → firstName 'Lucia'
 */
export function draftForRole(role: Role, previous: ProfileDraft | null, mainLanguage: string, accountName: string): ProfileDraft {
  const fresh = { ...emptyDraft(role, mainLanguage), firstName: firstNameFrom(accountName) };
  if (!previous) return fresh;
  return { ...fresh, languages: previous.languages, mainLanguage: previous.mainLanguage, firstName: previous.firstName };
}

/** Which answers each step asks for, so Continue only checks that step's fields. */
export const STEP_FIELDS = {
  languages: ['languages'],
  preferences: ['accessNeedsNote'],
  volunteer: ['gender', 'ageBand'],
  photo: ['firstName', 'privacyAccepted'],
} as const satisfies Record<string, readonly DraftField[]>;

export type SetupStep = keyof typeof STEP_FIELDS;

/** validateDraft's messages for one step's fields only. e.g. a visitor with no language → { languages: '…' } */
export function stepErrors(step: SetupStep, draft: ProfileDraft): DraftErrors {
  const all = validateDraft(draft);
  const out: DraftErrors = {};
  for (const f of STEP_FIELDS[step]) if (all[f]) out[f] = all[f];
  return out;
}

/** The step after `step` for this role; null after the last one (save). */
export function nextStep(step: SetupStep, role: ProfileDraft['role']): SetupStep | null {
  if (step === 'languages') return role === 'visitor' ? 'preferences' : 'volunteer';
  if (step === 'preferences' || step === 'volunteer') return 'photo';
  return null;
}

export const STEP_HREF = {
  languages: '/onboarding/languages',
  preferences: '/onboarding/preferences',
  volunteer: '/onboarding/volunteer',
  photo: '/onboarding/photo',
} as const satisfies Record<SetupStep, string>;

/** Continue: checks this step's answers, then opens the next step. Returns false (stay) when one needs a fix. */
export function goToNextStep(step: SetupStep, draft: ProfileDraft): boolean {
  if (Object.keys(stepErrors(step, draft)).length) return false;
  const next = nextStep(step, draft.role);
  if (next) router.push(STEP_HREF[next]);
  return true;
}
