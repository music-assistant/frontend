/* eslint-disable @typescript-eslint/no-explicit-any */
import { createI18n } from 'vue-i18n';

/*
 * All i18n resources specified in the plugin `include` option can be loaded
 * at once using the import syntax
 */
import messages from '@intlify/unplugin-vue-i18n/messages';

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: navigator.language.split('-')[0],
  fallbackLocale: 'en',
  missingWarn: false,
  fallbackWarn: false,
  silentTranslationWarn: true,
  messages,
});
