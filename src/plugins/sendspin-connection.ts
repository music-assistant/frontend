/**
 * Sendspin WebRTC Connection
 *
 * Provides WebRTC-based Sendspin connections that work for all connection modes.
 * Uses the MA API for WebRTC signaling (no external signaling server needed).
 *
 * Flow:
 * 1. Frontend creates RTCPeerConnection and DataChannel
 * 2. Frontend sends WebRTC offer via "sendspin/connect" API command
 * 3. Server creates its own RTCPeerConnection and returns answer
 * 4. ICE candidates exchanged via "sendspin/ice" API command
 * 5. DataChannel established for Sendspin protocol messages
 */

import api from "@/plugins/api";

// Default ICE servers (public STUN servers) - used as fallback
const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
  { urls: "stun:stun.home-assistant.io:3478" },
];

// Cache for ICE servers to avoid repeated API calls
let cachedIceServers: RTCIceServer[] | null = null;
let iceServersCacheTime = 0;
const ICE_SERVERS_CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch ICE servers from the MA server.
 * Uses HA Cloud TURN servers if available, otherwise falls back to public STUN servers.
 */
async function getIceServers(): Promise<RTCIceServer[]> {
  // Check cache
  if (
    cachedIceServers &&
    Date.now() - iceServersCacheTime < ICE_SERVERS_CACHE_DURATION_MS
  ) {
    return cachedIceServers;
  }

  try {
    const servers = await api.sendCommand<{ urls: string | string[] }[]>(
      "sendspin/ice_servers",
    );
    if (servers && servers.length > 0) {
      cachedIceServers = servers;
      iceServersCacheTime = Date.now();
      console.log("[SendspinWebRTC] Using ICE servers from server:", servers);
      return servers;
    }
  } catch (error) {
    console.warn(
      "[SendspinWebRTC] Failed to fetch ICE servers from server, using defaults:",
      error,
    );
  }

  // Fallback to default STUN servers
  return DEFAULT_ICE_SERVERS;
}

/**
 * WebSocket-like interface for Sendspin over WebRTC DataChannel
 * This allows sendspin-js to use a DataChannel as if it were a WebSocket
 */
export interface SendspinWebSocketBridge {
  send: (data: string | ArrayBuffer) => void;
  close: (code?: number, reason?: string) => void;
  readonly readyState: number;
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  // Track if already opened (for late handler registration)
  _isOpen: boolean;
  // WebSocket constants
  readonly CONNECTING: 0;
  readonly OPEN: 1;
  readonly CLOSING: 2;
  readonly CLOSED: 3;
}

/**
 * Creates a WebRTC connection to the Sendspin server via MA API signaling.
 * Returns a WebSocket-like interface that sendspin-js can use.
 */
