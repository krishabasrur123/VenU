import i18n from '@/i18n';

import type { ProfileDraft } from './types';

export type DraftField =
  | 'firstName'
  | 'languages'
  | 'accessNeedsNote'
  | 'gender'
  | 'ageBand'
  | 'privacyAccepted';

export type DraftErrors = Partial<Record<DraftField, string>>;

export const FIRST_NAME_MAX = 40;
export const NOTE_MAX = 200;

/** Returns one message per invalid field (in the UI language); an empty object means the draft can be saved. */
export function validateDraft(d: ProfileDraft): DraftErrors {
  const errors: DraftErrors = {};
  const name = d.firstName.trim();

  if (!name) errors.firstName = i18n.t('profile:validate.firstName');
  else if (name.length > FIRST_NAME_MAX) errors.firstName = i18n.t('profile:validate.tooLong', { max: FIRST_NAME_MAX });

  if (d.languages.length === 0) errors.languages = i18n.t('profile:validate.noLanguage');
  else if (!d.languages.includes(d.mainLanguage)) errors.languages = i18n.t('profile:validate.mainLanguage');

  if (d.role === 'visitor') {
    const note = d.accessNeedsNote.trim();
    if (d.accessNeeds.includes('other') && !note) errors.accessNeedsNote = i18n.t('profile:validate.otherNote');
    else if (note.length > NOTE_MAX) errors.accessNeedsNote = i18n.t('profile:validate.tooLong', { max: NOTE_MAX });
  } else {
    // Needed so visitors' "I'd prefer help from" choices can be honoured.
    if (!d.gender) errors.gender = i18n.t('profile:validate.pickOne');
    if (!d.ageBand) errors.ageBand = i18n.t('profile:validate.pickOne');
  }

  if (!d.privacyAccepted) errors.privacyAccepted = i18n.t('profile:validate.privacy');
  return errors;
}

export function isValid(errors: DraftErrors): boolean {
  return Object.keys(errors).length === 0;
}
