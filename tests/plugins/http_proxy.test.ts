import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const messageListeners = new Set<(event: MessageEvent) => void>();
const controllerChangeListeners = new Set<() => void>();
const postMessage = vi.fn(
  (message: { type: string; data: unknown }, _transfer?: Transferable[]) => {
    if (message.type !== "set-remote-mode") return;
    const event = {
      data: {
        type: "remote-mode-ack",
        data: message.data,
      },
    } as MessageEvent;
    messageListeners.forEach((listener) => listener(event));
  },
);

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

  it("hands proxied bytes to the service worker without re-encoding them", async () => {
    const { httpProxyBridge } = await import("@/plugins/remote/http-proxy");
    const body = new Uint8Array([0, 1, 254, 255]);

    await httpProxyBridge.initialize();
    await setTransport(async () => ({
      status: 200,
      headers: { "content-type": "image/png" },
      body,
    }));
    requestFromServiceWorker("/imageproxy?p=1");

    const { message, transfer } = await waitForProxyResponse();
    expect(message.data).toMatchObject({
      id: "req-1",
      status: 200,
      headers: { "content-type": "image/png" },
    });
    expect(message.data.body).toBeInstanceOf(Uint8Array);
    expect(Array.from(message.data.body)).toEqual([0, 1, 254, 255]);
    // the buffer moves to the service worker rather than being copied into the message
    expect(transfer).toEqual([message.data.body.buffer]);
  });

  it("transfers only the response bytes when the body is a view over a larger buffer", async () => {
    const { httpProxyBridge } = await import("@/plugins/remote/http-proxy");
    // what the transport resolves with: a view over the buffer it sized to the frames
    const frames = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);

    await httpProxyBridge.initialize();
    await setTransport(async () => ({
      status: 200,
      headers: {},
      body: frames.subarray(0, 4),
    }));
    requestFromServiceWorker("/imageproxy?p=1");

    const { message, transfer } = await waitForProxyResponse();
    expect(Array.from(message.data.body)).toEqual([1, 2, 3, 4]);
    // a copy sized to the response is what gets transferred; handing over
    // `frames.buffer` would give the trailing four bytes away with it
    expect(transfer).toEqual([message.data.body.buffer]);
    expect(message.data.body.buffer.byteLength).toBe(4);
  });

  it("sends error responses as bytes too", async () => {
    const { httpProxyBridge } = await import("@/plugins/remote/http-proxy");

    await httpProxyBridge.initialize();
    await setTransport(async () => {
      throw new Error("Transport closed");
    });
    requestFromServiceWorker("/imageproxy?p=1");

    const { message } = await waitForProxyResponse();
    expect(message.data).toMatchObject({
      id: "req-1",
      status: 503,
      headers: { "Content-Type": "text/plain", "Retry-After": "5" },
    });
    expect(new TextDecoder().decode(message.data.body)).toBe(
      "Transport closed",
    );
  });

  it("answers a request in its failure cooldown without asking the transport", async () => {
    const { httpProxyBridge } = await import("@/plugins/remote/http-proxy");
    const sendHttpProxyRequest = vi.fn(async () => {
      throw new Error("boom");
    });

    await httpProxyBridge.initialize();
    await setTransport(sendHttpProxyRequest);
    requestFromServiceWorker("/imageproxy?p=1");
    await waitForProxyResponse();

    requestFromServiceWorker("/imageproxy?p=1", "req-2");

    const { message } = await waitForProxyResponse("req-2");
    expect(sendHttpProxyRequest).toHaveBeenCalledTimes(1);
    expect(message.data).toMatchObject({ id: "req-2", status: 503 });
    expect(new TextDecoder().decode(message.data.body)).toBe(
      "Request temporarily suppressed",
    );
  });

  type ProxyResponseMessage = {
    type: string;
    data: {
      id: string;
      status: number;
      headers: Record<string, string>;
      body: Uint8Array;
    };
  };

  async function setTransport(
    sendHttpProxyRequest: (
      method: string,
      path: string,
      headers: Record<string, string>,
    ) => Promise<{
      status: number;
      headers: Record<string, string>;
      body: Uint8Array;
    }>,
  ): Promise<void> {
    const { httpProxyBridge } = await import("@/plugins/remote/http-proxy");
    await httpProxyBridge.setTransport({
      sendHttpProxyRequest,
    } as unknown as Parameters<typeof httpProxyBridge.setTransport>[0]);
  }

  function requestFromServiceWorker(path: string, id = "req-1"): void {
    const event = {
      data: {
        type: "http-proxy-request",
        data: { id, method: "GET", path, headers: {} },
      },
    } as MessageEvent;
    messageListeners.forEach((listener) => listener(event));
  }

  async function waitForProxyResponse(id = "req-1"): Promise<{
    message: ProxyResponseMessage;
    transfer: Transferable[] | undefined;
  }> {
    await vi.waitFor(() => expect(proxyResponse(id)).toBeDefined());
    const [message, transfer] = proxyResponse(id)!;
    return { message: message as ProxyResponseMessage, transfer };
  }

  function proxyResponse(id: string) {
    return postMessage.mock.calls.find(
      ([message]) =>
        message.type === "http-proxy-response" &&
        (message.data as { id: string }).id === id,
    );
  }

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
