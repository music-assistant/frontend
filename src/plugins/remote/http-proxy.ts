/**
 * HTTP Proxy Bridge for WebRTC
 *
 * Bridges HTTP requests from the service worker to the WebRTC transport.
 * This enables HTTP-over-WebRTC for remote connections, preserving browser
 * caching and avoiding Base64 overhead.
 */

import { ref } from "vue";
import { WebRTCTransport } from "./webrtc-transport";

// Storage key for remote mode (must match connection-manager.ts)
const REMOTE_MODE_STORAGE_KEY = "ma_remote_mode";
// Storage key to track reload attempts (prevents infinite loops)
const SW_RELOAD_ATTEMPT_KEY = "ma_sw_reload_attempt";

class HttpProxyBridge {
  private transport: WebRTCTransport | null = null;
  // Cache of recently failed requests to prevent retry loops
  // Key: path, Value: { timestamp, errorCount }
  private failedRequests = new Map<
    string,
    { timestamp: number; errorCount: number }
  >();
  // How long to suppress retries for a failed request (5 seconds)
  private static readonly FAILURE_COOLDOWN_MS = 5000;
  // Max failures before longer cooldown
  private static readonly MAX_FAILURES_BEFORE_EXTENDED_COOLDOWN = 3;
  // Extended cooldown for persistent failures (30 seconds)
  private static readonly EXTENDED_COOLDOWN_MS = 30000;
  // Promise that resolves when service worker is ready and controlling
  private initPromise: Promise<void> | null = null;
  // Reactive ref indicating if service worker is ready and controlling
  public isReady = ref(false);

  /**
   * Initialize the HTTP proxy bridge
   * Returns a promise that resolves when the service worker is ready and controlling
   */
  async initialize(): Promise<void> {
    // Only initialize once
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  /**
   * Wait for initialization to complete
   * Call this before making any remote connections to ensure the service worker is ready
   */
  async ensureReady(): Promise<void> {
    // If not yet initialized, trigger initialization
    if (!this.initPromise) {
      await this.initialize();
    } else {
      await this.initPromise;
    }
  }

  /**
   * Internal initialization logic
   */
  private async doInitialize(): Promise<void> {
    // Register service worker if not already registered
    if ("serviceWorker" in navigator) {
      try {
        await navigator.serviceWorker.register("./sw.js");

        // Wait for service worker to be ready
        await navigator.serviceWorker.ready;

        // Wait for service worker to be controlling the page
        // This is critical to prevent race conditions on hard refresh
        const hasController = await this.waitForController();

        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener("message", (event) => {
          this.handleServiceWorkerMessage(event);
        });

        // Check if we were in remote mode (from localStorage) and notify SW early
        // This prevents the race condition where images load before remote mode is set
        const storedMode = localStorage.getItem(REMOTE_MODE_STORAGE_KEY);
        if (storedMode === "remote" && hasController) {
          console.log(
            "[HttpProxyBridge] Restoring remote mode from localStorage",
          );
          await this.notifyRemoteMode(true);
        }

        if (hasController) {
          console.log("[HttpProxyBridge] Service worker ready and controlling");
          // Clear any previous reload attempt flag
          sessionStorage.removeItem(SW_RELOAD_ATTEMPT_KEY);
        } else {
          // SW isn't controlling yet (first load after install)
          // Check if we're in remote mode - if so, we need to reload for images to work
          const storedMode = localStorage.getItem(REMOTE_MODE_STORAGE_KEY);
          const reloadAttempted = sessionStorage.getItem(SW_RELOAD_ATTEMPT_KEY);

          if (storedMode === "remote" && !reloadAttempted) {
            console.log(
              "[HttpProxyBridge] Service worker not controlling yet, reloading page for remote mode...",
            );
            // Mark that we've attempted a reload to prevent infinite loops
            sessionStorage.setItem(SW_RELOAD_ATTEMPT_KEY, "true");
            // Small delay to ensure SW is fully activated before reload
            await new Promise((resolve) => setTimeout(resolve, 100));
            window.location.reload();
            return; // Don't continue - page is reloading
          }

          if (storedMode === "remote" && reloadAttempted) {
            // We already tried reloading but SW still isn't controlling
            // This can happen in certain edge cases - proceed anyway
            console.warn(
              "[HttpProxyBridge] Service worker still not controlling after reload, images may not load correctly",
            );
          } else {
            // Not in remote mode, proceed normally
            console.log(
              "[HttpProxyBridge] Service worker not controlling yet (not in remote mode)",
            );
          }
          this.isReady.value = true;
        }
      } catch (error) {
        console.error(
          "[HttpProxyBridge] Service worker registration failed:",
          error,
        );
        // Set isReady so app doesn't block
        this.isReady.value = true;
      }
    } else {
      // No service worker support
      this.isReady.value = true;
    }
  }

  /**
   * Wait for the service worker to be controlling the page
   * Returns true if controller is available, false if timed out
   */
  private waitForController(): Promise<boolean> {
    return new Promise((resolve) => {
      if (navigator.serviceWorker.controller) {
        this.isReady.value = true;
        resolve(true);
        return;
      }

      // Wait for controllerchange event
      const onControllerChange = () => {
        navigator.serviceWorker.removeEventListener(
          "controllerchange",
          onControllerChange,
        );
        this.isReady.value = true;
        resolve(true);
      };
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        onControllerChange,
      );

      // Also set a timeout to prevent hanging forever
      setTimeout(() => {
        navigator.serviceWorker.removeEventListener(
          "controllerchange",
          onControllerChange,
        );
        // Resolve anyway after timeout - the app should still work
        // even if service worker isn't controlling yet
        console.warn(
          "[HttpProxyBridge] Timeout waiting for service worker controller",
        );
        // Don't set isReady = true here - SW isn't actually controlling
        resolve(false);
      }, 3000);
    });
  }

