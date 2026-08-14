/**
 * Music Assistant Service Worker
 *
 * Handles HTTP-over-WebRTC proxy for remote connections.
 * This allows image requests to be proxied through the WebRTC data channel
 * when connected remotely, enabling browser caching and avoiding Base64 overhead.
 */

import { precacheAndRoute } from "workbox-precaching";

// Precache assets injected by workbox
precacheAndRoute(self.__WB_MANIFEST);

// Store for pending HTTP requests
const pendingRequests = new Map();

// Shape of the messages the page posts here (src/plugins/remote/http-proxy.ts).
// Bump on any change: a page from another build is then refused rather than read
// as if the shapes still matched. Only this direction is checked, because only a
// misread response ends up in a cache.
const MESSAGE_PROTOCOL_VERSION = 1;

const LEGACY_REMOTE_MODE_CACHE_NAME = "ma-sw-state-v1";
const LEGACY_REMOTE_MODE_CACHE_KEY = "ma-remote-mode-state";
const REMOTE_MODE_CACHE_NAME = "ma-sw-client-state-v1";
const REMOTE_MODE_CACHE_PATH = "/__ma_remote_mode__/";

const PROXY_CACHE_NAME = "ma-http-proxy-v1";
// Proxied images never expire and every server a client connects to gets its
// own set of entries, so the cache is capped by entry count. Pruning goes
// below the cap so a full cache does not scan itself on every write.
const PROXY_CACHE_MAX_ENTRIES = 500;
const PROXY_CACHE_PRUNE_TO_ENTRIES = 400;

// Entry count of the proxy cache, so a write knows whether it went over the cap
// without enumerating the cache first. Rewriting an existing entry counts twice,
// which only prunes earlier than needed: a prune re-reads the real count.
let proxyCacheEntryCount = null;

/**
 * Read remote proxy state for a browser client.
 */
async function getRemoteState(clientId) {
  if (!clientId) return { isRemote: false };

  try {
    const cache = await caches.open(REMOTE_MODE_CACHE_NAME);
    const response = await cache.match(getRemoteStateKey(clientId));
    if (response) {
      const data = await response.json();
      return {
        isRemote: data.isRemote === true,
        proxyScope: data.proxyScope,
      };
    }
  } catch (error) {
    console.error("[ServiceWorker] Error reading remote mode:", error);
  }
  return { isRemote: false };
}

/**
 * Write remote proxy state for a browser client.
 */
async function setRemoteState(clientId, isRemote, proxyScope) {
  if (!clientId) return;

  try {
    const cache = await caches.open(REMOTE_MODE_CACHE_NAME);
    const cacheKey = getRemoteStateKey(clientId);
    if (isRemote) {
      await cache.put(
        cacheKey,
        new Response(JSON.stringify({ isRemote, proxyScope }), {
          headers: { "Content-Type": "application/json" },
        }),
      );
    } else {
      await cache.delete(cacheKey);
    }
    await pruneRemoteStates(cache);
    console.log(
      "[ServiceWorker] Remote mode set for client:",
      clientId,
      isRemote,
    );
  } catch (error) {
    console.error("[ServiceWorker] Error writing remote mode:", error);
  }
}

function getRemoteStateKey(clientId) {
  return new URL(
    `${REMOTE_MODE_CACHE_PATH}${encodeURIComponent(clientId)}`,
    self.location.origin,
  ).href;
}

async function pruneRemoteStates(cache) {
  const activeClients = await self.clients.matchAll({
    includeUncontrolled: true,
  });
  const activeStateKeys = new Set(
    activeClients.map((client) => getRemoteStateKey(client.id)),
  );
  const storedStateKeys = await cache.keys();
  await Promise.all(
    storedStateKeys
      .filter((request) => !activeStateKeys.has(request.url))
      .map((request) => cache.delete(request)),
  );
}

