/**
 * WebRTC Transport
 *
 * Implements the transport interface using WebRTC DataChannel.
 * Used for remote connections to Music Assistant instances via NAT traversal.
 *
 * Security: Uses DTLS certificate pinning for server authentication.
 */

import { BaseTransport, TransportState } from "./transport";
import { SignalingClient, IceServerConfig } from "./signaling";
import {
  verifyAndSanitizeSdp,
  CertificateVerificationError,
} from "./crypto-utils";

// Re-export for convenience
export type { IceServerConfig };
export { CertificateVerificationError };

export interface WebRTCTransportOptions {
  signalingServerUrl: string;
  /**
   * Remote server ID - encoded fingerprint of the server's DTLS certificate.
   * Used for both routing and authentication.
   */
  remoteId: string;
  dataChannelLabel?: string;
  reconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectDelay?: number;
  reconnectDelayGrowth?: number;
  maxReconnectAttempts?: number;
  /**
   * Skip certificate verification (for development only - INSECURE)
   * Default: false
   */
  skipCertificateVerification?: boolean;
}

// Fallback ICE servers (only public STUN servers - no TURN)
// These will only be used if the server doesn't provide ICE servers
const FALLBACK_ICE_SERVERS: IceServerConfig[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

// A connection must hold this long before its success resets the backoff,
// otherwise a flapping loop (which briefly connects) keeps backoff flat.
const STABLE_CONNECTION_THRESHOLD_MS = 5000;

// Proxied HTTP requests (album art, previews) get their own channel so their large
// payloads don't hold up API messages. Older servers take a label they don't know for
// the API channel itself, so the channel is only opened once the server reports it
// knows this one.
const HTTP_PROXY_CHANNEL_LABEL = "http_proxy";
const HTTP_PROXY_CHANNEL_SCHEMA_VERSION = 49;

export class WebRTCTransport extends BaseTransport {
  private options: Required<WebRTCTransportOptions>;
  private signaling: SignalingClient;
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private httpProxyChannel: RTCDataChannel | null = null;
  // The proxy channel is negotiated at most once per connection.
  private httpProxyChannelRequested = false;
  private iceCandidateBuffer: RTCIceCandidateInit[] = [];
  private remoteDescriptionSet = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stableConnectionTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;
  // Serialises connect(); concurrent negotiation corrupts the shared pc/SDP state.
  private connectInFlight = false;
  private httpProxyCallbacks = new Map<
    string,
    {
      resolve: (value: {
        status: number;
        headers: Record<string, string>;
        body: Uint8Array;
      }) => void;
      reject: (error: Error) => void;
      // requests sent on the proxy channel die with it, unlike those on the API channel
      onProxyChannel: boolean;
    }
  >();
  // Reassembly buffers for oversized messages the server splits into chunks, keyed by group id.
  private chunkGroups = new Map<
    number,
    {
      count: number;
      parts: string[];
      received: number;
    }
  >();
  // Response being reassembled on the proxy channel: its header, then raw body frames.
  private pendingProxyBody: {
    id: string;
    status: number;
    headers: Record<string, string>;
    size: number;
    parts: Uint8Array[];
    received: number;
  } | null = null;
  // ICE servers received from the signaling server (provided by MA server)
  private iceServers: IceServerConfig[] = [];

  constructor(options: WebRTCTransportOptions) {
    super();
    this.options = {
      signalingServerUrl: options.signalingServerUrl,
      remoteId: options.remoteId,
      dataChannelLabel: options.dataChannelLabel || "ma-api",
      reconnect: options.reconnect ?? true,
      reconnectDelay: options.reconnectDelay ?? 1000,
      maxReconnectDelay: options.maxReconnectDelay ?? 30000,
      reconnectDelayGrowth: options.reconnectDelayGrowth ?? 1.5,
      maxReconnectAttempts: options.maxReconnectAttempts ?? Infinity,
      skipCertificateVerification: options.skipCertificateVerification ?? false,
    };

    this.signaling = new SignalingClient({
      serverUrl: options.signalingServerUrl,
    });

    this.setupSignalingHandlers();
  }

  async connect(): Promise<void> {
    // Let the in-flight attempt finish; a concurrent negotiation corrupts pc/SDP state.
    if (this.connectInFlight) {
      return;
    }
    this.connectInFlight = true;
    this.intentionalClose = false;
    this.setState(TransportState.CONNECTING);

    try {
      // Connect to signaling server
      await this.signaling.connect();

      // Request connection - receives ICE servers from MA server
      const { iceServers } = await this.signaling.requestConnection(
        this.options.remoteId,
      );

      this.iceServers = iceServers || FALLBACK_ICE_SERVERS;
      this.createPeerConnection();

      // Create data channel (we're the initiator)
      this.createDataChannel();

      // Create and send offer (triggers ICE gathering)
      const offer = await this.peerConnection!.createOffer();
      await this.peerConnection!.setLocalDescription(offer);
      this.signaling.sendOffer(offer);

      // Wait for connection to be established
      await this.waitForConnection();

      // Reset backoff only once the connection proves stable, not on every connect.
      this.scheduleBackoffReset();
      this.setState(TransportState.CONNECTED);
    } catch (error) {
      console.error("[WebRTCTransport] Connection failed:", error);
      this.cleanup();

      // Only set to FAILED if we're not going to retry
      // During reconnect attempts, keep the RECONNECTING state
      if (this.reconnectAttempts === 0) {
        // This is the initial connection attempt
        this.setState(TransportState.FAILED);
      } else if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
        // Max retries reached
        this.setState(TransportState.FAILED);
      }
      // else: keep RECONNECTING state for next retry

      throw error;
    } finally {
      this.connectInFlight = false;
    }
  }

  disconnect(): void {
    this.intentionalClose = true;
    this.clearReconnectTimer();
    this.cleanup();
    this.setState(TransportState.DISCONNECTED);
    this.emit("close", "Disconnected by user");
  }

  send(data: string): void {
    if (!this.dataChannel || this.dataChannel.readyState !== "open") {
      throw new Error("DataChannel is not open");
    }
    this.dataChannel.send(data);
  }

  private setupSignalingHandlers(): void {
    this.signaling.on("answer", (answer) => {
      this.handleAnswer(answer);
    });

    this.signaling.on("ice-candidate", (candidate) => {
      this.handleIceCandidate(candidate);
    });

    this.signaling.on("peer-disconnected", () => {
      this.handlePeerDisconnected();
    });

    this.signaling.on("error", (error) => {
      console.error("[WebRTCTransport] Signaling error:", error);
      this.emit("error", new Error(error));
    });
  }

  private createPeerConnection(): void {
    this.peerConnection = new RTCPeerConnection({
      iceServers: this.iceServers,
      iceCandidatePoolSize: 4,
    });

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.signaling.sendIceCandidate(event.candidate.toJSON());
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection?.iceConnectionState;
      // `disconnected` is transient and usually self-heals; only act on the
      // terminal `failed` state (the browser escalates `disconnected` to it).
      if (state === "failed") {
        this.handleConnectionFailure();
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      if (state === "failed") {
        this.handleConnectionFailure();
      }
    };
  }

  private createDataChannel(): void {
    this.dataChannel = this.peerConnection!.createDataChannel(
      this.options.dataChannelLabel,
      {
        ordered: true,
      },
    );

    this.setupDataChannelHandlers();
  }

  private setupDataChannelHandlers(): void {
    if (!this.dataChannel) return;

    this.dataChannel.onopen = () => {
      this.setState(TransportState.CONNECTED);
      this.emit("open");
    };

    this.dataChannel.onclose = () => {
      console.log("[WebRTCTransport] Data channel closed");
      if (!this.intentionalClose && this.options.reconnect) {
        this.scheduleReconnect();
      } else {
        this.setState(TransportState.DISCONNECTED);
        this.emit("close", "Data channel closed");
      }
    };

    this.dataChannel.onerror = () => {
      console.error("[WebRTCTransport] Data channel error");
      this.emit("error", new Error("Data channel error"));
    };

    this.attachMessageHandler(this.dataChannel, (data) =>
      this.dispatchMessage(data),
    );
  }

  /**
   * Deliver a channel's incoming messages to a dispatch function.
   *
   * @param channel - Channel to read from.
   * @param dispatch - Receives every whole message from that channel.
   */
  private attachMessageHandler(
    channel: RTCDataChannel,
    dispatch: (data: string) => void,
  ): void {
    channel.onmessage = (event) => {
      // The server splits oversized messages into "__chunk__" frames; reassemble them
      // before dispatching. Everything else is a whole message.
      if (typeof event.data === "string") {
        try {
          const frame = JSON.parse(event.data);
          if (frame.type === "__chunk__") {
            this.handleChunk(frame, dispatch);
            return;
          }
        } catch {
          // not a JSON chunk frame; fall through to normal dispatch
        }
      }
      dispatch(event.data);
    };
  }

  private dispatchMessage(data: string): void {
    // HTTP-proxy responses are consumed here; anything else is a normal API message.
    try {
      const parsed = JSON.parse(data);
      if (parsed.type === "http-proxy-response") {
        this.handleHttpProxyResponse(parsed);
        return;
      }
      // server_info is the first message on this channel and carries the schema version.
      if (typeof parsed.schema_version === "number") {
        this.maybeOpenHttpProxyChannel(parsed.schema_version);
      }
    } catch {
      // not JSON or not an HTTP proxy response
    }
    this.emit("message", data);
  }

  /**
   * Handle a message from the http_proxy channel, which carries each proxy response as a
   * JSON header followed by its body as raw binary frames.
   */
  private handleHttpProxyMessage(data: string | ArrayBuffer): void {
    if (typeof data !== "string") {
      const pending = this.pendingProxyBody;
      if (!pending) return;
      pending.parts.push(new Uint8Array(data));
      pending.received += data.byteLength;
      if (pending.received >= pending.size) this.completeHttpProxyBody();
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(data);
    } catch {
      return; // not JSON; nothing on this channel to dispatch
    }
    // a hex response big enough to be split arrives as chunk frames to reassemble first
    if (parsed.type === "__chunk__") {
      this.handleChunk(parsed, (message) =>
        this.handleHttpProxyMessage(message),
      );
      return;
    }
    if (parsed.type !== "http-proxy-response") return;
    // a response without a body length is the hex-in-JSON form, which a server that
    // predates the binary framing still answers with
    if (typeof parsed.size !== "number") {
      this.handleHttpProxyResponse(parsed);
      return;
    }
    this.pendingProxyBody = {
      id: parsed.id,
      status: parsed.status,
      headers: parsed.headers,
      size: parsed.size,
      parts: [],
      received: 0,
    };
    // an empty body is sent as a header on its own
    if (parsed.size === 0) this.completeHttpProxyBody();
  }

  private completeHttpProxyBody(): void {
    const pending = this.pendingProxyBody;
    if (!pending) return;
    this.pendingProxyBody = null;
    // check for a waiting caller before assembling, which for an image copies real bytes
    const callbacks = this.httpProxyCallbacks.get(pending.id);
    if (!callbacks) return;
    this.httpProxyCallbacks.delete(pending.id);
    const body = new Uint8Array(pending.received);
    let offset = 0;
    for (const part of pending.parts) {
      body.set(part, offset);
      offset += part.byteLength;
    }
    callbacks.resolve({
      status: pending.status,
      headers: pending.headers,
      body: body.subarray(0, pending.size),
    });
  }

  private maybeOpenHttpProxyChannel(schemaVersion: number): void {
    if (
      this.httpProxyChannelRequested ||
      schemaVersion < HTTP_PROXY_CHANNEL_SCHEMA_VERSION
    ) {
      return;
    }
    this.httpProxyChannelRequested = true;
    void this.openHttpProxyChannel();
  }

  private async openHttpProxyChannel(): Promise<void> {
    try {
      const channel = await this.openDataChannel(HTTP_PROXY_CHANNEL_LABEL);
      if (!channel) return;
      if (!this.httpProxyChannelRequested) {
        // the connection this channel was opened for is already torn down
        channel.close();
        return;
      }
      // body frames arrive as raw binary, which must not be surfaced as Blobs
      channel.binaryType = "arraybuffer";
      channel.onmessage = (event) => this.handleHttpProxyMessage(event.data);
      channel.onclose = () => {
        // a body cut off mid-transfer can never be completed, so drop what it left
        this.pendingProxyBody = null;
        if (this.httpProxyChannel === channel) {
          this.httpProxyChannel = null;
        }
        // nothing still in flight here can be answered now, so fail those callers at once
        // rather than leaving each one waiting out its timeout
        for (const [id, callbacks] of this.httpProxyCallbacks) {
          if (!callbacks.onProxyChannel) continue;
          this.httpProxyCallbacks.delete(id);
          callbacks.reject(new Error("http_proxy channel closed"));
        }
      };
      this.httpProxyChannel = channel;
    } catch (error) {
      // proxying over the API channel remains a working fallback
      console.warn(
        "[WebRTCTransport] http_proxy DataChannel unavailable:",
        error,
      );
    }
  }

  private handleChunk(
    frame: {
      id: number;
      seq: number;
      count: number;
      b64: string;
    },
    dispatch: (data: string) => void,
  ): void {
    let pending = this.chunkGroups.get(frame.id);
    if (!pending) {
      pending = {
        count: frame.count,
        parts: Array.from<string>({ length: frame.count }),
        received: 0,
      };
      this.chunkGroups.set(frame.id, pending);
    }
    if (pending.parts[frame.seq] === undefined) {
      pending.received++;
    }
    pending.parts[frame.seq] = frame.b64;
    if (pending.received < pending.count) return;

    this.chunkGroups.delete(frame.id);
    const bytes = this.base64PartsToBytes(pending.parts);
    dispatch(new TextDecoder().decode(bytes));
  }

  private base64PartsToBytes(parts: string[]): Uint8Array {
    const chunks = parts.map((b64) => {
      const binary = atob(b64);
      const arr = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
      return arr;
    });
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      out.set(c, offset);
      offset += c.length;
    }
    return out;
  }

  private async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) return;

    try {
      let sdp = answer.sdp;

      // Verify certificate fingerprint from SDP before setting remote description
      // This happens BEFORE the DTLS handshake, providing early rejection of untrusted peers
      if (!this.options.skipCertificateVerification) {
        sdp = verifyAndSanitizeSdp(answer.sdp, this.options.remoteId);
        console.log("[WebRTCTransport] SDP fingerprint verified");
      }

      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription({ type: answer.type, sdp }),
      );
      this.remoteDescriptionSet = true;

      // Process buffered ICE candidates
      for (const candidate of this.iceCandidateBuffer) {
        await this.peerConnection.addIceCandidate(
          new RTCIceCandidate(candidate),
        );
      }
      this.iceCandidateBuffer = [];
    } catch (error) {
      if (error instanceof CertificateVerificationError) {
        console.error(
          "[WebRTCTransport] Certificate verification failed:",
          error.message,
        );
        this.emit("error", error);
        this.cleanup();
        return;
      }
      console.error(
        "[WebRTCTransport] Error setting remote description:",
        error,
      );
    }
  }

  private async handleIceCandidate(
    candidate: RTCIceCandidateInit,
  ): Promise<void> {
    if (!this.peerConnection) return;

    if (this.remoteDescriptionSet) {
      try {
        await this.peerConnection.addIceCandidate(
          new RTCIceCandidate(candidate),
        );
      } catch (error) {
        console.error("[WebRTCTransport] Error adding ICE candidate:", error);
      }
    } else {
      // Buffer the candidate until remote description is set
      this.iceCandidateBuffer.push(candidate);
    }
  }

  private handlePeerDisconnected(): void {
    console.log("[WebRTCTransport] Peer disconnected");
    if (!this.intentionalClose && this.options.reconnect) {
      this.scheduleReconnect();
    } else {
      this.setState(TransportState.DISCONNECTED);
      this.emit("close", "Peer disconnected");
      this.cleanup();
    }
  }

  private handleConnectionFailure(): void {
    console.log("[WebRTCTransport] Connection failure detected");
    if (!this.intentionalClose && this.options.reconnect) {
      this.scheduleReconnect();
    } else {
      this.setState(TransportState.FAILED);
      this.emit("error", new Error("WebRTC connection failed"));
      this.cleanup();
    }
  }

  private waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Connection timeout"));
      }, 30000);

      const checkConnection = () => {
        if (this.dataChannel?.readyState === "open") {
          clearTimeout(timeout);
          resolve();
        }
      };

      // Check if already connected
      checkConnection();

      // Listen for open event
      const dataChannel = this.dataChannel;
      if (dataChannel) {
        const originalOnOpen = dataChannel.onopen;
        dataChannel.onopen = (event) => {
          clearTimeout(timeout);
          if (originalOnOpen) {
            originalOnOpen.call(dataChannel, event);
          }
          resolve();
        };
      }
    });
  }

  /**
   * Send HTTP proxy request over WebRTC data channel
   *
   * :param method: HTTP method (GET, POST, etc.)
   * :param path: Request path including query string
   * :param headers: Request headers
   */
  async sendHttpProxyRequest(
    method: string,
    path: string,
    headers: Record<string, string> = {},
  ): Promise<{
    status: number;
    headers: Record<string, string>;
    body: Uint8Array;
  }> {
    // Falls back to the API channel when the server has no dedicated proxy channel.
    const channel =
      this.httpProxyChannel?.readyState === "open"
        ? this.httpProxyChannel
        : this.dataChannel;
    if (!channel || channel.readyState !== "open") {
      throw new Error("DataChannel is not open");
    }

    // Generate unique request ID
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    // Create promise for response
    const responsePromise = new Promise<{
      status: number;
      headers: Record<string, string>;
      body: Uint8Array;
    }>((resolve, reject) => {
      // Store callbacks
      this.httpProxyCallbacks.set(requestId, {
        resolve,
        reject,
        onProxyChannel: channel === this.httpProxyChannel,
      });

      // Set timeout
      setTimeout(() => {
        if (this.httpProxyCallbacks.has(requestId)) {
          this.httpProxyCallbacks.delete(requestId);
          // stop buffering frames nothing is waiting for any more
          if (this.pendingProxyBody?.id === requestId) {
            this.pendingProxyBody = null;
          }
          reject(new Error("HTTP proxy request timeout"));
        }
      }, 30000);
    });

    // Send request
    const request = {
      type: "http-proxy-request",
      id: requestId,
      method,
      path,
      headers,
    };

    channel.send(JSON.stringify(request));

    return responsePromise;
  }

  /**
   * Handle HTTP proxy response from server
   */
  private handleHttpProxyResponse(data: {
    id: string;
    status: number;
    headers: Record<string, string>;
    body: string;
  }): void {
    const { id, status, headers, body } = data;

    const callbacks = this.httpProxyCallbacks.get(id);
    if (callbacks) {
      this.httpProxyCallbacks.delete(id);

      try {
        // Convert hex string to Uint8Array
        const bodyBytes = this.hexToBytes(body);

        callbacks.resolve({
          status,
          headers,
          body: bodyBytes,
        });
      } catch (error) {
        callbacks.reject(
          error instanceof Error
            ? error
            : new Error("Failed to parse response"),
        );
      }
    }
  }

  /**
   * Convert hex string to Uint8Array
   */
  private hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
  }

  private scheduleReconnect(): void {
    // Connection is down; cancel any pending backoff reset before we bail or retry.
    this.clearStableConnectionTimer();

    // One reconnect at a time: bail if a timer is pending or a connect is in flight.
    if (this.reconnectTimer || this.connectInFlight) {
      return;
    }

    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      console.error(
        "[WebRTCTransport] Max reconnect attempts reached, giving up",
      );
      this.setState(TransportState.FAILED);
      return;
    }

    this.setState(TransportState.RECONNECTING);
    this.emit("close", "Connection lost, reconnecting...");

    const backoff = Math.min(
      this.options.reconnectDelay *
        Math.pow(this.options.reconnectDelayGrowth, this.reconnectAttempts),
      this.options.maxReconnectDelay,
    );
    // Jitter so reconnects don't line up at fixed intervals.
    const delay = Math.round(backoff * (0.5 + Math.random() * 0.5));

    console.log(
      `[WebRTCTransport] Scheduling reconnect attempt ${this.reconnectAttempts + 1} in ${delay}ms`,
    );

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      this.reconnectAttempts++;
      // Clean up old connection first
      this.cleanup();
      // Attempt reconnection
      try {
        await this.connect();
      } catch (error) {
        console.error("[WebRTCTransport] Reconnect attempt failed:", error);
        // Schedule another reconnect attempt
        if (!this.intentionalClose && this.options.reconnect) {
          this.scheduleReconnect();
        }
      }
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private scheduleBackoffReset(): void {
    this.clearStableConnectionTimer();
    this.stableConnectionTimer = setTimeout(() => {
      this.reconnectAttempts = 0;
      this.stableConnectionTimer = null;
    }, STABLE_CONNECTION_THRESHOLD_MS);
  }

  private clearStableConnectionTimer(): void {
    if (this.stableConnectionTimer) {
      clearTimeout(this.stableConnectionTimer);
      this.stableConnectionTimer = null;
    }
  }

  private cleanup(): void {
    // Cancel the pending backoff reset so it can't fire after teardown.
    this.clearStableConnectionTimer();

    if (this.dataChannel) {
      // Detach first so our own close doesn't fire onclose -> scheduleReconnect (the loop).
      this.dataChannel.onopen = null;
      this.dataChannel.onclose = null;
      this.dataChannel.onerror = null;
      this.dataChannel.onmessage = null;
      this.dataChannel.close();
      this.dataChannel = null;
    }

    if (this.httpProxyChannel) {
      this.httpProxyChannel.onopen = null;
      this.httpProxyChannel.onclose = null;
      this.httpProxyChannel.onerror = null;
      this.httpProxyChannel.onmessage = null;
      this.httpProxyChannel.close();
      this.httpProxyChannel = null;
    }
    this.httpProxyChannelRequested = false;

    if (this.peerConnection) {
      // Detach first so close doesn't re-enter handleConnectionFailure().
      this.peerConnection.onicecandidate = null;
      this.peerConnection.oniceconnectionstatechange = null;
      this.peerConnection.onconnectionstatechange = null;
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.signaling.disconnect();
    this.remoteDescriptionSet = false;
    this.iceCandidateBuffer = [];

    // Clear pending HTTP proxy requests
    for (const [, callbacks] of this.httpProxyCallbacks.entries()) {
      callbacks.reject(new Error("Transport closed"));
    }
    this.httpProxyCallbacks.clear();
    this.chunkGroups.clear();
    this.pendingProxyBody = null;
  }

  /**
   * Open an additional DataChannel alongside the API one, so a feature can use
   * the existing WebRTC connection for its own stream.
   *
   * @param label - Channel label the server routes on, e.g. "sendspin".
   */
  async openDataChannel(label: string): Promise<RTCDataChannel | null> {
    if (!this.peerConnection) {
      console.warn(
        `[WebRTCTransport] Cannot create ${label} channel: no peer connection`,
      );
      return null;
    }

    if (
      this.peerConnection.connectionState !== "connected" &&
      this.peerConnection.connectionState !== "connecting"
    ) {
      console.warn(
        `[WebRTCTransport] Cannot create ${label} channel: connection state is`,
        this.peerConnection.connectionState,
      );
      return null;
    }

    console.debug(`[WebRTCTransport] Creating ${label} DataChannel`);

    // Ordered for TCP-like behavior
    const channel = this.peerConnection.createDataChannel(label, {
      ordered: true,
    });

    // Wait for the channel to open
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.warn(`[WebRTCTransport] ${label} DataChannel open timeout`);
        reject(new Error(`${label} DataChannel open timeout`));
      }, 10000);

      channel.onopen = () => {
        clearTimeout(timeout);
        console.debug(`[WebRTCTransport] ${label} DataChannel opened`);
        resolve(channel);
      };

      channel.onerror = (event) => {
        clearTimeout(timeout);
        console.error(`[WebRTCTransport] ${label} DataChannel error:`, event);
        reject(new Error(`${label} DataChannel error`));
      };

      // If channel is already open (unlikely but possible), resolve immediately
      if (channel.readyState === "open") {
        clearTimeout(timeout);
        resolve(channel);
      }
    });
  }
}
