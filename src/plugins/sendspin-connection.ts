/**
 * Sendspin Connection
 *
 * Provides Sendspin connections with automatic fallback:
 * 1. If in remote mode, uses the sendspin DataChannel through existing WebRTC
 * 2. Falls back to authenticated proxy WebSocket through the webserver
 */

import api from "@/plugins/api";
import { authManager } from "@/plugins/auth";
import { store } from "@/plugins/store";

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
 * Create a proxy WebSocket connection.
 * In ingress mode, no auth message is needed (HA handles auth via headers).
 * Otherwise, sends auth message with token and client_id.
 */
function createProxyWebSocket(): Promise<WebSocket | null> {
  const url = getSendspinProxyUrl();
  const isIngress = store.isIngressSession;

  return new Promise((resolve) => {
    if (!url) {
      resolve(null);
      return;
    }

    // In non-ingress mode, we need a token
    const token = authManager.getToken();
    if (!isIngress && !token) {
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

    let ready = false;

    ws.onopen = () => {
      if (isIngress) {
        // In ingress mode, no auth message needed - connection is ready immediately
        console.debug("[Sendspin] Proxy WebSocket connected (ingress mode)");
        ready = true;
        resolve(ws);
      } else {
        // Send auth message with token
        const clientId =
          window.localStorage.getItem("sendspin_webplayer_id") || "";
        console.debug("[Sendspin] Sending auth to proxy");
        ws.send(JSON.stringify({ type: "auth", token, client_id: clientId }));
      }
    };

    ws.onmessage = () => {
      if (!ready && !isIngress) {
        ready = true;
        console.debug("[Sendspin] Proxy WebSocket authenticated and ready");
        resolve(ws);
      }
    };

    ws.onerror = (error) => {
      if (!ready) {
        console.error("[Sendspin] Proxy WebSocket error:", error);
        resolve(null);
      }
    };

    ws.onclose = (event) => {
      if (!ready) {
        console.debug(
          "[Sendspin] Proxy WebSocket closed before ready:",
          event.code,
          event.reason,
        );
        resolve(null);
      }
    };

    setTimeout(() => {
      if (!ready) {
        console.debug("[Sendspin] Proxy WebSocket connection timed out");
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
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
  };

  ws.onopen = (event) => {
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
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
  };

  channel.onopen = () => {
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
 * WebSocket-like object that sendspin-js talks to.
 *
 * sendspin-js opens its socket with `new WebSocket(baseUrl + "/sendspin")`, which
 * the interceptor routes here. On the initial connect a bridge is pre-staged by
 * prepareSendspinSession(); on the library's own auto-reconnect no bridge is
 * staged, so this wrapper builds a fresh one on demand. Either way the bridge is
 * attached on a later microtask — after sendspin-js has wired its handlers and
 * armed its reconnect bookkeeping — and a failed build is surfaced as a close so
 * the library's exponential-backoff reconnect keeps running instead of stalling.
 */
class SendspinWebSocketWrapper {
  binaryType: BinaryType = "arraybuffer";

  private bridge: SendspinWebSocketBridge | null = null;
  private closed = false;
  private openFired = false;
  private closeFired = false;
  private sendQueue: (string | ArrayBuffer)[] = [];

  private _onopen: ((event: Event) => void) | null = null;
  private _onmessage: ((event: MessageEvent) => void) | null = null;
  private _onerror: ((event: Event) => void) | null = null;
  private _onclose: ((event: CloseEvent) => void) | null = null;

  constructor(_url: string | URL, _protocols?: string | string[]) {
    const staged = pendingBridge;
    pendingBridge = null;
    if (staged) {
      console.debug("[Sendspin] Interceptor: using pre-staged connection");
    } else {
      console.debug(
        "[Sendspin] Interceptor: no staged connection, building one for reconnect",
      );
    }
    // Defer attach so sendspin-js finishes wiring its on* handlers (and sets
    // shouldReconnect) before any event fires; otherwise the open/close would be
    // delivered to handlers that are not registered yet and the library's
    // reconnect loop would never re-arm.
    const bridgePromise = staged
      ? Promise.resolve(staged)
      : createSendspinConnection();
    bridgePromise
      .then((bridge) => this.attachBridge(bridge))
      .catch((error) => {
        console.error(
          "[Sendspin] Interceptor: failed to build connection:",
          error,
        );
        // Surface as a close so sendspin-js reschedules its next reconnect attempt.
        this.fireClose();
      });
  }

  send(data: string | ArrayBuffer | Blob): void {
    if (data instanceof Blob) {
      data.arrayBuffer().then((buffer) => this.sendRaw(buffer));
    } else {
      this.sendRaw(data);
    }
  }

  close(code?: number, reason?: string): void {
    this.closed = true;
    if (this.bridge) {
      this.bridge.close(code, reason);
    }
    // If a bridge is still being built, attachBridge() closes it on arrival.
  }

  get readyState(): number {
    if (this.bridge) return this.bridge.readyState;
    // No bridge yet: CLOSED once close() was called or a close was delivered
    // (e.g. a failed rebuild), otherwise still CONNECTING.
    return this.closed || this.closeFired ? 3 /* CLOSED */ : 0 /* CONNECTING */;
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

  set onopen(handler: ((event: Event) => void) | null) {
    this._onopen = handler;
  }

  get onopen(): ((event: Event) => void) | null {
    return this._onopen;
  }

  set onmessage(handler: ((event: MessageEvent) => void) | null) {
    this._onmessage = handler;
  }

  get onmessage(): ((event: MessageEvent) => void) | null {
    return this._onmessage;
  }

  set onerror(handler: ((event: Event) => void) | null) {
    this._onerror = handler;
  }

  get onerror(): ((event: Event) => void) | null {
    return this._onerror;
  }

  set onclose(handler: ((event: CloseEvent) => void) | null) {
    this._onclose = handler;
  }

  get onclose(): ((event: CloseEvent) => void) | null {
    return this._onclose;
  }

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
  ): void {
    if (typeof listener !== "function") return;
    if (type === "open") this._onopen = listener as (event: Event) => void;
    else if (type === "message")
      this._onmessage = listener as (event: MessageEvent) => void;
    else if (type === "error")
      this._onerror = listener as (event: Event) => void;
    else if (type === "close")
      this._onclose = listener as (event: CloseEvent) => void;
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

  private sendRaw(data: string | ArrayBuffer): void {
    if (this.closed) return;
    if (this.bridge) {
      this.bridge.send(data);
    } else {
      this.sendQueue.push(data);
    }
  }

  private attachBridge(bridge: SendspinWebSocketBridge): void {
    if (this.closed) {
      // close() was called while the bridge was still being built; discard it.
      console.debug(
        "[Sendspin] Interceptor: connection ready after close(), discarding",
      );
      try {
        bridge.close();
      } catch {
        // Ignore
      }
      return;
    }
    this.bridge = bridge;
    bridge.onopen = () => this.fireOpen();
    bridge.onmessage = (event) => this._onmessage?.call(this, event);
    bridge.onerror = (event) => this._onerror?.call(this, event);
    bridge.onclose = (event) => this.fireClose(event);

    // createSendspinConnection() only resolves once the transport is open; if it
    // closed in the gap before attach, surface that as a close — without flushing
    // queued sends into a dead socket — so the handshake retries on a fresh attempt.
    if (bridge.readyState !== bridge.OPEN) {
      console.debug("[Sendspin] Interceptor: connection closed before attach");
      this.fireClose();
      return;
    }

    // readyState now delegates to the live bridge, so queued sends go through.
    for (const data of this.sendQueue) {
      bridge.send(data);
    }
    this.sendQueue = [];
    this.fireOpen();
  }

  private fireOpen(): void {
    if (this.openFired || this.closeFired || this.closed) return;
    this.openFired = true;
    this._onopen?.call(this, new Event("open"));
  }

  private fireClose(event?: CloseEvent): void {
    if (this.closeFired) return;
    this.closeFired = true;
    this._onclose?.call(this, event ?? new CloseEvent("close"));
  }
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
