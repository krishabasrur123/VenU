// Types t() from the English tables: a typo'd key is a type error.
import 'i18next';

import type { Resources } from './locales';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: Resources;
  }
}
