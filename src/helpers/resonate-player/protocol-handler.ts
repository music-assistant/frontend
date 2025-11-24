import { ResonateTimeFilter } from "@/helpers/ResonateTimeFilter";
import type {
  ClientHello,
  ClientState,
  ClientTime,
  MessageType,
  ServerCommand,
  ServerMessage,
  StreamStart,
  StreamUpdate,
} from "./types";
import type { AudioProcessor } from "./audio-processor";
import type { StateManager } from "./state-manager";
import type { WebSocketManager } from "./websocket-manager";

// Constants
const TIME_SYNC_INTERVAL = 5000; // 5 seconds
const STATE_UPDATE_INTERVAL = 5000; // 5 seconds

export class ProtocolHandler {
  private timeFilter = new ResonateTimeFilter();

  constructor(
    private playerId: string,
    private wsManager: WebSocketManager,
    private audioProcessor: AudioProcessor,
    private stateManager: StateManager,
  ) {}

  // Handle WebSocket messages
  handleMessage(event: MessageEvent): void {
    if (typeof event.data === "string") {
      // JSON message
      const message = JSON.parse(event.data) as ServerMessage;
      this.handleServerMessage(message);
    } else if (event.data instanceof ArrayBuffer) {
      // Binary message (audio chunk)
      this.audioProcessor.handleBinaryMessage(event.data);
    } else if (event.data instanceof Blob) {
      // Convert Blob to ArrayBuffer
      event.data.arrayBuffer().then((buffer) => {
        this.audioProcessor.handleBinaryMessage(buffer);
      });
    }
  }

  // Handle server messages
  private handleServerMessage(message: ServerMessage): void {
    switch (message.type) {
      case "server/hello":
        this.handleServerHello();
        break;

      case "server/time":
        this.handleServerTime(message);
        break;

      case "stream/start":
        this.handleStreamStart(message as StreamStart);
        break;

      case "stream/update":
        this.handleStreamUpdate(message as StreamUpdate);
        break;

      case "stream/end":
        this.handleStreamEnd();
        break;

      case "server/command":
        this.handleServerCommand(message as ServerCommand);
        break;

      case "server/state":
      case "group/update":
        // Handle these if needed in the future
        break;
    }
  }

  // Handle server hello
  private handleServerHello(): void {
    console.log("Resonate: Connected to server");
    // Per spec: Send initial client/state immediately after server/hello
    this.sendStateUpdate();
    // Start time synchronization
    this.sendTimeSync();
    const timeSyncInterval = window.setInterval(
      () => this.sendTimeSync(),
      TIME_SYNC_INTERVAL,
    );
    this.stateManager.setTimeSyncInterval(timeSyncInterval);

    // Start periodic state updates
    const stateInterval = window.setInterval(
      () => this.sendStateUpdate(),
      STATE_UPDATE_INTERVAL,
    );
    this.stateManager.setStateUpdateInterval(stateInterval);
  }

  // Handle server time synchronization
  private handleServerTime(message: any): void {
    // Update Kalman filter with NTP-style measurement
    // Per spec: client_transmitted (T1), server_received (T2), server_transmitted (T3)
    const T4 = Math.floor(performance.now() * 1000); // client received time
    const T1 = message.payload.client_transmitted;
    const T2 = message.payload.server_received;
    const T3 = message.payload.server_transmitted;

    // NTP offset calculation: measurement = ((T2 - T1) + (T3 - T4)) / 2
    const measurement = (T2 - T1 + (T3 - T4)) / 2;

    // Max error (half of round-trip time): max_error = ((T4 - T1) - (T3 - T2)) / 2
    const max_error = (T4 - T1 - (T3 - T2)) / 2;

    // Update Kalman filter
    this.timeFilter.update(measurement, max_error, T4);

    console.log(
      "Resonate: Clock sync - offset:",
      (this.timeFilter.offset / 1000).toFixed(2),
      "ms, error:",
      (this.timeFilter.error / 1000).toFixed(2),
      "ms, synced:",
      this.timeFilter.is_synchronized,
    );
  }

  // Handle stream start
  private handleStreamStart(message: StreamStart): void {
    this.stateManager.currentStreamFormat = message.payload.player;
    console.log(
      "Resonate: Stream started",
      this.stateManager.currentStreamFormat,
    );

    this.audioProcessor.initAudioContext();
    // Resume AudioContext if suspended (required for browser autoplay policies)
    this.audioProcessor.resumeAudioContext();

    // Reset scheduling state for new stream
    this.stateManager.resetStreamAnchors();
    this.audioProcessor.clearBuffers();
    this.stateManager.isPlaying = true;

    // Ensure audio element is playing for MediaSession
    this.audioProcessor.startAudioElement();

    // Explicitly set playbackState for Android
    navigator.mediaSession.playbackState = "playing";
  }