async function migrateLegacyRemoteState() {
  const legacyCache = await caches.open(LEGACY_REMOTE_MODE_CACHE_NAME);
  const response = await legacyCache.match(LEGACY_REMOTE_MODE_CACHE_KEY);
  if (!response) return;

  const data = await response.json();
  if (data.isRemote === true) {
    const activeClients = await self.clients.matchAll({
      includeUncontrolled: true,
    });
    const cache = await caches.open(REMOTE_MODE_CACHE_NAME);
    await Promise.all(
      activeClients.map((client) =>
        cache.put(
          getRemoteStateKey(client.id),
          new Response(JSON.stringify({ isRemote: true }), {
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    );
  }

  await caches.delete(LEGACY_REMOTE_MODE_CACHE_NAME);
}

// Listen for messages from the main thread
self.addEventListener("message", async (event) => {
  const { type, protocol, data } = event.data;

  // Sent by the update prompt when the user accepts a new version. Without it a
  // new worker only takes over once no tab is running the old one, so a tab is
  // never handed a worker from a build it did not load with. It comes from the
  // prompt rather than the proxy bridge, so it carries no stamp and has to be
  // handled ahead of the check below.
  if (type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  // Message shapes only hold within a single build. Reading a page from another
  // one as if they matched can yield a response that looks valid and gets cached,
  // so its request is failed instead.
  if (protocol !== MESSAGE_PROTOCOL_VERSION) {
    rejectPendingRequest(
      data?.id,
      "Page and service worker are from different builds",
    );
    return;
  }

  if (type === "http-proxy-response") {
    // Handle HTTP proxy response
    const { id, status, headers, body } = data;

    const pendingRequest = pendingRequests.get(id);
    if (pendingRequest && pendingRequest.clientId === event.source?.id) {
      pendingRequests.delete(id);

      try {
        // The page posts the body as raw bytes and transfers its buffer to us.
        const response = new Response(body, {
          status: status,
          headers: new Headers(headers),
        });

        pendingRequest.resolve(response);
      } catch (error) {
        pendingRequest.reject(error);
      }
    }
  } else if (type === "set-remote-mode") {
    await setRemoteState(event.source?.id, data.isRemote, data.proxyScope);
    // Send acknowledgment back to the main thread
    if (event.source) {
      event.source.postMessage({
        type: "remote-mode-ack",
        data: { isRemote: data.isRemote },
      });
    }
  }
});

// Intercept fetch requests
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Paths to proxy over WebRTC when in remote mode (e.g. imageproxy)
  // this way we can still use browser caching for these resources
  const proxyPaths = ["/imageproxy", "/preview"];

  // Check if this request should be proxied
  const shouldProxy = proxyPaths.some((path) => url.pathname.startsWith(path));

  if (shouldProxy) {
    // Read remote mode from persistent storage and proxy accordingly
    event.respondWith(
      (async () => {
        const remoteState = await getRemoteState(event.clientId);

        if (remoteState.isRemote) {
          // Proxy over WebRTC when in remote mode
          return handleHttpProxyRequest(event, remoteState.proxyScope);
        } else {
          // Let request through normally when NOT in remote mode
          return fetch(event.request);
        }
      })(),
    );
    return;
  }

  // For all other requests, don't intercept (let Workbox handle it)
  // Don't call event.respondWith() to let other handlers process the request
});

/**
 * Handle HTTP proxy request over WebRTC
 */
async function handleHttpProxyRequest(event, proxyScope) {
  const { request, clientId } = event;
  const url = new URL(request.url);
  const cacheKey = `${request.url}${url.search ? "&" : "?"}__ma_proxy_scope=${encodeURIComponent(proxyScope || clientId)}`;

  // Try to get from cache first
  const cache = await caches.open(PROXY_CACHE_NAME);
  const cachedResponse = await cache.match(cacheKey);

  if (cachedResponse) {
    // Cache-first, and entries are never revalidated: every proxied request
    // costs a WebRTC round trip, and no conditional request is made anyway
    // (only the headers below are forwarded).
    return cachedResponse;
  }

  // Generate unique request ID
  const requestId = generateRequestId();

  // Create promise for response
  const responsePromise = new Promise((resolve, reject) => {
    // Store the resolve/reject callbacks
    pendingRequests.set(requestId, { clientId, resolve, reject });

    // Set timeout
    setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId);
        reject(new Error("HTTP proxy request timeout"));
      }
    }, 30000);
  });

  // Extract headers
  const headers = {};
  const essentialHeaders = ["accept", "accept-encoding"];

  for (const header of essentialHeaders) {
    const value = request.headers.get(header);
    if (value) {
      headers[header] = value;
    }
  }

  // Send HTTP proxy request to main thread
  const client = clientId ? await self.clients.get(clientId) : null;
  if (client) {
    client.postMessage({
      type: "http-proxy-request",
      data: {
        id: requestId,
        method: request.method,
        path: url.pathname + url.search,
        headers: headers,
      },
    });
  } else {
    pendingRequests.delete(requestId);
    return new Response("Service worker error: No client found", {
      status: 503,
    });
  }

  try {
    const response = await responsePromise;

    // Cache successful responses (200-299)
    if (response.status >= 200 && response.status < 300) {
      // Clone the response before caching (can only read body once). The write
      // keeps the worker alive without holding up the image it just fetched.
      event.waitUntil(cacheProxyResponse(cache, cacheKey, response.clone()));
    }

    return response;
  } catch (error) {
    console.error("[ServiceWorker] HTTP proxy error:", error);
    return new Response(error.message, { status: 500 });
  }
}

