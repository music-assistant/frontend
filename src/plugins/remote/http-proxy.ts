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
  private serviceWorkerRegistration: ServiceWorkerRegistration | null = null;

  /**
   * Initialize the HTTP proxy bridge
   */
  async initialize(): Promise<void> {
    // Register service worker if not already registered
    if ("serviceWorker" in navigator) {
      try {
        this.serviceWorkerRegistration =
          await navigator.serviceWorker.register("/sw.js");
        console.log("[HttpProxyBridge] Service worker registered");

        // Wait for service worker to be ready
        await navigator.serviceWorker.ready;
        console.log("[HttpProxyBridge] Service worker ready");

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
    console.log(
      "[HttpProxyBridge] setTransport called, transport:",
      transport !== null ? "WebRTC" : "null",
    );
    this.transport = transport;
    this.notifyRemoteMode(transport !== null);
  }

  /**
   * Notify service worker of remote mode state
   */
  private notifyRemoteMode(isRemote: boolean): void {
    console.log(
      "[HttpProxyBridge] Notifying service worker - isRemote:",
      isRemote,
      "controller:",
      !!navigator.serviceWorker?.controller,
    );
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "set-remote-mode",
        data: { isRemote },
      });
      console.log(
        "[HttpProxyBridge] Remote mode message sent to service worker",
      );
    } else {
      console.warn(
        "[HttpProxyBridge] No service worker controller available yet",
      );
    }
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
   * Handle HTTP proxy request from service worker
   */
  private async handleHttpProxyRequest(data: {
    id: string;
    method: string;
    path: string;
    headers: Record<string, string>;
  }): Promise<void> {
    if (!this.transport) {
      console.error(
        "[HttpProxyBridge] No transport available for HTTP proxy request",
      );
      return;
    }

    try {
      // Send request through WebRTC
      const response = await this.transport.sendHttpProxyRequest(
        data.method,
        data.path,
        data.headers,
      );

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
      console.error("[HttpProxyBridge] HTTP proxy request failed:", error);

      // Send error response
      if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "http-proxy-response",
          data: {
            id: data.id,
            status: 500,
            headers: { "Content-Type": "text/plain" },
            body: this.bytesToHex(
              new TextEncoder().encode(
                error instanceof Error ? error.message : "Unknown error",
              ),
            ),
          },
        });
      }
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
