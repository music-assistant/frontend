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

  constructor(options: WebRTCTransportOptions) {
    super();
    this.options = {
      signalingServerUrl: options.signalingServerUrl,
      remoteId: options.remoteId,
      iceServers: options.iceServers || DEFAULT_ICE_SERVERS,
      dataChannelLabel: options.dataChannelLabel || "ma-api",
    };

    this.signaling = new SignalingClient({
      serverUrl: options.signalingServerUrl,
    });

    this.setupSignalingHandlers();
  }

  async connect(): Promise<void> {
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
    } catch (error) {
      console.error("[WebRTCTransport] Connection failed:", error);
      this.setState(TransportState.FAILED);
      this.cleanup();
      throw error;
    }
  }

  disconnect(): void {
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
      this.setState(TransportState.DISCONNECTED);
      this.emit("close", "Data channel closed");
    };

    this.dataChannel.onerror = () => {
      console.error("[WebRTCTransport] Data channel error");
      this.emit("error", new Error("Data channel error"));
    };

    this.dataChannel.onmessage = (event) => {
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
    this.setState(TransportState.DISCONNECTED);
    this.emit("close", "Peer disconnected");
    this.cleanup();
  }

  private handleConnectionFailure(): void {
    this.setState(TransportState.FAILED);
    this.emit("error", new Error("WebRTC connection failed"));
    this.cleanup();
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
  }
}
