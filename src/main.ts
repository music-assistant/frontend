/**
 * main.ts
 *
 * Bootstraps Vuetify and other plugins then mounts the App`
 */

// Polyfill for Safari 15 / iOS 15 (AbortSignal.timeout not supported)
if (typeof AbortSignal !== "undefined" && !AbortSignal.timeout) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (AbortSignal as any).timeout = (ms: number): AbortSignal => {
    const controller = new AbortController();
    setTimeout(
      () => controller.abort(new DOMException("TimeoutError", "TimeoutError")),
      ms,
    );
    return controller.signal;
  };
}

// Global styles
import "@/styles/global.css";

// Components
import App from "./App.vue";

// Composables
import { createApp } from "vue";

// Plugins
import { registerPlugins } from "@/plugins";

// Install Sendspin WebSocket interceptor for authenticated connections
import { installSendspinInterceptor } from "@/plugins/sendspin-connection";
installSendspinInterceptor();

const app = createApp(App);

registerPlugins(app);

app.mount("#app");
