import { afterEach, describe, expect, it } from '@jest/globals';

import { validateAuth } from '@/features/auth/validate';
import i18n from '@/i18n';

import { ACCESS_NEEDS, AGE_BANDS, COMMUNICATION, GENDERS, HELPER_AGE, HELPER_GENDER, labelFor, TRAININGS } from '../options';
import { helperSummary } from '../summary';
import { emptyDraft } from '../types';
import { validateDraft } from '../validate';

const ALL = { ACCESS_NEEDS, AGE_BANDS, COMMUNICATION, GENDERS, HELPER_AGE, HELPER_GENDER, TRAININGS };

afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('option labels', () => {
  it('has an English label for every stored value (no raw keys)', () => {
    for (const [group, options] of Object.entries(ALL)) {
      for (const o of options) expect({ group, value: o.value, label: o.label }).toEqual({ group, value: o.value, label: expect.not.stringMatching(/options\./) });
    }
    expect(labelFor(ACCESS_NEEDS, 'wheelchair')).toBe('Wheelchair user');
  });

  it('follows the UI language and keeps the stored value', async () => {
    await i18n.changeLanguage('es');
    expect(labelFor(ACCESS_NEEDS, 'wheelchair')).toBe('Uso silla de ruedas');
    expect(HELPER_GENDER.map(o => o.value)).toEqual(['none', 'man', 'woman']);
    await i18n.changeLanguage('ja');
    expect(labelFor(GENDERS, 'prefer_not')).toBe('回答しない');
  });
});

describe('translated summary and validation', () => {
  const rosa = { ...emptyDraft('visitor', 'es'), firstName: 'Rosa', languages: ['es', 'en'], accessNeeds: ['wheelchair' as const], communication: ['text' as const], privacyAccepted: true };

  it('builds the helper tags in the UI language', async () => {
    await i18n.changeLanguage('es');
    expect(helperSummary(rosa)).toEqual(['Habla español, inglés', 'Uso silla de ruedas', 'Prefiere texto / escrito']);
    await i18n.changeLanguage('zh');
    expect(helperSummary(rosa)[0]).toBe('会说西班牙语、英语');
  });

  it('writes form errors in the UI language', async () => {
    await i18n.changeLanguage('ar');
    expect(validateDraft({ ...rosa, firstName: '' }).firstName).toBe('أضف اسمك الأول.');
    expect(validateAuth('signup', { email: 'rosa@example.com', password: 'short', termsAccepted: true }, false)?.message).toBe('استخدم 8 أحرف على الأقل لكلمة المرور.');
  });
});
