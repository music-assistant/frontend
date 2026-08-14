import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("workbox-precaching", () => ({
  precacheAndRoute: vi.fn(),
}));

const ORIGIN = "https://ma.example";
const CLIENT_ID = "test-client-1";
// Shared by every request in these tests, so a repeat request hits the same
// cache entry as the one before it.
const IMAGE_URL = `${ORIGIN}/imageproxy/album.jpg`;
const REMOTE_MODE_CACHE_NAME = "ma-sw-client-state-v1";
const REMOTE_MODE_CACHE_PATH = "/__ma_remote_mode__/";
const PROXY_CACHE_NAME = "ma-http-proxy-v1";
const MESSAGE_PROTOCOL_VERSION = 1;

type PostMessage = (message: {
  type: string;
  data: {
    id: string;
    method: string;
    path: string;
    headers: Record<string, string>;
  };
}) => void;

/**
 * Minimal in-memory Cache Storage stand-in covering the open/match/put/delete/keys
 * calls sw.js makes against the real `caches` global.
 */
function createFakeCaches() {
  const stores = new Map<string, Map<string, Response>>();

  function storeFor(name: string): Map<string, Response> {
    let store = stores.get(name);
    if (!store) {
      store = new Map();
      stores.set(name, store);
    }
    return store;
  }

  function keyFor(request: string | { url: string }): string {
    return typeof request === "string" ? request : request.url;
  }

  return {
    open: vi.fn(async (name: string) => {
      const store = storeFor(name);
      return {
        // Every match hands out a fresh response, as the real Cache does:
        // callers read the body, and a second match must still be readable.
        match: vi.fn(async (request: string | { url: string }) =>
          store.get(keyFor(request))?.clone(),
        ),
        put: vi.fn(
          async (request: string | { url: string }, response: Response) => {
            store.set(keyFor(request), response);
          },
        ),
        delete: vi.fn(async (request: string | { url: string }) =>
          store.delete(keyFor(request)),
        ),
        keys: vi.fn(async () =>
          Array.from(store.keys()).map((url) => ({ url })),
        ),
      };
    }),
    delete: vi.fn(async (name: string) => stores.delete(name)),
  };
}

/**
 * Stand-in for the ServiceWorkerGlobalScope: records listeners registered via
 * addEventListener so a test can fire them directly, and tracks clients
 * `self.clients.get()` can resolve.
 */
function createFakeSelf() {
  const listeners = new Map<string, Array<(event: unknown) => unknown>>();
  const clientsById = new Map<
    string,
    { id: string; postMessage: PostMessage }
  >();

  return {
    __WB_MANIFEST: [],
    location: { origin: ORIGIN },
    addEventListener: vi.fn(
      (type: string, listener: (event: unknown) => unknown) => {
        const forType = listeners.get(type) ?? [];
        forType.push(listener);
        listeners.set(type, forType);
      },
    ),
    clients: {
      get: vi.fn(async (id: string) => clientsById.get(id)),
      matchAll: vi.fn(async () => Array.from(clientsById.values())),
      claim: vi.fn(async () => undefined),
    },
    skipWaiting: vi.fn(async () => undefined),
    registerClient(id: string, postMessage: PostMessage) {
      clientsById.set(id, { id, postMessage });
    },
    fire(type: string, event: unknown): Promise<unknown[]> {
      return Promise.all(
        (listeners.get(type) ?? []).map((listener) => listener(event)),
      );
    },
  };
}

function remoteStateKey(clientId: string): string {
  return new URL(
    `${REMOTE_MODE_CACHE_PATH}${encodeURIComponent(clientId)}`,
    ORIGIN,
  ).href;
}