  /**
   * Set the WebRTC transport to use for proxying
   */
  async setTransport(transport: WebRTCTransport | null): Promise<void> {
    this.transport = transport;
    await this.notifyRemoteMode(transport !== null);
  }

  /**
   * Notify service worker of remote mode state
   * Returns a promise that resolves when the SW acknowledges the message
   */
  private notifyRemoteMode(isRemote: boolean): Promise<void> {
    return new Promise((resolve) => {
      // If no service worker support or no controller, resolve immediately
      if (!navigator.serviceWorker?.controller) {
        console.warn(
          "[HttpProxyBridge] No service worker controller, skipping remote mode notification",
        );
        resolve();
        return;
      }

      // Set up listener for acknowledgment BEFORE sending message
      const onAck = (event: MessageEvent) => {
        if (event.data?.type === "remote-mode-ack") {
          navigator.serviceWorker?.removeEventListener("message", onAck);
          console.log(
            "[HttpProxyBridge] Remote mode acknowledged by service worker",
          );
          resolve();
        }
      };
      navigator.serviceWorker.addEventListener("message", onAck);

      // Set a timeout in case ack never comes
      setTimeout(() => {
        navigator.serviceWorker?.removeEventListener("message", onAck);
        console.warn(
          "[HttpProxyBridge] Timeout waiting for remote mode acknowledgment",
        );
        resolve();
      }, 2000);

      // Send the message
      navigator.serviceWorker.controller.postMessage({
        type: "set-remote-mode",
        data: { isRemote },
      });
    });
  }

  /**
   * Handle messages from service worker
   */
  private handleServiceWorkerMessage(event: MessageEvent): void {
    const { type, data } = event.data;

    if (type === "http-proxy-request") {
      this.handleHttpProxyRequest(data);
    }
  }

  /**
   * Check if a request should be suppressed due to recent failures
   */
  private shouldSuppressRequest(path: string): boolean {
    const failureInfo = this.failedRequests.get(path);
    if (!failureInfo) return false;

    const now = Date.now();
    const cooldown =
      failureInfo.errorCount >=
      HttpProxyBridge.MAX_FAILURES_BEFORE_EXTENDED_COOLDOWN
        ? HttpProxyBridge.EXTENDED_COOLDOWN_MS
        : HttpProxyBridge.FAILURE_COOLDOWN_MS;

    if (now - failureInfo.timestamp < cooldown) {
      return true;
    }

    // Cooldown expired, remove from cache
    this.failedRequests.delete(path);
    return false;
  }

