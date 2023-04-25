/* eslint-disable @typescript-eslint/no-explicit-any */
import { createI18n } from 'vue-i18n';

// supported languages need to be setup here manually
import de from '../translations/de.json';
import en from '../translations/en.json';
import nl from '../translations/nl.json';
import pl from '../translations/pl.json';
import fr from '../translations/fr.json';
import es from '../translations/es.json';
const messages = {
  de,
  en,
  nl,
  pl,
  fr,
  es,
};

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: navigator.language.split('-')[0],
  fallbackLocale: 'en',
  messages,
});
