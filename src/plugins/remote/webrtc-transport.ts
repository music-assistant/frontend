/**
 * WebRTC Transport
 *
 * Implements the transport interface using WebRTC DataChannel.
 * Used for remote connections to Music Assistant instances via NAT traversal.
 */

import { BaseTransport, TransportState } from './transport';
import { SignalingClient, SignalingState } from './signaling';

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
  // Google's public STUN servers
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  // Cloudflare's public STUN server
  { urls: 'stun:stun.cloudflare.com:3478' },
  // Home Assistant's STUN server (if available)
  { urls: 'stun:stun.home-assistant.io:3478' },
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
      dataChannelLabel: options.dataChannelLabel || 'ma-api',
    };

    this.signaling = new SignalingClient({
      serverUrl: options.signalingServerUrl,
    });

    this.setupSignalingHandlers();
  }

  async connect(): Promise<void> {
    console.log('[WebRTCTransport] Starting connection to:', this.options.remoteId);
    this.setState(TransportState.CONNECTING);

    try {
      // Connect to signaling server
      await this.signaling.connect();

      // Request connection to the remote MA instance
      console.log('[WebRTCTransport] Requesting connection via signaling server');
      await this.signaling.requestConnection(this.options.remoteId);

      // Create peer connection
      this.createPeerConnection();

      // Create data channel (we're the initiator)
      this.createDataChannel();

      // Create and send offer
      const offer = await this.peerConnection!.createOffer();
      await this.peerConnection!.setLocalDescription(offer);
      this.signaling.sendOffer(offer);

      // Wait for connection to be established
      await this.waitForConnection();

      console.log('[WebRTCTransport] Connection established');
    } catch (error) {
      console.error('[WebRTCTransport] Connection failed:', error);
      this.setState(TransportState.FAILED);
      this.cleanup();
      throw error;
    }
  }

  disconnect(): void {
    console.log('[WebRTCTransport] Disconnecting');
    this.cleanup();
    this.setState(TransportState.DISCONNECTED);
    this.emit('close', 'Disconnected by user');
  }

  send(data: string): void {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('DataChannel is not open');
    }
    this.dataChannel.send(data);
  }

  private setupSignalingHandlers(): void {
    this.signaling.on('answer', (answer) => {
      console.log('[WebRTCTransport] Received answer');
      this.handleAnswer(answer);
    });

    this.signaling.on('ice-candidate', (candidate) => {
      console.log('[WebRTCTransport] Received ICE candidate');
      this.handleIceCandidate(candidate);
    });

    this.signaling.on('peer-disconnected', () => {
      console.log('[WebRTCTransport] Peer disconnected');
      this.handlePeerDisconnected();
    });

    this.signaling.on('error', (error) => {
      console.error('[WebRTCTransport] Signaling error:', error);
      this.emit('error', new Error(error));
    });
  }

  private createPeerConnection(): void {
    console.log('[WebRTCTransport] Creating peer connection with ICE servers:', this.options.iceServers);

    this.peerConnection = new RTCPeerConnection({
      iceServers: this.options.iceServers,
    });

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[WebRTCTransport] Sending ICE candidate');
        this.signaling.sendIceCandidate(event.candidate.toJSON());
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection?.iceConnectionState;
      console.log('[WebRTCTransport] ICE connection state:', state);

      if (state === 'failed' || state === 'disconnected') {
        this.handleConnectionFailure();
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log('[WebRTCTransport] Connection state:', state);

      if (state === 'failed') {
        this.handleConnectionFailure();
      }
    };
  }

  private createDataChannel(): void {
    console.log('[WebRTCTransport] Creating data channel:', this.options.dataChannelLabel);

    this.dataChannel = this.peerConnection!.createDataChannel(this.options.dataChannelLabel, {
      ordered: true,
    });

    this.setupDataChannelHandlers();
  }

  private setupDataChannelHandlers(): void {
    if (!this.dataChannel) return;

    this.dataChannel.onopen = () => {
      console.log('[WebRTCTransport] Data channel opened');
      this.setState(TransportState.CONNECTED);
      this.emit('open');
    };

    this.dataChannel.onclose = () => {
      console.log('[WebRTCTransport] Data channel closed');
      this.setState(TransportState.DISCONNECTED);
      this.emit('close', 'Data channel closed');
    };

    this.dataChannel.onerror = (event) => {
      console.error('[WebRTCTransport] Data channel error:', event);
      this.emit('error', new Error('Data channel error'));
    };

    this.dataChannel.onmessage = (event) => {
      this.emit('message', event.data);
    };
  }

  private async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) return;

    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      this.remoteDescriptionSet = true;

      // Process buffered ICE candidates
      for (const candidate of this.iceCandidateBuffer) {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
      this.iceCandidateBuffer = [];
    } catch (error) {
      console.error('[WebRTCTransport] Error setting remote description:', error);
    }
  }

  private async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) return;

    if (this.remoteDescriptionSet) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error('[WebRTCTransport] Error adding ICE candidate:', error);
      }
    } else {
      // Buffer the candidate until remote description is set
      this.iceCandidateBuffer.push(candidate);
    }
  }

  private handlePeerDisconnected(): void {
    console.log('[WebRTCTransport] Peer disconnected');
    this.setState(TransportState.DISCONNECTED);
    this.emit('close', 'Peer disconnected');
    this.cleanup();
  }

  private handleConnectionFailure(): void {
    console.log('[WebRTCTransport] Connection failed');
    this.setState(TransportState.FAILED);
    this.emit('error', new Error('WebRTC connection failed'));
    this.cleanup();
  }

  private waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 30000);

      const checkConnection = () => {
        if (this.dataChannel?.readyState === 'open') {
          clearTimeout(timeout);
          resolve();
        }
      };

      // Check if already connected
      checkConnection();

      // Listen for open event
      const originalOnOpen = this.dataChannel?.onopen;
      if (this.dataChannel) {
        this.dataChannel.onopen = (event) => {
          clearTimeout(timeout);
          if (originalOnOpen) {
            originalOnOpen.call(this.dataChannel, event);
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