  /**
   * Record a failed request
   */
  private recordFailure(path: string): void {
    const existing = this.failedRequests.get(path);
    this.failedRequests.set(path, {
      timestamp: Date.now(),
      errorCount: (existing?.errorCount ?? 0) + 1,
    });

    // Clean up old entries periodically (keep map from growing unbounded)
    if (this.failedRequests.size > 100) {
      const now = Date.now();
      for (const [key, value] of this.failedRequests.entries()) {
        if (now - value.timestamp > HttpProxyBridge.EXTENDED_COOLDOWN_MS) {
          this.failedRequests.delete(key);
        }
      }
    }
  }

  /**
   * Clear failure record for a path (on success)
   */
  private clearFailure(path: string): void {
    this.failedRequests.delete(path);
  }

  /**
   * Handle HTTP proxy request from service worker
   */
  private async handleHttpProxyRequest(data: {
    id: string;
    method: string;
    path: string;
    headers: Record<string, string>;
  }): Promise<void> {
    // Check if this request should be suppressed due to recent failures
    if (this.shouldSuppressRequest(data.path)) {
      // Return a 503 Service Unavailable to indicate temporary failure
      // This prevents retry loops while still informing the client
      if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "http-proxy-response",
          data: {
            id: data.id,
            status: 503,
            headers: {
              "Content-Type": "text/plain",
              "Retry-After": "5",
            },
            body: this.bytesToHex(
              new TextEncoder().encode("Request temporarily suppressed"),
            ),
          },
        });
      }
      return;
    }

    if (!this.transport) {
      console.error(
        "[HttpProxyBridge] No transport available for HTTP proxy request",
      );
      this.recordFailure(data.path);
      this.sendErrorResponse(data.id, 503, "No transport available");
      return;
    }

    try {
      // Send request through WebRTC
      const response = await this.transport.sendHttpProxyRequest(
        data.method,
        data.path,
        data.headers,
      );

      // Clear any previous failure record on success (2xx or 4xx client errors)
      // 4xx errors like 404 are valid responses, not transport failures
      if (response.status < 500) {
        this.clearFailure(data.path);
      }

      // Send response back to service worker
      if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "http-proxy-response",
          data: {
            id: data.id,
            status: response.status,
            headers: response.headers,
            body: this.bytesToHex(response.body),
          },
        });
      }
    } catch (error) {
      // Record the failure to prevent immediate retries
      this.recordFailure(data.path);

      // Check if this is a transport-level error that we should handle gracefully
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const isTransportError =
        errorMessage.includes("Transport closed") ||
        errorMessage.includes("DataChannel is not open") ||
        errorMessage.includes("timeout");

      if (isTransportError) {
        // Log at debug level for transport errors - these are expected during reconnection
        console.debug(
          "[HttpProxyBridge] HTTP proxy request failed (transport issue):",
          errorMessage,
        );
      } else {
        console.error("[HttpProxyBridge] HTTP proxy request failed:", error);
      }

      // Send error response with appropriate status code
      this.sendErrorResponse(
        data.id,
        isTransportError ? 503 : 500,
        errorMessage,
      );
    }
  }

  /**
   * Send an error response to the service worker
   */
  private sendErrorResponse(id: string, status: number, message: string): void {
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "http-proxy-response",
        data: {
          id,
          status,
          headers: {
            "Content-Type": "text/plain",
            ...(status === 503 ? { "Retry-After": "5" } : {}),
          },
          body: this.bytesToHex(new TextEncoder().encode(message)),
        },
      });
    }
  }

  /**
   * Convert Uint8Array to hex string
   */
  private bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
}

// Export singleton instance
export const httpProxyBridge = new HttpProxyBridge();
export default httpProxyBridge;
