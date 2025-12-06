/**
 * Remote Connection Manager
 *
 * Manages remote connections to Music Assistant instances via WebRTC.
 * Handles connection state, authentication, and provides a unified interface
 * for the application to connect to remote instances.
 */

import { ref, reactive } from "vue";
import { ITransport } from "./transport";
import { WebSocketTransport } from "./websocket-transport";
import { WebRTCTransport } from "./webrtc-transport";
import { httpProxyBridge } from "./http-proxy";

export enum ConnectionMode {
  LOCAL = "local",
  REMOTE = "remote",
}

export enum RemoteConnectionState {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  AUTHENTICATING = "authenticating",
  AUTHENTICATED = "authenticated",
  FAILED = "failed",
}

export interface RemoteConnectionConfig {
  // Signaling server URL for WebRTC connections
  signalingServerUrl: string;
}

export interface StoredRemoteConnection {
  remoteId: string;
  serverName?: string;
  lastConnected?: number;
}

const REMOTE_CONNECTIONS_STORAGE_KEY = "ma_remote_connections";
const REMOTE_MODE_STORAGE_KEY = "ma_remote_mode";
const CURRENT_REMOTE_ID_STORAGE_KEY = "ma_current_remote_id";

const DEFAULT_CONFIG: RemoteConnectionConfig = {
  signalingServerUrl: "wss://signaling.music-assistant.io/ws",
};

class RemoteConnectionManager {
  // Current connection state
  public state = ref<RemoteConnectionState>(RemoteConnectionState.DISCONNECTED);
  public mode = ref<ConnectionMode>(ConnectionMode.LOCAL);
  public currentRemoteId = ref<string | null>(null);
  public serverName = ref<string | null>(null);
  public error = ref<string | null>(null);

  // Configuration
  private config: RemoteConnectionConfig = DEFAULT_CONFIG;

  // Current transport
  private transport: ITransport | null = null;

  // Stored connections for quick access
  public storedConnections = reactive<StoredRemoteConnection[]>([]);

  constructor() {
    this.loadStoredConnections();
    this.loadRemoteMode();
    // Initialize HTTP proxy bridge
    httpProxyBridge.initialize();
  }

  /**
   * Check if we're in remote mode
   */
  get isRemoteMode(): boolean {
    return this.mode.value === ConnectionMode.REMOTE;
  }