describe("sw.js", () => {
  let fakeSelf: ReturnType<typeof createFakeSelf>;
  let fakeCaches: ReturnType<typeof createFakeCaches>;

  beforeEach(async () => {
    vi.resetModules();
    fakeSelf = createFakeSelf();
    fakeCaches = createFakeCaches();
    vi.stubGlobal("self", fakeSelf);
    vi.stubGlobal("caches", fakeCaches);

    // Remote mode has to be ON for the client, otherwise the fetch listener
    // lets the request through to fetch() instead of proxying it.
    const cache = await fakeCaches.open(REMOTE_MODE_CACHE_NAME);
    await cache.put(
      remoteStateKey(CLIENT_ID),
      new Response(JSON.stringify({ isRemote: true })),
    );

    // @ts-expect-error - sw.js is plain JS with no type declarations
    await import("../../public/sw.js");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Includes the 0x00/0xFF boundary values a hex round-trip would be most
  // likely to mangle.
  const BYTES = new Uint8Array([0, 1, 2, 3, 127, 128, 254, 255]);

  it("turns a raw-bytes body into a Response with those exact bytes", async () => {
    const response = await proxiedResponse(BYTES);

    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(BYTES);
  });

  it("refuses a response from a page that speaks another protocol", async () => {
    // the hex body the build before the raw-bytes handoff posts
    const hex = Array.from(BYTES)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");

    const response = await proxiedResponse(hex, 200, { stamped: false });

    expect(response.status).toBe(500);
    // reading it as if the shapes matched yields a 200 that lands in the proxy
    // cache, which is read back cache-first and so outlives any reload
    const cache = await fakeCaches.open(PROXY_CACHE_NAME);
    expect(await cache.keys()).toEqual([]);
  });

  it("answers a repeat request from cache without asking the page again", async () => {
    await proxiedResponse(BYTES);

    const { response, postMessage } = await fireFetch();

    const cached = await response;
    expect(new Uint8Array(await cached.arrayBuffer())).toEqual(BYTES);
    // Cache-first: a cached entry is never revalidated, so nothing goes back
    // over the WebRTC channel. Losing the cache hit altogether stalls the await
    // above instead, as no page is standing by to answer the proxy request.
    expect(postMessage).not.toHaveBeenCalled();
  });

  it("passes the status through, so the page can report a failure", async () => {
    const response = await proxiedResponse(
      new TextEncoder().encode("No transport available"),
      503,
    );

    expect(response.status).toBe(503);
    expect(await response.text()).toBe("No transport available");
  });

  // the check that refuses another build's messages sits in front of every one
  // of them, so it has to let this one through as well
  it("acknowledges a stamped remote-mode message", async () => {
    const postMessage = vi.fn();

    await fakeSelf.fire("message", {
      data: {
        type: "set-remote-mode",
        protocol: MESSAGE_PROTOCOL_VERSION,
        data: { isRemote: true, proxyScope: "remote-id" },
      },
      source: { id: CLIENT_ID, postMessage },
    });

    expect(postMessage).toHaveBeenCalledWith({
      type: "remote-mode-ack",
      data: { isRemote: true },
    });
  });

  it("does not take over a tab that is running an earlier build", async () => {
    await fakeSelf.fire("install", { waitUntil: () => undefined });

    expect(fakeSelf.skipWaiting).not.toHaveBeenCalled();
  });

  it("takes over once the page accepts the update", async () => {
    await fakeSelf.fire("message", { data: { type: "SKIP_WAITING" } });

    expect(fakeSelf.skipWaiting).toHaveBeenCalled();
  });

  /**
   * Request the proxied image. Returns the worker's response and the client
   * mock, which only receives a proxy request when the cache misses.
   */
  async function fireFetch(): Promise<{
    response: Promise<Response>;
    postMessage: ReturnType<typeof vi.fn<PostMessage>>;
  }> {
    const postMessage = vi.fn<PostMessage>();
    fakeSelf.registerClient(CLIENT_ID, postMessage);

    let response!: Promise<Response>;
    await fakeSelf.fire("fetch", {
      request: new Request(IMAGE_URL),
      clientId: CLIENT_ID,
      respondWith: (promise: Promise<Response>) => {
        response = promise;
      },
    });

    return { response, postMessage };
  }

  /**
   * Drive a proxied image request end to end and answer it with the given body,
   * as the page would.
   */
  async function proxiedResponse(
    body: Uint8Array | string,
    status = 200,
    { stamped = true } = {},
  ): Promise<Response> {
    const { response, postMessage } = await fireFetch();
    await vi.waitFor(() => expect(postMessage).toHaveBeenCalledTimes(1));

    await fakeSelf.fire("message", {
      data: {
        type: "http-proxy-response",
        ...(stamped ? { protocol: MESSAGE_PROTOCOL_VERSION } : {}),
        data: {
          id: postMessage.mock.calls[0][0].data.id,
          status,
          headers: { "content-type": "image/jpeg" },
          body,
        },
      },
      source: { id: CLIENT_ID },
    });

    return response;
  }
});
