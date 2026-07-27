/**
 * main.ts
 *
 * Bootstraps Vuetify and other plugins then mounts the App`
 */

// Polyfill for Safari 15 / iOS 15 (AbortSignal.timeout not supported)
declare global {
  interface AbortSignalConstructor {
    timeout?(ms: number): AbortSignal;
  }
}

if (typeof AbortSignal !== "undefined" && !AbortSignal.timeout) {
  AbortSignal.timeout = (ms: number): AbortSignal => {
    const controller = new AbortController();
    setTimeout(
      () => controller.abort(new DOMException("TimeoutError", "TimeoutError")),
      ms,
    );
    return controller.signal;
  };
}

if (!Object.hasOwn) {
  Object.defineProperty(Object, "hasOwn", {
    configurable: true,
    value: (object: object, property: PropertyKey): boolean =>
      Object.prototype.hasOwnProperty.call(object, property),
    writable: true,
  });
}

// Global styles
import "@/styles/global.css";
import "@/styles/style.css";

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
