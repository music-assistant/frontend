import { AudioProcessor } from "./audio-processor";
import { ProtocolHandler } from "./protocol-handler";
import { StateManager } from "./state-manager";
import { WebSocketManager } from "./websocket-manager";
import type { ResonatePlayerConfig, PlayerState, StreamFormat } from "./types";

export class ResonatePlayer {
  private wsManager: WebSocketManager;
  private audioProcessor: AudioProcessor;
  private protocolHandler: ProtocolHandler;
  private stateManager: StateManager;

  private config: ResonatePlayerConfig;
  private wsUrl: string = "";

  constructor(config: ResonatePlayerConfig) {
    this.config = config;

    // Initialize state manager with callback
    this.stateManager = new StateManager(config.onStateChange);

    // Initialize audio processor
    this.audioProcessor = new AudioProcessor(
      config.audioElement,
      config.isAndroid,
      this.stateManager,
    );

    // Initialize WebSocket manager
    this.wsManager = new WebSocketManager();

    // Initialize protocol handler
    this.protocolHandler = new ProtocolHandler(
      config.playerId,
      this.wsManager,
      this.audioProcessor,
      this.stateManager,
    );
  }

  // Connect to Resonate server
  async connect(): Promise<void> {
    // Build WebSocket URL
    const url = new URL(this.config.baseUrl);
    const wsProtocol = url.protocol === "https:" ? "wss:" : "ws:";
    this.wsUrl = `${wsProtocol}//${url.host}/resonate?player_id=${encodeURIComponent(this.config.playerId)}`;

    // Connect to WebSocket
    await this.wsManager.connect(
      this.wsUrl,
      // onOpen
      () => {
        console.log("Resonate: Using player_id:", this.config.playerId);
        this.protocolHandler.sendClientHello();
      },
      // onMessage
      (event: MessageEvent) => {
        this.protocolHandler.handleMessage(event);
      },
      // onError
      (error: Event) => {
        console.error("Resonate: WebSocket error", error);
      },
      // onClose
      () => {
        console.log("Resonate: Connection closed");
      },
    );
  }

  // Disconnect from Resonate server
  disconnect(): void {
    // Clear intervals
    this.stateManager.clearAllIntervals();

    // Disconnect WebSocket
    this.wsManager.disconnect();

    // Close audio processor
    this.audioProcessor.close();

    // Reset time filter
    this.protocolHandler.resetTimeFilter();

    // Reset state
    this.stateManager.reset();

    // Reset MediaSession playbackState (but keep Android loop playing if needed)
    navigator.mediaSession.playbackState = "none";
  }

  // Set volume (0-100)
  setVolume(volume: number): void {
    this.stateManager.volume = volume;
    this.audioProcessor.updateVolume();
    this.protocolHandler.sendStateUpdate();
  }

  // Set muted state
  setMuted(muted: boolean): void {
    this.stateManager.muted = muted;
    this.audioProcessor.updateVolume();
    this.protocolHandler.sendStateUpdate();
  }

  // Getters for reactive state
  get isPlaying(): boolean {
    return this.stateManager.isPlaying;
  }

  get volume(): number {
    return this.stateManager.volume;
  }

  get muted(): boolean {
    return this.stateManager.muted;
  }

  get playerState(): PlayerState {
    return this.stateManager.playerState;
  }

  get currentFormat(): StreamFormat | null {
    return this.stateManager.currentStreamFormat;
  }

  get isConnected(): boolean {
    return this.wsManager.isConnected();
  }
}

// Re-export types for convenience
export * from "./types";
