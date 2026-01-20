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

// Storage key for remote mode state in Cache API
const REMOTE_MODE_CACHE_KEY = "ma-remote-mode-state";

/**
 * Read remote mode state from persistent storage
 * Returns true if in remote mode, false otherwise
 */
async function getRemoteMode() {
  try {
    const cache = await caches.open("ma-sw-state-v1");
    const response = await cache.match(REMOTE_MODE_CACHE_KEY);
    if (response) {
      const data = await response.json();
      return data.isRemote === true;
    }
  } catch (error) {
    console.error("[ServiceWorker] Error reading remote mode:", error);
  }
  return false; // Default to local mode on error
}

/**
 * Write remote mode state to persistent storage
 */
async function setRemoteMode(isRemote) {
  try {
    const cache = await caches.open("ma-sw-state-v1");
    await cache.put(
      REMOTE_MODE_CACHE_KEY,
      new Response(JSON.stringify({ isRemote }), {
        headers: { "Content-Type": "application/json" },
      }),
    );
    console.log("[ServiceWorker] Remote mode set to:", isRemote);
  } catch (error) {
    console.error("[ServiceWorker] Error writing remote mode:", error);
  }
}

// Listen for messages from the main thread
self.addEventListener("message", async (event) => {
  const { type, data } = event.data;

  if (type === "http-proxy-response") {
    // Handle HTTP proxy response
    const { id, status, headers, body } = data;

    console.log(
      "[ServiceWorker] Received http-proxy-response:",
      id,
      "status:",
      status,
      "pending:",
      pendingRequests.has(id),
    );

    const pendingRequest = pendingRequests.get(id);
    if (pendingRequest) {
      pendingRequests.delete(id);

      try {
        // Convert hex string back to Uint8Array
        const bodyBytes = hexToBytes(body);

        // Create Response object
        const response = new Response(bodyBytes, {
          status: status,
          headers: new Headers(headers),
        });

        console.log("[ServiceWorker] Resolving http-proxy-response:", id);
        pendingRequest.resolve(response);
      } catch (error) {
        console.error(
          "[ServiceWorker] Error processing http-proxy-response:",
          id,
          error,
        );
        pendingRequest.reject(error);
      }
    } else {
      console.warn(
        "[ServiceWorker] Received http-proxy-response for unknown request:",
        id,
      );
    }
  } else if (type === "set-remote-mode") {
    // Update remote mode state in PERSISTENT storage
    await setRemoteMode(data.isRemote);
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
        const isRemoteMode = await getRemoteMode();

        if (isRemoteMode) {
          // Proxy over WebRTC when in remote mode
          return handleHttpProxyRequest(event.request);
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
async function handleHttpProxyRequest(request) {
  const url = new URL(request.url);
  const cacheKey = request.url;

  // Try to get from cache first
  const cache = await caches.open("ma-http-proxy-v1");
  const cachedResponse = await cache.match(cacheKey);

  if (cachedResponse) {
    // Return cached response immediately (cache-first strategy)
    // We'll still revalidate in the background for next time
    console.log("[ServiceWorker] Cache HIT for:", url.pathname);
    return cachedResponse;
  }

  console.log("[ServiceWorker] Cache MISS for:", url.pathname);

  // Generate unique request ID
  const requestId = generateRequestId();

  // Create promise for response
  const responsePromise = new Promise((resolve, reject) => {
    // Store the resolve/reject callbacks
    pendingRequests.set(requestId, { resolve, reject });

    // Set timeout
    setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId);
        console.error(
          "[ServiceWorker] HTTP proxy request TIMEOUT:",
          requestId,
          url.pathname,
        );
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
  const clients = await self.clients.matchAll();
  console.log(
    "[ServiceWorker] Sending http-proxy-request:",
    requestId,
    url.pathname,
    "clients:",
    clients.length,
  );

  if (clients.length > 0) {
    clients[0].postMessage({
      type: "http-proxy-request",
      data: {
        id: requestId,
        method: request.method,
        path: url.pathname + url.search,
        headers: headers,
      },
    });
    console.log("[ServiceWorker] Message posted to client:", requestId);
  } else {
    console.error("[ServiceWorker] No clients available for:", requestId);
    pendingRequests.delete(requestId);
    return new Response("Service worker error: No client found", {
      status: 503,
    });
  }

  try {
    const response = await responsePromise;

    // If 304 Not Modified, return cached response
    if (response.status === 304 && cachedResponse) {
      return cachedResponse;
    }

    // Cache successful responses (200-299)
    if (response.status >= 200 && response.status < 300) {
      // Clone the response before caching (can only read body once)
      const responseToCache = response.clone();
      cache.put(cacheKey, responseToCache);
    }

    return response;
  } catch (error) {
    console.error("[ServiceWorker] HTTP proxy error:", error);
    // Return cached response on error if available
    if (cachedResponse) {
      return cachedResponse;
    }
    return new Response(error.message, { status: 500 });
  }
}

/**
 * Convert hex string to Uint8Array
 */
function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Generate unique request ID
 */
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

// Skip waiting to activate the new service worker immediately
self.addEventListener("install", (event) => {
  console.log("[ServiceWorker] Installing...");
  event.waitUntil(self.skipWaiting());
});

// Claim clients immediately when service worker activates
self.addEventListener("activate", (event) => {
  console.log("[ServiceWorker] Activating...");
  event.waitUntil(self.clients.claim());
});
