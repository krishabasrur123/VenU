// Sentences with a tappable part are one Trans string with a tag, e.g. "Agree with <a>Terms & Conditions</a>".
// The tag must not be an HTML void element (<link>, <br>, <img>…): Trans would close it at once and
// render the words outside the link.

import { describe, expect, it } from '@jest/globals';
import type { ReactElement } from 'react';
import { Trans } from 'react-i18next';

import i18n, { UI_LANGUAGES } from '@/i18n';

// react-dom ships without types in this project; only this one function is needed.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { renderToStaticMarkup } = require('react-dom/server') as { renderToStaticMarkup: (el: ReactElement) => string };

const KEYS = ['onboarding:signUp.agree', 'profile:form.privacyAgree', 'profile:terms.privacyLink'] as const;

describe('link sentences', () => {
  for (const { code } of UI_LANGUAGES) {
    it(`puts the link words inside the link (${code})`, () => {
      const t = i18n.getFixedT(code);
      for (const key of KEYS) {
        const html = renderToStaticMarkup(<Trans t={t} i18nKey={key as never} components={{ a: <b /> }} />);
        expect({ key, html }).toEqual({ key, html: expect.stringMatching(/<b>[^<]+<\/b>/) });
      }
    });
  }
});
