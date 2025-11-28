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

const CACHE_NAME = "ma-http-proxy-v1";
const HTTP_PROXY_CHANNEL = "ma-http-proxy";

// Store for pending HTTP requests
const pendingRequests = new Map();

// Listen for messages from the main thread
self.addEventListener("message", (event) => {
  const { type, data } = event.data;
  console.log("[ServiceWorker] Received message:", type, data);

  if (type === "http-proxy-response") {
    // Handle HTTP proxy response
    const { id, status, headers, body } = data;

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

        pendingRequest.resolve(response);
      } catch (error) {
        pendingRequest.reject(error);
      }
    }
  } else if (type === "set-remote-mode") {
    // Update remote mode state
    self.isRemoteMode = data.isRemote;
    console.log("[ServiceWorker] Remote mode set to:", self.isRemoteMode);
  }
});

// Intercept fetch requests
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only intercept image proxy requests when in remote mode
  if (self.isRemoteMode && url.pathname.startsWith("/imageproxy")) {
    console.log(
      "[ServiceWorker] Intercepting imageproxy request:",
      url.pathname,
    );
    event.respondWith(handleImageProxyRequest(event.request));
    return;
  }

  // For imageproxy requests when NOT in remote mode, let them through normally
  if (url.pathname.startsWith("/imageproxy")) {
    console.log(
      "[ServiceWorker] Passing through imageproxy request (not in remote mode)",
    );
    event.respondWith(fetch(event.request));
    return;
  }

  // For all other requests, don't intercept (let Workbox handle it)
  // Don't call event.respondWith() to let other handlers process the request
});

/**
 * Handle image proxy request over WebRTC
 */
async function handleImageProxyRequest(request) {
  const url = new URL(request.url);

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
        reject(new Error("HTTP proxy request timeout"));
      }
    }, 30000);
  });

  // Extract headers (only send essential ones)
  const headers = {};
  const essentialHeaders = [
    "accept",
    "accept-encoding",
    "cache-control",
    "if-none-match",
    "if-modified-since",
  ];
  for (const header of essentialHeaders) {
    const value = request.headers.get(header);
    if (value) {
      headers[header] = value;
    }
  }

  // Send HTTP proxy request to main thread
  const clients = await self.clients.matchAll();
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
  } else {
    pendingRequests.delete(requestId);
    return new Response("Service worker error: No client found", {
      status: 503,
    });
  }

  try {
    return await responsePromise;
  } catch (error) {
    console.error("[ServiceWorker] HTTP proxy error:", error);
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

// Initialize state
self.isRemoteMode = false;

// Claim clients immediately when service worker activates
self.addEventListener("activate", (event) => {
  console.log("[ServiceWorker] Activating and claiming clients");
  event.waitUntil(self.clients.claim());
});

console.log("[ServiceWorker] Loaded");
