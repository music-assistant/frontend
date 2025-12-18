/**
 * Sendspin Connection
 *
 * Provides Sendspin connections with automatic fallback:
 * 1. If in remote mode, uses the sendspin DataChannel through existing WebRTC
 * 2. Falls back to authenticated proxy WebSocket through the webserver
 */

import api from "@/plugins/api";
import { authManager } from "@/plugins/auth";

const OriginalWebSocket = window.WebSocket;

/**
 * Build the WebSocket URL for the sendspin proxy endpoint.
 */
function getSendspinProxyUrl(): string {
  const baseUrl = api.baseUrl;
  if (!baseUrl) return "";
  const wsScheme = baseUrl.startsWith("https") ? "wss" : "ws";
  const urlWithoutScheme = baseUrl.replace(/^https?:\/\//, "");
  return `${wsScheme}://${urlWithoutScheme}/sendspin`;
}

/**
 * Create an authenticated proxy WebSocket connection.
 * Includes client_id in auth message for auto-whitelist.
 */
function createProxyWebSocket(): Promise<WebSocket | null> {
  const url = getSendspinProxyUrl();
  return new Promise((resolve) => {
    if (!url) {
      resolve(null);
      return;
    }

    const token = authManager.getToken();
    if (!token) {
      console.error("[Sendspin] No auth token available for proxy connection");
      resolve(null);
      return;
    }

    console.debug("[Sendspin] Connecting to proxy WebSocket:", url);

    let ws: WebSocket;
    try {
      ws = new OriginalWebSocket(url);
    } catch (error) {
      console.error("[Sendspin] Failed to create proxy WebSocket:", error);
      resolve(null);
      return;
    }

    let authenticated = false;

    ws.onopen = () => {
      const clientId =
        window.localStorage.getItem("sendspin_webplayer_id") || "";
      console.debug("[Sendspin] Sending auth to proxy");
      ws.send(JSON.stringify({ type: "auth", token, client_id: clientId }));
    };

    ws.onmessage = () => {
      if (!authenticated) {
        authenticated = true;
        console.debug("[Sendspin] Proxy WebSocket authenticated and ready");
        resolve(ws);
      }
    };

    ws.onerror = (error) => {
      if (!authenticated) {
        console.error("[Sendspin] Proxy WebSocket error:", error);
        resolve(null);
      }
    };

    ws.onclose = (event) => {
      if (!authenticated) {
        console.debug(
          "[Sendspin] Proxy WebSocket closed before auth:",
          event.code,
          event.reason,
        );
        resolve(null);
      }
    };

    setTimeout(() => {
      if (!authenticated) {
        console.debug("[Sendspin] Proxy WebSocket auth timed out");
        ws.close();
        resolve(null);
      }
    }, 10000);
  });
}

/**
 * WebSocket-like interface for sendspin-js compatibility.
 */
export interface SendspinWebSocketBridge {
  send: (data: string | ArrayBuffer) => void;
  close: (code?: number, reason?: string) => void;
  readonly readyState: number;
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  _isOpen: boolean; // For late handler registration
  readonly CONNECTING: 0;
  readonly OPEN: 1;
  readonly CLOSING: 2;
  readonly CLOSED: 3;
}

function wrapWebSocket(ws: WebSocket): SendspinWebSocketBridge {
  const bridge: SendspinWebSocketBridge = {
    send: (data: string | ArrayBuffer) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    },
    close: (code?: number, reason?: string) => {
      ws.close(code, reason);
    },
    get readyState() {
      return ws.readyState;
    },
    onopen: null,
    onmessage: null,
    onerror: null,
    onclose: null,
    _isOpen: ws.readyState === WebSocket.OPEN,
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
  };

  ws.onopen = (event) => {
    bridge._isOpen = true;
    if (bridge.onopen) bridge.onopen(event);
  };
  ws.onmessage = (event) => {
    if (bridge.onmessage) bridge.onmessage(event);
  };
  ws.onerror = (event) => {
    if (bridge.onerror) bridge.onerror(event);
  };
  ws.onclose = (event) => {
    if (bridge.onclose) bridge.onclose(event);
  };

  return bridge;
}