  // Handle stream update
  private handleStreamUpdate(message: StreamUpdate): void {
    // Merge delta updates into existing format
    if (message.payload.player && this.stateManager.currentStreamFormat) {
      this.stateManager.currentStreamFormat = {
        ...this.stateManager.currentStreamFormat,
        ...message.payload.player,
      };
    }
    console.log(
      "Resonate: Stream format updated",
      this.stateManager.currentStreamFormat,
    );
  }

  // Handle stream end
  private handleStreamEnd(): void {
    console.log("Resonate: Stream ended");
    // Per spec: Stop playback and clear buffers
    this.audioProcessor.clearBuffers();

    // Clear format and reset state
    this.stateManager.currentStreamFormat = null;
    this.stateManager.isPlaying = false;

    // Stop audio element (except on Android where silent loop continues)
    this.audioProcessor.stopAudioElement();

    // Explicitly set playbackState
    navigator.mediaSession.playbackState = "paused";

    // Send state update to server
    this.sendStateUpdate();
  }

  // Handle server commands
  private handleServerCommand(message: ServerCommand): void {
    const playerCommand = message.payload.player;
    if (!playerCommand) return;

    switch (playerCommand.command) {
      case "volume":
        // Set volume command
        if (playerCommand.volume !== undefined) {
          this.stateManager.volume = playerCommand.volume;
          this.audioProcessor.updateVolume();
        }
        break;

      case "mute":
        // Mute/unmute command - uses boolean mute field
        if (playerCommand.mute !== undefined) {
          this.stateManager.muted = playerCommand.mute;
          this.audioProcessor.updateVolume();
        }
        break;
    }

    // Send state update to confirm the change
    this.sendStateUpdate();
  }

  // Send client hello with player identification
  sendClientHello(): void {
    const hello: ClientHello = {
      type: "client/hello" as MessageType.CLIENT_HELLO,
      payload: {
        client_id: this.playerId,
        name: "Music Assistant Web Player",
        version: 1,
        supported_roles: ["player"],
        device_info: {
          product_name: "Web Browser",
          manufacturer: navigator.vendor || "Unknown",
          software_version: navigator.userAgent,
        },
        player_support: {
          supported_formats: this.getSupportedFormats(),
          buffer_capacity: 1024 * 1024 * 5, // 5MB buffer
          supported_commands: ["volume", "mute"],
        },
      },
    };
    this.wsManager.send(hello);
  }

  // Get supported audio formats based on browser
  private getSupportedFormats(): Array<{
    codec: string;
    channels: number;
    sample_rate: number;
    bit_depth: number;
  }> {
    // Safari has limited codec support, only use PCM for Safari
    // TODO: add flac support for Safari
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    if (isSafari) {
      return [
        {
          codec: "pcm",
          sample_rate: 48000,
          channels: 2,
          bit_depth: 16,
        },
        {
          codec: "pcm",
          sample_rate: 44100,
          channels: 2,
          bit_depth: 16,
        },
      ];
    }

    // Other browsers support FLAC and PCM
    // TODO: Opus needs special handling, at least on Safari and Firefox
    return [
      // FLAC preferred
      {
        codec: "flac",
        sample_rate: 48000,
        channels: 2,
        bit_depth: 16,
      },
      {
        codec: "flac",
        sample_rate: 44100,
        channels: 2,
        bit_depth: 16,
      },
      // PCM fallback (uncompressed)
      {
        codec: "pcm",
        sample_rate: 48000,
        channels: 2,
        bit_depth: 16,
      },
      {
        codec: "pcm",
        sample_rate: 44100,
        channels: 2,
        bit_depth: 16,
      },
    ];
  }

  // Send time synchronization message
  sendTimeSync(): void {
    const clientTimeUs = Math.floor(performance.now() * 1000);
    const message: ClientTime = {
      type: "client/time" as MessageType.CLIENT_TIME,
      payload: {
        client_transmitted: clientTimeUs,
      },
    };
    this.wsManager.send(message);
  }

  // Send state update
  sendStateUpdate(): void {
    const message: ClientState = {
      type: "client/state" as MessageType.CLIENT_STATE,
      payload: {
        player: {
          state: this.stateManager.playerState,
          volume: this.stateManager.volume,
          muted: this.stateManager.muted,
        },
      },
    };
    this.wsManager.send(message);
  }

  // Reset time filter
  resetTimeFilter(): void {
    this.timeFilter.reset();
  }
}
