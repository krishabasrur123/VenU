import { describe, expect, it, jest } from '@jest/globals';

import { draftForRole, nextStep, stepErrors, STEP_FIELDS } from '../setup-draft';
import { emptyDraft } from '../types';
import { FIRST_NAME_MAX, firstNameFrom } from '../validate';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const visitor = { ...emptyDraft('visitor', 'es'), firstName: 'Rosa', privacyAccepted: true };
const volunteer = { ...emptyDraft('volunteer', 'en'), firstName: 'Daniel', gender: 'man' as const, ageBand: 'under_40' as const, privacyAccepted: true };

describe('setup steps', () => {
  it('goes languages → preferences → photo for visitors, languages → volunteer → photo for volunteers', () => {
    expect(nextStep('languages', 'visitor')).toBe('preferences');
    expect(nextStep('preferences', 'visitor')).toBe('photo');
    expect(nextStep('languages', 'volunteer')).toBe('volunteer');
    expect(nextStep('volunteer', 'volunteer')).toBe('photo');
    expect(nextStep('photo', 'visitor')).toBeNull();
  });

  it("checks only the step's own answers", () => {
    // No name and no privacy consent yet: those belong to the last step, so earlier steps pass.
    const early = { ...visitor, firstName: '', privacyAccepted: false };
    expect(stepErrors('languages', early)).toEqual({});
    expect(stepErrors('preferences', early)).toEqual({});
    expect(Object.keys(stepErrors('photo', early)).sort()).toEqual(['firstName', 'privacyAccepted']);
  });

  it('stops each step on its own problem', () => {
    expect(stepErrors('languages', { ...visitor, languages: [], mainLanguage: '' })).toEqual({ languages: expect.any(String) });
    expect(stepErrors('preferences', { ...visitor, accessNeeds: ['other'], accessNeedsNote: ' ' })).toEqual({ accessNeedsNote: expect.any(String) });
    expect(Object.keys(stepErrors('volunteer', { ...volunteer, gender: null, ageBand: null })).sort()).toEqual(['ageBand', 'gender']);
  });

  it('covers every field the full profile checks, so a draft that passes every step saves', () => {
    const covered = new Set(Object.values(STEP_FIELDS).flat());
    for (const f of ['firstName', 'languages', 'accessNeedsNote', 'gender', 'ageBand', 'privacyAccepted']) expect(covered.has(f as never)).toBe(true);
    for (const step of ['languages', 'preferences', 'photo'] as const) expect(stepErrors(step, visitor)).toEqual({});
    for (const step of ['languages', 'volunteer', 'photo'] as const) expect(stepErrors(step, volunteer)).toEqual({});
  });
});

describe('draftForRole', () => {
  it('starts a blank draft with the primary language and the Create Account name', () => {
    expect(draftForRole('visitor', null, 'ar', 'Rosa')).toEqual({ ...emptyDraft('visitor', 'ar'), firstName: 'Rosa' });
  });

  it('prefills only the first word of the Create Account name, never the surname', () => {
    expect(draftForRole('visitor', null, 'es', 'Lucia Vistest').firstName).toBe('Lucia');
    expect(draftForRole('volunteer', null, 'en', '  Victor   Lane ').firstName).toBe('Victor');
    expect(draftForRole('visitor', null, 'en', '').firstName).toBe('');
  });

  it('keeps a two-word first name typed in the First name field', () => {
    const typed = { ...visitor, firstName: 'Mary Ann' };
    expect(draftForRole('volunteer', typed, 'en', 'Mary Ann Smith').firstName).toBe('Mary Ann');
    expect(stepErrors('photo', { ...volunteer, firstName: 'Mary Ann' })).toEqual({});
  });
});

describe('firstNameFrom', () => {
  it.each([
    ['Lucia Vistest', 'Lucia'],
    ['  Rosa  ', 'Rosa'],
    ['Rosa\tMaría López', 'Rosa'],
    ['', ''],
    ['   ', ''],
    ['A'.repeat(50) + ' B', 'A'.repeat(FIRST_NAME_MAX)],
  ])('%p → %p', (full, want) => {
    expect(firstNameFrom(full)).toBe(want);
  });

  it('switching role keeps the languages and name but starts the role questions over', () => {
    const before = { ...visitor, languages: ['es', 'en'], mainLanguage: 'en', firstName: 'Rosa M', helperGenderPref: 'woman' as const, accessNeeds: ['wheelchair' as const] };
    const after = draftForRole('volunteer', before, 'es', 'Rosa');
    expect(after).toEqual({ ...emptyDraft('volunteer', 'es'), languages: ['es', 'en'], mainLanguage: 'en', firstName: 'Rosa M' });
    expect(stepErrors('languages', after)).toEqual({});
  });
});
