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
// Kept in step with sw.js: the entry cap and what a prune leaves behind.
const PROXY_CACHE_MAX_ENTRIES = 500;
const PROXY_CACHE_PRUNE_TO_ENTRIES = 400;
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
  let putFailure: { error: Error; remaining: number } | null = null;

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
        // Deliberately not a vi.fn: a mock tracks the promise it hands back,
        // which counts as handling a rejection, and a write the worker fails
        // to catch would then no longer surface as an unhandled rejection.
        put: async (request: string | { url: string }, response: Response) => {
          if (putFailure && putFailure.remaining > 0) {
            putFailure.remaining -= 1;
            throw putFailure.error;
          }
          store.set(keyFor(request), response);
        },
        delete: vi.fn(async (request: string | { url: string }) =>
          store.delete(keyFor(request)),
        ),
        keys: vi.fn(async () =>
          Array.from(store.keys()).map((url) => ({ url })),
        ),
      };
    }),
    has: vi.fn(async (name: string) => stores.has(name)),
    delete: vi.fn(async (name: string) => stores.delete(name)),
    /** Make the next `count` writes fail, as a full storage quota would. */
    failPuts(count: number) {
      putFailure = {
        error: new DOMException("Quota exceeded", "QuotaExceededError"),
        remaining: count,
      };
    },
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
  // Work the worker handed to event.waitUntil(), i.e. the cache writes that
  // deliberately outlive the response.
  let pendingWork: Array<Promise<unknown>>;

  beforeEach(async () => {
    vi.resetModules();
    fakeSelf = createFakeSelf();
    fakeCaches = createFakeCaches();
    pendingWork = [];
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

  it("still answers a request when the image cannot be cached", async () => {
    fakeCaches.failPuts(Number.POSITIVE_INFINITY);

    const response = await proxiedResponse(BYTES);

    expect(new Uint8Array(await response.arrayBuffer())).toEqual(BYTES);
    // A rejected write must not escape the worker either: the suite fails a
    // test on an unhandled rejection.
    const cache = await fakeCaches.open(PROXY_CACHE_NAME);
    expect(await cache.keys()).toEqual([]);
  });

  it("caches the image after making room for a failed write", async () => {
    fakeCaches.failPuts(1);

    await proxiedResponse(BYTES);

    const cache = await fakeCaches.open(PROXY_CACHE_NAME);
    expect(await cache.keys()).toHaveLength(1);
  });

  it("drops the oldest images once the cache is full", async () => {
    const cache = await fakeCaches.open(PROXY_CACHE_NAME);
    for (let index = 0; index < PROXY_CACHE_MAX_ENTRIES; index++) {
      await cache.put(
        `${ORIGIN}/imageproxy/old-${index}.jpg`,
        new Response(""),
      );
    }

    await proxiedResponse(BYTES);

    const urls = (await cache.keys()).map((entry) => entry.url);
    expect(urls).toHaveLength(PROXY_CACHE_PRUNE_TO_ENTRIES);
    // One entry over the cap, so the oldest 101 are gone and the image that
    // pushed it over is the newest entry.
    const dropped = PROXY_CACHE_MAX_ENTRIES + 1 - PROXY_CACHE_PRUNE_TO_ENTRIES;
    expect(urls[0]).toBe(`${ORIGIN}/imageproxy/old-${dropped}.jpg`);
    expect(urls.at(-1)).toContain(IMAGE_URL);
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

  it("trims a cache left behind by a version without a cap", async () => {
    const cache = await fakeCaches.open(PROXY_CACHE_NAME);
    for (let index = 0; index < PROXY_CACHE_MAX_ENTRIES + 50; index++) {
      await cache.put(
        `${ORIGIN}/imageproxy/old-${index}.jpg`,
        new Response(""),
      );
    }

    await fakeSelf.fire("activate", {
      waitUntil: (promise: Promise<unknown>) => {
        pendingWork.push(promise);
      },
    });
    await settlePendingWork();

    expect(await cache.keys()).toHaveLength(PROXY_CACHE_PRUNE_TO_ENTRIES);
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
      waitUntil: (promise: Promise<unknown>) => {
        pendingWork.push(promise);
      },
    });

    return { response, postMessage };
  }

  /**
   * Wait for the work the worker handed to waitUntil().
   */
  async function settlePendingWork(): Promise<void> {
    while (pendingWork.length > 0) {
      await Promise.all(pendingWork.splice(0));
    }
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

    // The worker hands its cache write to waitUntil() just before it answers, so
    // the response has to be awaited first for that write to exist.
    const proxied = await response;
    await settlePendingWork();
    return proxied;
  }
});