export async function createSendspinConnection(): Promise<SendspinWebSocketBridge> {
  console.log("[SendspinWebRTC] Creating connection...");

  // Fetch ICE servers from server (may include HA Cloud TURN servers)
  const iceServers = await getIceServers();

  const peerConnection = new RTCPeerConnection({
    iceServers: iceServers,
  });

  // Create DataChannel (ordered and reliable for TCP-like behavior)
  const dataChannel = peerConnection.createDataChannel("sendspin", {
    ordered: true,
  });

  // Track session ID for cleanup
  let sessionId: string | null = null;

  // Create the WebSocket-like bridge
  const bridge: SendspinWebSocketBridge = {
    send: (data: string | ArrayBuffer) => {
      if (dataChannel.readyState === "open") {
        if (typeof data === "string") {
          dataChannel.send(data);
        } else {
          dataChannel.send(data);
        }
      }
    },
    close: (_code?: number, _reason?: string) => {
      // Disconnect from server
      if (sessionId) {
        api
          .sendCommand("sendspin/disconnect", { session_id: sessionId })
          .catch(() => {});
      }
      dataChannel.close();
      peerConnection.close();
      if (bridge.onclose) {
        bridge.onclose(new CloseEvent("close"));
      }
    },
    get readyState() {
      // Map DataChannel readyState to WebSocket readyState
      switch (dataChannel.readyState) {
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
    _isOpen: false,
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
  };

  // Handle DataChannel events
  dataChannel.onopen = () => {
    console.log("[SendspinWebRTC] DataChannel opened");
    bridge._isOpen = true;
    if (bridge.onopen) {
      bridge.onopen(new Event("open"));
    }
  };

  dataChannel.onmessage = (event) => {
    if (bridge.onmessage) {
      bridge.onmessage(event);
    }
  };

  dataChannel.onerror = () => {
    console.error("[SendspinWebRTC] DataChannel error");
    if (bridge.onerror) {
      bridge.onerror(new Event("error"));
    }
  };

  dataChannel.onclose = () => {
    console.log("[SendspinWebRTC] DataChannel closed");
    if (bridge.onclose) {
      bridge.onclose(new CloseEvent("close"));
    }
  };

  // Collect ICE candidates to send to server
  const iceCandidates: RTCIceCandidateInit[] = [];
  let iceGatheringComplete = false;

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      iceCandidates.push({
        candidate: event.candidate.candidate,
        sdpMid: event.candidate.sdpMid,
        sdpMLineIndex: event.candidate.sdpMLineIndex,
      });
    }
  };

  peerConnection.onicegatheringstatechange = () => {
    if (peerConnection.iceGatheringState === "complete") {
      iceGatheringComplete = true;
    }
  };

  // Create offer
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  // Wait a bit for ICE gathering
  await new Promise<void>((resolve) => {
    const checkGathering = () => {
      if (iceGatheringComplete || iceCandidates.length > 0) {
        resolve();
      } else {
        setTimeout(checkGathering, 50);
      }
    };
    // Start checking after a short delay
    setTimeout(checkGathering, 100);
    // Timeout after 2 seconds regardless
    setTimeout(resolve, 2000);
  });

  console.log(
    "[SendspinWebRTC] Sending offer to server with",
    iceCandidates.length,
    "ICE candidates",
  );

  // Get the client_id from localStorage to pass to server for auto-whitelisting
  const clientId = window.localStorage.getItem("sendspin_webplayer_id");

  // Send offer to server via API
  const response = await api.sendCommand<{
    session_id: string;
    answer: { sdp: string; type: RTCSdpType };
    ice_candidates: RTCIceCandidateInit[];
  }>("sendspin/connect", {
    offer: {
      sdp: peerConnection.localDescription!.sdp,
      type: peerConnection.localDescription!.type,
    },
    client_id: clientId,
  });

  sessionId = response.session_id;
  console.log("[SendspinWebRTC] Received answer, session:", sessionId);

  // Set remote description (answer from server)
  await peerConnection.setRemoteDescription(
    new RTCSessionDescription(response.answer),
  );

  // Add server's ICE candidates
  for (const candidate of response.ice_candidates) {
    if (candidate.candidate) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  // Send our ICE candidates to server
  for (const candidate of iceCandidates) {
    await api.sendCommand("sendspin/ice", {
      session_id: sessionId,
      candidate: candidate,
    });
  }

  // Continue sending any new ICE candidates
  peerConnection.onicecandidate = async (event) => {
    if (event.candidate && sessionId) {
      await api.sendCommand("sendspin/ice", {
        session_id: sessionId,
        candidate: {
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
        },
      });
    }
  };

  console.log("[SendspinWebRTC] Connection setup complete");
  return bridge;
}

// Store the original WebSocket constructor
const OriginalWebSocket = window.WebSocket;

// Track if we've installed the interceptor
let interceptorInstalled = false;

// Pending WebRTC bridge for next connection
let pendingBridge: SendspinWebSocketBridge | null = null;

/**
 * Wrapper class that makes our WebRTC bridge look like a WebSocket
 * This is needed because sendspin-js expects a WebSocket-like constructor
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
      // Convert Blob to ArrayBuffer
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
    // DataChannel always uses arraybuffer
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
    // If the channel is already open, call the handler immediately
    if (handler && this.bridge._isOpen) {
      console.log(
        "[SendspinWebSocketWrapper] Channel already open, calling onopen handler",
      );
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
    // Simplified implementation
    if (type === "open" && typeof listener === "function") {
      this.bridge.onopen = listener as (event: Event) => void;
      // If the channel is already open, call the handler immediately
      if (this.bridge._isOpen) {
        console.log(
          "[SendspinWebSocketWrapper] Channel already open, calling open listener",
        );
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
    // Simplified - just clear the handler
  }

  dispatchEvent(_event: Event): boolean {
    return false;
  }

  // Static constants
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
}

/**
 * Install the WebSocket interceptor for /sendspin URLs
 * This should be called once at app startup
 */
export function installSendspinInterceptor(): void {
  if (interceptorInstalled) return;

  // Replace global WebSocket
  (window as unknown as { WebSocket: unknown }).WebSocket = function (
    url: string | URL,
    protocols?: string | string[],
  ) {
    const urlStr = url.toString();

    // Only intercept /sendspin URLs
    if (urlStr.includes("/sendspin")) {
      console.log("[SendspinInterceptor] Intercepting WebSocket to:", urlStr);
      return new SendspinWebSocketWrapper(url, protocols);
    }

    // Use original WebSocket for other URLs
    return new OriginalWebSocket(url, protocols);
  } as unknown as typeof WebSocket;

  // Copy static properties
  (window.WebSocket as unknown as { CONNECTING: number }).CONNECTING =
    OriginalWebSocket.CONNECTING;
  (window.WebSocket as unknown as { OPEN: number }).OPEN =
    OriginalWebSocket.OPEN;
  (window.WebSocket as unknown as { CLOSING: number }).CLOSING =
    OriginalWebSocket.CLOSING;
  (window.WebSocket as unknown as { CLOSED: number }).CLOSED =
    OriginalWebSocket.CLOSED;

  interceptorInstalled = true;
  console.log("[SendspinInterceptor] Installed");
}

/**
 * Prepare a WebRTC session for the next Sendspin connection
 * This must be called before creating a SendspinPlayer
 */
export async function prepareSendspinSession(): Promise<void> {
  console.log("[SendspinConnection] Creating WebRTC session...");
  pendingBridge = await createSendspinConnection();
  console.log("[SendspinConnection] WebRTC session ready");
}