/**
 * Store a proxied response, keeping the cache within its entry budget.
 *
 * Never rejects: a response that cannot be cached only costs another round trip
 * the next time it is requested.
 */
async function cacheProxyResponse(cache, cacheKey, response) {
  // A rejected put may have read the body already, so hold a spare copy for the
  // retry below.
  const retryCopy = response.clone();

  try {
    try {
      await cache.put(cacheKey, response);
    } catch (error) {
      // Realistically a full storage quota, so make room and try once more.
      console.warn("[ServiceWorker] Proxy cache full, making room:", error);
      await pruneProxyCache(cache);
      await cache.put(cacheKey, retryCopy);
    }

    // Cloning tees the body, so an unread copy holds on to the whole image.
    if (!retryCopy.bodyUsed) await retryCopy.body?.cancel();

    proxyCacheEntryCount =
      proxyCacheEntryCount === null
        ? (await cache.keys()).length
        : proxyCacheEntryCount + 1;

    if (proxyCacheEntryCount > PROXY_CACHE_MAX_ENTRIES) {
      await pruneProxyCache(cache);
    }
  } catch (error) {
    console.error("[ServiceWorker] Could not cache proxied response:", error);
  }
}

/**
 * Drop the oldest proxy cache entries until the cache is back under its cap.
 */
async function pruneProxyCache(cache) {
  const entries = await cache.keys();
  // Cache storage hands back entries in the order they were written, so the
  // oldest ones come first.
  const excess = entries.slice(
    0,
    Math.max(entries.length - PROXY_CACHE_PRUNE_TO_ENTRIES, 0),
  );
  await Promise.all(excess.map((entry) => cache.delete(entry)));
  proxyCacheEntryCount = entries.length - excess.length;
}

/**
 * Fail the proxy request waiting on this id, if there still is one.
 */
function rejectPendingRequest(id, reason) {
  const pendingRequest = pendingRequests.get(id);
  if (!pendingRequest) return;

  pendingRequests.delete(id);
  pendingRequest.reject(new Error(reason));
}

/**
 * Generate unique request ID
 */
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await migrateLegacyRemoteState();
      // A first install has no worker to wait behind, so claiming is what lets
      // the page that registered us proxy its images without reloading first.
      // It also drives the update: the prompt reloads the page off the
      // controller change this fires, and never reloads on its own.
      await self.clients.claim();
      // Brings a cache filled by a version that had no cap back within it, even
      // for a client that never proxies another image.
      if (await caches.has(PROXY_CACHE_NAME)) {
        await pruneProxyCache(await caches.open(PROXY_CACHE_NAME));
      }
    })(),
  );
});