  /**
   * Check if connected
   */
  get isConnected(): boolean {
    return (
      this.state.value === RemoteConnectionState.CONNECTED ||
      this.state.value === RemoteConnectionState.AUTHENTICATING ||
      this.state.value === RemoteConnectionState.AUTHENTICATED
    );
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<RemoteConnectionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Set connection mode
   */
  setMode(mode: ConnectionMode): void {
    this.mode.value = mode;
    localStorage.setItem(REMOTE_MODE_STORAGE_KEY, mode);
  }

  /**
   * Connect to a local Music Assistant instance via WebSocket
   */
  async connectLocal(serverUrl: string): Promise<ITransport> {
    this.setMode(ConnectionMode.LOCAL);
    this.state.value = RemoteConnectionState.CONNECTING;
    this.error.value = null;

    try {
      const wsUrl = serverUrl.replace("http", "ws") + "/ws";
      this.transport = new WebSocketTransport({ url: wsUrl });

      this.setupTransportHandlers();
      await this.transport.connect();

      this.state.value = RemoteConnectionState.CONNECTED;

      // Clear HTTP proxy bridge (not needed for local connections)
      httpProxyBridge.setTransport(null);

      return this.transport;
    } catch (err) {
      this.state.value = RemoteConnectionState.FAILED;
      this.error.value =
        err instanceof Error ? err.message : "Connection failed";
      throw err;
    }
  }

  /**
   * Connect to a remote Music Assistant instance via WebRTC
   */
  async connectRemote(remoteId: string): Promise<ITransport> {
    this.setMode(ConnectionMode.REMOTE);
    this.currentRemoteId.value = remoteId;
    this.state.value = RemoteConnectionState.CONNECTING;
    this.error.value = null;

    // Store the remote ID
    localStorage.setItem(CURRENT_REMOTE_ID_STORAGE_KEY, remoteId);

    try {
      const transport = new WebRTCTransport({
        signalingServerUrl: this.config.signalingServerUrl,
        remoteId: remoteId,
      });

      this.transport = transport;
      this.setupTransportHandlers();
      await transport.connect();

      this.state.value = RemoteConnectionState.CONNECTED;

      // Set up HTTP proxy bridge for remote connections
      httpProxyBridge.setTransport(transport);

      // Store successful connection
      this.storeConnection(remoteId);

      return transport;
    } catch (err) {
      this.state.value = RemoteConnectionState.FAILED;
      this.error.value =
        err instanceof Error ? err.message : "Connection failed";
      localStorage.removeItem(CURRENT_REMOTE_ID_STORAGE_KEY);
      throw err;
    }
  }

  /**
   * Disconnect current connection
   */
  disconnect(): void {
    if (this.transport) {
      this.transport.disconnect();
      this.transport = null;
    }
    this.state.value = RemoteConnectionState.DISCONNECTED;
    this.currentRemoteId.value = null;
    this.serverName.value = null;

    // Clear HTTP proxy bridge
    httpProxyBridge.setTransport(null);
  }

  /**
   * Get the current transport
   */
  getTransport(): ITransport | null {
    return this.transport;
  }

  /**
   * Update state to authenticating
   */
  setAuthenticating(): void {
    this.state.value = RemoteConnectionState.AUTHENTICATING;
  }

  /**
   * Update state to authenticated
   */
  setAuthenticated(serverName?: string): void {
    this.state.value = RemoteConnectionState.AUTHENTICATED;
    if (serverName) {
      this.serverName.value = serverName;
      // Update stored connection with server name
      if (this.currentRemoteId.value) {
        this.updateStoredConnection(this.currentRemoteId.value, { serverName });
      }
    }
  }

  /**
   * Get stored remote ID (for auto-reconnect)
   */
  getStoredRemoteId(): string | null {
    return localStorage.getItem(CURRENT_REMOTE_ID_STORAGE_KEY);
  }

  /**
   * Clear stored remote ID
   */
  clearStoredRemoteId(): void {
    localStorage.removeItem(CURRENT_REMOTE_ID_STORAGE_KEY);
  }

  /**
   * Remove a stored connection
   */
  removeStoredConnection(remoteId: string): void {
    const index = this.storedConnections.findIndex(
      (c) => c.remoteId === remoteId,
    );
    if (index !== -1) {
      this.storedConnections.splice(index, 1);
      this.saveStoredConnections();
    }
  }

  private setupTransportHandlers(): void {
    if (!this.transport) return;

    this.transport.on("close", () => {
      this.state.value = RemoteConnectionState.DISCONNECTED;
    });

    this.transport.on("error", (error) => {
      this.error.value = error.message;
    });
  }

  private storeConnection(remoteId: string): void {
    const existing = this.storedConnections.find(
      (c) => c.remoteId === remoteId,
    );
    if (existing) {
      existing.lastConnected = Date.now();
    } else {
      this.storedConnections.push({
        remoteId,
        lastConnected: Date.now(),
      });
    }
    this.saveStoredConnections();
  }

  private updateStoredConnection(
    remoteId: string,
    updates: Partial<StoredRemoteConnection>,
  ): void {
    const connection = this.storedConnections.find(
      (c) => c.remoteId === remoteId,
    );
    if (connection) {
      Object.assign(connection, updates);
      this.saveStoredConnections();
    }
  }

  private loadStoredConnections(): void {
    try {
      const stored = localStorage.getItem(REMOTE_CONNECTIONS_STORAGE_KEY);
      if (stored) {
        const connections = JSON.parse(stored) as StoredRemoteConnection[];
        this.storedConnections.splice(
          0,
          this.storedConnections.length,
          ...connections,
        );
      }
    } catch {
      // Ignore parse errors
    }
  }

  private saveStoredConnections(): void {
    try {
      localStorage.setItem(
        REMOTE_CONNECTIONS_STORAGE_KEY,
        JSON.stringify(this.storedConnections),
      );
    } catch {
      // Ignore storage errors
    }
  }

  private loadRemoteMode(): void {
    const storedMode = localStorage.getItem(REMOTE_MODE_STORAGE_KEY);
    if (storedMode === ConnectionMode.REMOTE) {
      this.mode.value = ConnectionMode.REMOTE;
    }
  }
}

// Export singleton instance
export const remoteConnectionManager = new RemoteConnectionManager();
export default remoteConnectionManager;
