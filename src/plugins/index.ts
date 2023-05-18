/**
 * plugins/index.ts
 *
 * Automatically included in `./src/main.ts`
 */

// Plugins
import vuetify from './vuetify';
import router from './router';
import { i18n } from './i18n';
import touchEvents from './touchEvents';
import breakpoint from './breakpoint';

// Types
import type { App } from 'vue';

export function registerPlugins(app: App) {
  app.use(touchEvents).use(breakpoint).use(vuetify).use(router).use(i18n);
}
