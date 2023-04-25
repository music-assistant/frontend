/**
 * plugins/index.ts
 *
 * Automatically included in `./src/main.ts`
 */

// Plugins
import vuetify from './vuetify';
import router from './router';
import { i18n } from './i18n';
import Vue3TouchEvents from 'vue3-touch-events';

// Types
import type { App } from 'vue';

export function registerPlugins(app: App) {
  app.use(Vue3TouchEvents).use(vuetify).use(router).use(i18n);
}
