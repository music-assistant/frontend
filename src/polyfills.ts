/**
 * Runtime polyfills; main.ts imports this first so they run before the app's own
 * modules. Vendor chunks split out in vite.config.ts still load before it.
 */

// Polyfill for Safari 15 / iOS 15 (AbortSignal.timeout not supported)
declare global {
  interface AbortSignalConstructor {
    timeout?(ms: number): AbortSignal;
  }
}

export function installPolyfills(): void {
  if (typeof AbortSignal !== "undefined" && !AbortSignal.timeout) {
    AbortSignal.timeout = (ms: number): AbortSignal => {
      const controller = new AbortController();
      setTimeout(
        () =>
          controller.abort(new DOMException("TimeoutError", "TimeoutError")),
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
}

installPolyfills();
