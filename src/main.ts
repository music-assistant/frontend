/**
 * main.ts
 *
 * Bootstraps Vuetify and other plugins then mounts the App`
 */

import "@/polyfills";

// Global styles
import "@/styles/global.css";
import "@/styles/style.css";

// Components
import App from "./App.vue";

// Composables
import { createApp } from "vue";

// Plugins
import { isEmbedded } from "@/helpers/embedded";
import { registerPlugins } from "@/plugins";

// Install Sendspin WebSocket interceptor for authenticated connections
import { installSendspinInterceptor } from "@/plugins/sendspin-connection";
installSendspinInterceptor();

// Embedded (e.g. the Home Assistant panel): the host sizes our viewport and
// keeps it clear of the system controls, so don't reserve that space again.
// Browsers disagree here anyway - Chrome reports no insets inside an iframe,
// Safari reports the ones belonging to the page around us. A host that hands
// the safe area over instead reports what it stopped covering, and those
// values land on the same properties inline, above this.
if (isEmbedded()) {
  document.documentElement.setAttribute("data-embedded-layout", "");
}

const app = createApp(App);

registerPlugins(app);

app.mount("#app");
