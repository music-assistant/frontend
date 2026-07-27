import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const messageListeners = new Set<(event: MessageEvent) => void>();
const controllerChangeListeners = new Set<() => void>();
const postMessage = vi.fn((message: { type: string; data: unknown }) => {
  if (message.type !== "set-remote-mode") return;
  const event = {
    data: {
      type: "remote-mode-ack",
      data: message.data,
    },
  } as MessageEvent;
  messageListeners.forEach((listener) => listener(event));
});

const serviceWorker = {
  addEventListener: vi.fn(
    (type: string, listener: (event: MessageEvent) => void) => {
      if (type === "message") messageListeners.add(listener);
      if (type === "controllerchange") {
        controllerChangeListeners.add(listener as () => void);
      }
    },
  ),
  controller: { postMessage },
  ready: Promise.resolve(),
  register: vi.fn().mockResolvedValue(undefined),
  removeEventListener: vi.fn(
    (type: string, listener: (event: MessageEvent) => void) => {
      if (type === "message") messageListeners.delete(listener);
      if (type === "controllerchange") {
        controllerChangeListeners.delete(listener as () => void);
      }
    },
  ),
};

describe("HttpProxyBridge", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.stubEnv("DEV", false);
    vi.stubEnv("PROD", true);
    vi.stubGlobal("localStorage", createStorage());
    vi.stubGlobal("sessionStorage", createStorage());
    messageListeners.clear();
    controllerChangeListeners.clear();
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: serviceWorker,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("scopes proxy mode to the current client and remote server", async () => {
    const { httpProxyBridge } = await import("@/plugins/remote/http-proxy");

    await httpProxyBridge.initialize();
    expect(postMessage).toHaveBeenNthCalledWith(1, {
      type: "set-remote-mode",
      data: { isRemote: false, proxyScope: undefined },
    });

    await httpProxyBridge.setTransport(
      {} as Parameters<typeof httpProxyBridge.setTransport>[0],
      "guest-remote-id",
    );
    expect(postMessage).toHaveBeenNthCalledWith(2, {
      type: "set-remote-mode",
      data: { isRemote: true, proxyScope: "guest-remote-id" },
    });

    controllerChangeListeners.forEach((listener) => listener());
    await vi.waitFor(() => expect(postMessage).toHaveBeenCalledTimes(3));
    expect(postMessage).toHaveBeenNthCalledWith(3, {
      type: "set-remote-mode",
      data: { isRemote: true, proxyScope: "guest-remote-id" },
    });
  });

  function createStorage(): Storage {
    const values = new Map<string, string>();
    return {
      get length() {
        return values.size;
      },
      clear() {
        values.clear();
      },
      getItem(key) {
        return values.get(key) ?? null;
      },
      key(index) {
        return Array.from(values.keys())[index] ?? null;
      },
      removeItem(key) {
        values.delete(key);
      },
      setItem(key, value) {
        values.set(key, value);
      },
    };
  }
});
