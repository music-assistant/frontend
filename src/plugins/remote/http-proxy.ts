/**
 * HTTP Proxy Bridge for WebRTC
 *
 * Bridges HTTP requests from the service worker to the WebRTC transport.
 * This enables HTTP-over-WebRTC for remote connections, preserving browser
 * caching and avoiding Base64 overhead.
 */

import { WebRTCTransport } from "./webrtc-transport";

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

  /**
   * Initialize the HTTP proxy bridge
   */
  async initialize(): Promise<void> {
    // Register service worker if not already registered
    if ("serviceWorker" in navigator) {
      try {
        await navigator.serviceWorker.register("./sw.js");

        // Wait for service worker to be ready
        await navigator.serviceWorker.ready;

        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener("message", (event) => {
          this.handleServiceWorkerMessage(event);
        });
      } catch (error) {
        console.error(
          "[HttpProxyBridge] Service worker registration failed:",
          error,
        );
      }
    }
  }

  /**
   * Set the WebRTC transport to use for proxying
   */
  setTransport(transport: WebRTCTransport | null): void {
    this.transport = transport;
    this.notifyRemoteMode(transport !== null);
  }

  /**
   * Notify service worker of remote mode state
   */
  private notifyRemoteMode(isRemote: boolean): void {
    const sendMessage = () => {
      if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "set-remote-mode",
          data: { isRemote },
        });
        return true;
      }
      return false;
    };

    // Try to send immediately
    if (sendMessage()) {
      return;
    }

    // If no controller yet, wait for controllerchange event
    const onControllerChange = () => {
      if (sendMessage()) {
        navigator.serviceWorker?.removeEventListener(
          "controllerchange",
          onControllerChange,
        );
      }
    };

    navigator.serviceWorker?.addEventListener(
      "controllerchange",
      onControllerChange,
    );

    // Also retry after a short delay in case controllerchange doesn't fire
    setTimeout(() => {
      sendMessage();
    }, 1000);
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
