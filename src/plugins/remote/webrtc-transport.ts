/**
 * WebRTC Transport
 *
 * Implements the transport interface using WebRTC DataChannel.
 * Used for remote connections to Music Assistant instances via NAT traversal.
 */

import { BaseTransport, TransportState } from "./transport";
import { SignalingClient } from "./signaling";

// ICE server configuration
// Using public STUN servers and optionally TURN servers
export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface WebRTCTransportOptions {
  signalingServerUrl: string;
  remoteId: string;
  iceServers?: IceServerConfig[];
  dataChannelLabel?: string;
  reconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectDelay?: number;
  reconnectDelayGrowth?: number;
  maxReconnectAttempts?: number;
}

// Default ICE servers (public STUN servers)
const DEFAULT_ICE_SERVERS: IceServerConfig[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

export class WebRTCTransport extends BaseTransport {
  private options: Required<WebRTCTransportOptions>;
  private signaling: SignalingClient;
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private iceCandidateBuffer: RTCIceCandidateInit[] = [];
  private remoteDescriptionSet = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;
  private httpProxyCallbacks = new Map<
    string,
    { resolve: (value: any) => void; reject: (error: Error) => void }
  >();

  constructor(options: WebRTCTransportOptions) {
    super();
    this.options = {
      signalingServerUrl: options.signalingServerUrl,
      remoteId: options.remoteId,
      iceServers: options.iceServers || DEFAULT_ICE_SERVERS,
      dataChannelLabel: options.dataChannelLabel || "ma-api",
      reconnect: options.reconnect ?? true,
      reconnectDelay: options.reconnectDelay ?? 1000,
      maxReconnectDelay: options.maxReconnectDelay ?? 30000,
      reconnectDelayGrowth: options.reconnectDelayGrowth ?? 1.5,
      maxReconnectAttempts: options.maxReconnectAttempts ?? Infinity,
    };

    this.signaling = new SignalingClient({
      serverUrl: options.signalingServerUrl,
    });

    this.setupSignalingHandlers();
  }

  async connect(): Promise<void> {
    this.intentionalClose = false;
    this.setState(TransportState.CONNECTING);

    try {
      // Create peer connection early (can pre-gather ICE candidates)
      this.createPeerConnection();

      // Connect to signaling server
      await this.signaling.connect();

      // Request connection to the remote MA instance
      await this.signaling.requestConnection(this.options.remoteId);

      // Create data channel (we're the initiator)
      this.createDataChannel();

      // Create and send offer (triggers ICE gathering)
      const offer = await this.peerConnection!.createOffer();
      await this.peerConnection!.setLocalDescription(offer);
      this.signaling.sendOffer(offer);

      // Wait for connection to be established
      await this.waitForConnection();

      // Reset reconnect attempts on successful connection
      this.reconnectAttempts = 0;
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
      iceServers: this.options.iceServers,
      iceCandidatePoolSize: 4,
    });

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.signaling.sendIceCandidate(event.candidate.toJSON());
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection?.iceConnectionState;
      if (state === "failed" || state === "disconnected") {
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

    this.dataChannel.onmessage = (event) => {
      // Check if this is an HTTP proxy response
      try {
        const data = JSON.parse(event.data);
        if (data.type === "http-proxy-response") {
          this.handleHttpProxyResponse(data);
          return;
        }
      } catch {
        // Not JSON or not HTTP proxy response, treat as normal message
      }

      this.emit("message", event.data);
    };
  }

  private async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) return;

    try {
      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription(answer),
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
    if (!this.dataChannel || this.dataChannel.readyState !== "open") {
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
      this.httpProxyCallbacks.set(requestId, { resolve, reject });

      // Set timeout
      setTimeout(() => {
        if (this.httpProxyCallbacks.has(requestId)) {
          this.httpProxyCallbacks.delete(requestId);
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

    this.dataChannel.send(JSON.stringify(request));

    return responsePromise;
  }

  /**
   * Handle HTTP proxy response from server
   */
  private handleHttpProxyResponse(data: any): void {
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
    // Prevent duplicate reconnect schedules
    if (this._state === TransportState.RECONNECTING && this.reconnectTimer) {
      console.log("[WebRTCTransport] Reconnect already scheduled, ignoring");
      return;
    }

    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      console.error(
        "[WebRTCTransport] Max reconnect attempts reached, giving up",
      );
      this.setState(TransportState.FAILED);
      return;
    }

    this.clearReconnectTimer();
    this.setState(TransportState.RECONNECTING);
    this.emit("close", "Connection lost, reconnecting...");

    const delay = Math.min(
      this.options.reconnectDelay *
        Math.pow(this.options.reconnectDelayGrowth, this.reconnectAttempts),
      this.options.maxReconnectDelay,
    );

    console.log(
      `[WebRTCTransport] Scheduling reconnect attempt ${this.reconnectAttempts + 1} in ${delay}ms`,
    );

    this.reconnectTimer = setTimeout(async () => {
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

  private cleanup(): void {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    if (this.peerConnection) {
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
  }
}