/**
 * Wraps an RTCDataChannel to match the SendspinWebSocketBridge interface.
 */
function wrapDataChannel(channel: RTCDataChannel): SendspinWebSocketBridge {
  const bridge: SendspinWebSocketBridge = {
    send: (data: string | ArrayBuffer) => {
      if (channel.readyState === "open") {
        if (typeof data === "string") {
          channel.send(data);
        } else {
          channel.send(data);
        }
      }
    },
    close: (_code?: number, _reason?: string) => {
      channel.close();
    },
    get readyState() {
      switch (channel.readyState) {
        case "connecting":
          return 0;
        case "open":
          return 1;
        case "closing":
          return 2;
        case "closed":
        default:
          return 3;
      }
    },
    onopen: null,
    onmessage: null,
    onerror: null,
    onclose: null,
    _isOpen: channel.readyState === "open",
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
  };

  channel.onopen = () => {
    bridge._isOpen = true;
    if (bridge.onopen) bridge.onopen(new Event("open"));
  };
  channel.onmessage = (event) => {
    if (bridge.onmessage) bridge.onmessage(event);
  };
  channel.onerror = () => {
    if (bridge.onerror) bridge.onerror(new Event("error"));
  };
  channel.onclose = () => {
    if (bridge.onclose) bridge.onclose(new CloseEvent("close"));
  };

  return bridge;
}

let pendingBridge: SendspinWebSocketBridge | null = null;
let _isDirectConnection = false;

/**
 * Returns true if the current sendspin connection is direct (proxy WebSocket),
 * false if it's through remote access (DataChannel).
 */
export function isDirectConnection(): boolean {
  return _isDirectConnection;
}

/**
 * Reset the connection state when API connection is lost.
 */
export function resetSendspinConnection(): void {
  console.debug("[SendspinConnection] Resetting connection state");
  if (pendingBridge) {
    try {
      pendingBridge.close();
    } catch {
      // Ignore
    }
    pendingBridge = null;
  }
  _isDirectConnection = false;
}

/**
 * Creates a Sendspin connection.
 * Priority: 1) DataChannel (remote mode), 2) Proxy WebSocket
 */
export async function createSendspinConnection(): Promise<SendspinWebSocketBridge> {
  console.debug("[Sendspin] Creating connection...");

  if (api.isRemoteConnection.value) {
    console.debug("[Sendspin] In remote mode, trying DataChannel...");
    const channel = await api.createSendspinDataChannel();
    if (channel) {
      console.info("[Sendspin] Using remote access DataChannel");
      _isDirectConnection = false;
      return wrapDataChannel(channel);
    }
  }

  console.debug("[Sendspin] Trying proxy WebSocket...");
  const proxyWs = await createProxyWebSocket();
  if (proxyWs) {
    console.info("[Sendspin] Using proxy WebSocket connection");
    _isDirectConnection = true;
    return wrapWebSocket(proxyWs);
  }

  throw new Error("Failed to establish Sendspin connection");
}

/**
 * WebSocket wrapper for sendspin-js compatibility.
 */
class SendspinWebSocketWrapper {
  private bridge: SendspinWebSocketBridge;

  constructor(_url: string | URL, _protocols?: string | string[]) {
    if (!pendingBridge) {
      throw new Error(
        "SendspinWebSocketWrapper: No pending bridge. Call prepareSendspinSession first.",
      );
    }
    this.bridge = pendingBridge;
    pendingBridge = null;
  }

  send(data: string | ArrayBuffer | Blob): void {
    if (data instanceof Blob) {
      data.arrayBuffer().then((buffer) => this.bridge.send(buffer));
    } else {
      this.bridge.send(data);
    }
  }

  close(code?: number, reason?: string): void {
    this.bridge.close(code, reason);
  }

  get readyState(): number {
    return this.bridge.readyState;
  }

