/**
 * main.ts
 *
 * Bootstraps Vuetify and other plugins then mounts the App`
 */

// Polyfills for older browsers (Safari 15 / iOS 15 support)
import "core-js/stable";
import "regenerator-runtime/runtime";

// Global styles
import "@/styles/global.css";

// Components
import App from "./App.vue";

// Composables
import { createApp } from "vue";

// Plugins
import { registerPlugins } from "@/plugins";

const app = createApp(App);

registerPlugins(app);

app.mount("#app");
