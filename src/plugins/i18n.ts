/* eslint-disable @typescript-eslint/no-explicit-any */
import { createI18n } from "vue-i18n";

// supported languages need to be setup here manually
import en from "../../../translations/en.json";
import nl from "../../../translations/nl.json";
const messages = {
  en: en['frontend'],
  nl: nl['frontend']
}

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: "en",
  fallbackLocale: "en",
  messages
});