  get binaryType(): BinaryType {
    return "arraybuffer";
  }

  set binaryType(_value: BinaryType) {
    // No-op
  }

  get bufferedAmount(): number {
    return 0;
  }

  get extensions(): string {
    return "";
  }

  get protocol(): string {
    return "";
  }

  get url(): string {
    return "";
  }

  set onopen(handler: ((this: WebSocket, ev: Event) => void) | null) {
    this.bridge.onopen = handler;
    if (handler && this.bridge._isOpen) {
      setTimeout(
        () => handler.call(this as unknown as WebSocket, new Event("open")),
        0,
      );
    }
  }

  get onopen(): ((this: WebSocket, ev: Event) => void) | null {
    return this.bridge.onopen;
  }

  set onmessage(handler: ((this: WebSocket, ev: MessageEvent) => void) | null) {
    this.bridge.onmessage = handler;
  }

  get onmessage(): ((this: WebSocket, ev: MessageEvent) => void) | null {
    return this.bridge.onmessage;
  }

  set onerror(handler: ((this: WebSocket, ev: Event) => void) | null) {
    this.bridge.onerror = handler;
  }

  get onerror(): ((this: WebSocket, ev: Event) => void) | null {
    return this.bridge.onerror;
  }

  set onclose(handler: ((this: WebSocket, ev: CloseEvent) => void) | null) {
    this.bridge.onclose = handler;
  }

  get onclose(): ((this: WebSocket, ev: CloseEvent) => void) | null {
    return this.bridge.onclose;
  }

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
  ): void {
    if (type === "open" && typeof listener === "function") {
      this.bridge.onopen = listener as (event: Event) => void;
      if (this.bridge._isOpen) {
        setTimeout(
          () => (listener as (event: Event) => void)(new Event("open")),
          0,
        );
      }
    } else if (type === "message" && typeof listener === "function") {
      this.bridge.onmessage = listener as (event: MessageEvent) => void;
    } else if (type === "error" && typeof listener === "function") {
      this.bridge.onerror = listener as (event: Event) => void;
    } else if (type === "close" && typeof listener === "function") {
      this.bridge.onclose = listener as (event: CloseEvent) => void;
    }
  }

  removeEventListener(
    _type: string,
    _listener: EventListenerOrEventListenerObject,
  ): void {
    // No-op
  }

  dispatchEvent(_event: Event): boolean {
    return false;
  }

  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
}

let interceptorInstalled = false;

/**
 * Install WebSocket interceptor for /sendspin URLs. Call once at app startup.
 */
export function installSendspinInterceptor(): void {
  if (interceptorInstalled) return;

  (window as unknown as { WebSocket: unknown }).WebSocket = function (
    url: string | URL,
    protocols?: string | string[],
  ) {
    const urlStr = url.toString();
    if (urlStr.includes("/sendspin")) {
      console.debug("[SendspinInterceptor] Intercepting WebSocket to:", urlStr);
      return new SendspinWebSocketWrapper(url, protocols);
    }
    return new OriginalWebSocket(url, protocols);
  } as unknown as typeof WebSocket;

  (window.WebSocket as unknown as { CONNECTING: number }).CONNECTING =
    OriginalWebSocket.CONNECTING;
  (window.WebSocket as unknown as { OPEN: number }).OPEN =
    OriginalWebSocket.OPEN;
  (window.WebSocket as unknown as { CLOSING: number }).CLOSING =
    OriginalWebSocket.CLOSING;
  (window.WebSocket as unknown as { CLOSED: number }).CLOSED =
    OriginalWebSocket.CLOSED;

  interceptorInstalled = true;
  console.info("[SendspinInterceptor] Installed");
}

/**
 * Prepare a session before creating a SendspinPlayer.
 */
export async function prepareSendspinSession(): Promise<void> {
  console.debug("[SendspinConnection] Creating session...");
  pendingBridge = await createSendspinConnection();
  console.debug("[SendspinConnection] Session ready");
}
