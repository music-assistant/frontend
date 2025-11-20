<template>
  <div ref="playerRef" class="resonate-player"></div>
</template>

<script setup lang="ts">
import { useMediaBrowserMetaData } from "@/helpers/useMediaBrowserMetaData";
import { ResonateTimeFilter } from "@/helpers/ResonateTimeFilter";
import api from "@/plugins/api";
import { EventMessage, EventType } from "@/plugins/api/interfaces";
import { webPlayer, WebPlayerMode } from "@/plugins/web_player";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

// Properties
export interface Props {
  playerId: string;
}
const props = defineProps<Props>();

const playerRef = ref<HTMLDivElement>();

// Resonate Protocol Types
enum MessageType {
  CLIENT_HELLO = "client/hello",
  SERVER_HELLO = "server/hello",
  CLIENT_TIME = "client/time",
  SERVER_TIME = "server/time",
  CLIENT_STATE = "client/state",
  SERVER_STATE = "server/state",
  SERVER_COMMAND = "server/command",
  STREAM_START = "stream/start",
  STREAM_UPDATE = "stream/update",
  STREAM_REQUEST_FORMAT = "stream/request-format",
  STREAM_END = "stream/end",
  GROUP_UPDATE = "group/update",
}

interface ClientHello {
  type: MessageType.CLIENT_HELLO;
  payload: {
    client_id: string;
    name: string;
    version: number;
    supported_roles: string[];
    device_info?: {
      product_name?: string;
      manufacturer?: string;
      software_version?: string;
    };
    player_support?: {
      support_formats: Array<{
        codec: string;
        channels: number;
        sample_rate: number;
        bit_depth: number;
      }>;
      buffer_capacity: number;
      supported_commands: string[];
    };
  };
}

interface ClientTime {
  type: MessageType.CLIENT_TIME;
  payload: {
    client_transmitted: number;
  };
}

interface ClientState {
  type: MessageType.CLIENT_STATE;
  payload: {
    player?: {
      state: "synchronized" | "error";
      volume: number;
      muted: boolean;
    };
  };
}

interface StreamStart {
  type: MessageType.STREAM_START;
  payload: {
    codec: string;
    sample_rate: number;
    channels: number;
    bit_depth?: number;
  };
}

interface StreamUpdate {
  type: MessageType.STREAM_UPDATE;
  payload: {
    codec: string;
    sample_rate: number;
    channels: number;
    bit_depth?: number;
  };
}

interface ServerCommand {
  type: MessageType.SERVER_COMMAND;
  payload: {
    command: string;
    volume?: number;
    muted?: boolean;
  };
}

// Resonate State
let ws: WebSocket | null = null;
let audioContext: AudioContext | null = null;
let timeFilter = new ResonateTimeFilter(); // Kalman filter for clock synchronization
let nextPlaybackTime = 0;
let isPlaying = ref(false);
let volume = ref(100);
let muted = ref(false);
let currentStreamFormat: StreamStart["payload"] | null = null;
let audioBufferQueue: Array<{ buffer: AudioBuffer; serverTime: number }> = [];
let gainNode: GainNode | null = null;

// Clock synchronization
const TIME_SYNC_INTERVAL = 5000; // 5 seconds
let timeSyncInterval: any = null;

// State update interval
let stateInterval: any = null;
const STATE_UPDATE_INTERVAL = 5000; // 5 seconds

// Helper function to convert server time to AudioContext time
function serverTimeToAudioTime(serverTimeUs: number): number {
  if (!audioContext) return 0;

  // Convert server timestamp to client time using Kalman filter
  const clientTimeUs = timeFilter.computeClientTime(serverTimeUs);

  // Convert client time (microseconds) to AudioContext time (seconds)
  const nowUs = Math.floor(performance.now() * 1000);
  const deltaUs = clientTimeUs - nowUs;
  const deltaSec = deltaUs / 1_000_000;

  return audioContext.currentTime + deltaSec;
}

// Send JSON message to server
function sendMessage(message: any) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

// Initialize audio context
function initAudioContext() {
  if (!audioContext) {
    audioContext = new AudioContext();
    gainNode = audioContext.createGain();
    gainNode.connect(audioContext.destination);
    updateVolume();
  }
}

// Update volume
function updateVolume() {
  if (gainNode) {
    if (muted.value) {
      gainNode.gain.value = 0;
    } else {
      gainNode.gain.value = volume.value / 100;
    }
  }
}

// Send time synchronization message
function sendTimeSync() {
  const clientTimeUs = Math.floor(performance.now() * 1000);
  const message: ClientTime = {
    type: MessageType.CLIENT_TIME,
    payload: {
      client_transmitted: clientTimeUs,
    },
  };
  sendMessage(message);
}

// Send state update
async function sendStateUpdate() {
  // Send state to Resonate server via WebSocket
  const message: ClientState = {
    type: MessageType.CLIENT_STATE,
    payload: {
      player: {
        state: "synchronized",
        volume: volume.value,
        muted: muted.value,
      },
    },
  };
  sendMessage(message);
}

// Decode audio data based on codec
async function decodeAudioData(
  audioData: ArrayBuffer,
  format: StreamStart["payload"],
): Promise<AudioBuffer | null> {
  if (!audioContext) return null;

  try {
    if (format.codec === "opus" || format.codec === "flac") {
      // Opus and FLAC can be decoded by the browser's native decoder
      return await audioContext.decodeAudioData(audioData);
    } else if (format.codec === "pcm") {
      // PCM data needs manual decoding
      const bytesPerSample = (format.bit_depth || 16) / 8;
      const dataView = new DataView(audioData);
      const numSamples = audioData.byteLength / (bytesPerSample * format.channels);

      const audioBuffer = audioContext.createBuffer(
        format.channels,
        numSamples,
        format.sample_rate,
      );

      // Decode PCM data (interleaved format)
      for (let channel = 0; channel < format.channels; channel++) {
        const channelData = audioBuffer.getChannelData(channel);
        for (let i = 0; i < numSamples; i++) {
          const offset = (i * format.channels + channel) * bytesPerSample;
          let sample = 0;

          if (format.bit_depth === 16) {
            sample = dataView.getInt16(offset, true) / 32768.0;
          } else if (format.bit_depth === 24) {
            // 24-bit is stored in 3 bytes (little-endian)
            const byte1 = dataView.getUint8(offset);
            const byte2 = dataView.getUint8(offset + 1);
            const byte3 = dataView.getUint8(offset + 2);
            // Reconstruct as signed 24-bit value
            let int24 = (byte3 << 16) | (byte2 << 8) | byte1;
            // Sign extend if necessary
            if (int24 & 0x800000) {
              int24 |= 0xff000000;
            }
            sample = int24 / 8388608.0;
          } else if (format.bit_depth === 32) {
            sample = dataView.getInt32(offset, true) / 2147483648.0;
          }

          channelData[i] = sample;
        }
      }

      return audioBuffer;
    }
  } catch (error) {
    console.error("Error decoding audio data:", error);
  }

  return null;
}

// Handle binary audio message
async function handleBinaryMessage(data: ArrayBuffer) {
  if (!currentStreamFormat || !audioContext || !gainNode) return;

  // First byte contains role type and message slot
  const firstByte = new Uint8Array(data)[0];
  const roleType = (firstByte >> 4) & 0x0f;
  const messageSlot = firstByte & 0x0f;

  // Type 0 is audio chunk
  if (roleType === 0 && messageSlot === 0) {
    // Next 8 bytes are server timestamp in microseconds (big-endian int64)
    const timestampView = new DataView(data, 1, 8);
    // Read as big-endian int64 and convert to number
    const serverTimeUs = Number(timestampView.getBigInt64(0, false));

    // Rest is audio data
    const audioData = data.slice(9);
    const audioBuffer = await decodeAudioData(audioData, currentStreamFormat);

    if (audioBuffer) {
      const playbackTime = serverTimeToAudioTime(serverTimeUs);
      const currentTime = audioContext.currentTime;

      // Drop chunks that are too late (with small tolerance)
      if (playbackTime < currentTime - 0.1) {
        console.warn("Dropping late audio chunk", {
          playbackTime,
          currentTime,
          delta: playbackTime - currentTime,
        });
        return;
      }

      // Schedule playback
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(gainNode);

      // If the playback time is in the past (but within tolerance), play immediately
      const scheduleTime = Math.max(playbackTime, currentTime);
      source.start(scheduleTime);
    }
  }
}

// Handle WebSocket messages
function handleMessage(event: MessageEvent) {
  if (typeof event.data === "string") {
    // JSON message
    const message = JSON.parse(event.data);

    switch (message.type) {
      case MessageType.SERVER_HELLO:
        console.log("Resonate: Connected to server");
        // Start time synchronization
        sendTimeSync();
        timeSyncInterval = setInterval(sendTimeSync, TIME_SYNC_INTERVAL);
        break;

      case MessageType.SERVER_TIME:
        // Update Kalman filter with NTP-style measurement
        // Per spec: client_transmitted (T1), server_received (T2), server_transmitted (T3)
        const T4 = Math.floor(performance.now() * 1000); // client received time
        const T1 = message.payload.client_transmitted;
        const T2 = message.payload.server_received;
        const T3 = message.payload.server_transmitted;

        // NTP offset calculation: measurement = ((T2 - T1) + (T3 - T4)) / 2
        const measurement = ((T2 - T1) + (T3 - T4)) / 2;

        // Max error (half of round-trip time): max_error = ((T4 - T1) - (T3 - T2)) / 2
        const max_error = ((T4 - T1) - (T3 - T2)) / 2;

        // Update Kalman filter
        timeFilter.update(measurement, max_error, T4);

        console.log(
          "Resonate: Clock sync - offset:",
          (timeFilter.offset / 1000).toFixed(2),
          "ms, drift:",
          (timeFilter.drift * 1000000).toFixed(3),
          "ppm, error:",
          (timeFilter.error / 1000).toFixed(2),
          "ms, synced:",
          timeFilter.is_synchronized,
        );
        break;

      case MessageType.STREAM_START:
        currentStreamFormat = message.payload;
        console.log("Resonate: Stream started", currentStreamFormat);
        initAudioContext();
        isPlaying.value = true;
        break;

      case MessageType.STREAM_UPDATE:
        currentStreamFormat = message.payload;
        console.log("Resonate: Stream format updated", currentStreamFormat);
        break;

      case MessageType.STREAM_END:
        console.log("Resonate: Stream ended");
        isPlaying.value = false;
        currentStreamFormat = null;
        audioBufferQueue = [];
        break;

      case MessageType.SERVER_COMMAND:
        handleServerCommand(message);
        break;

      case MessageType.SERVER_STATE:
        // Handle server state updates if needed
        break;

      case MessageType.GROUP_UPDATE:
        // Handle group updates if needed
        break;
    }
  } else if (event.data instanceof ArrayBuffer) {
    // Binary message (audio chunk)
    handleBinaryMessage(event.data);
  } else if (event.data instanceof Blob) {
    // Convert Blob to ArrayBuffer
    event.data.arrayBuffer().then(handleBinaryMessage);
  }
}

// Handle server commands
function handleServerCommand(message: ServerCommand) {
  const { command, volume: newVolume, muted: newMuted } = message.payload;

  switch (command) {
    case "play":
      if (audioContext && audioContext.state === "suspended") {
        audioContext.resume();
      }
      isPlaying.value = true;
      break;

    case "pause":
      if (audioContext) {
        audioContext.suspend();
      }
      isPlaying.value = false;
      break;

    case "stop":
      if (audioContext) {
        audioContext.suspend();
      }
      isPlaying.value = false;
      currentStreamFormat = null;
      audioBufferQueue = [];
      break;

    case "set_volume":
      if (newVolume !== undefined) {
        volume.value = newVolume;
        updateVolume();
      }
      break;

    case "mute":
      muted.value = true;
      updateVolume();
      break;

    case "unmute":
      muted.value = false;
      updateVolume();
      break;
  }

  sendStateUpdate();
}

// Connect to Resonate server
async function connect() {
  // Disconnect if already connected
  if (ws) {
    ws.close();
    ws = null;
  }

  try {
    // Get the Resonate server URL from the webPlayer baseUrl
    // The WebSocket URL should be ws://host:port/resonate
    // Include player_id as a query parameter for identification
    const baseUrl = webPlayer.baseUrl;
    const url = new URL(baseUrl);
    const wsProtocol = url.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProtocol}//${url.host}/resonate?player_id=${encodeURIComponent(props.playerId)}`;

    console.log("Resonate: Connecting to", wsUrl);

    ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      console.log("Resonate: WebSocket connected");

      // Send client hello with player identification
      const hello: ClientHello = {
        type: MessageType.CLIENT_HELLO,
        payload: {
          client_id: props.playerId,
          name: "Music Assistant Web Player",
          version: 1,
          supported_roles: ["player"],
          device_info: {
            product_name: "Web Browser",
            manufacturer: navigator.vendor || "Unknown",
            software_version: navigator.userAgent,
          },
          player_support: {
            support_formats: [
              // Opus preferred (best quality/compression ratio)
              { codec: "opus", sample_rate: 48000, channels: 2, bit_depth: 16 },
              { codec: "opus", sample_rate: 44100, channels: 2, bit_depth: 16 },
              // FLAC fallback (lossless)
              { codec: "flac", sample_rate: 48000, channels: 2, bit_depth: 16 },
              { codec: "flac", sample_rate: 44100, channels: 2, bit_depth: 16 },
              { codec: "flac", sample_rate: 48000, channels: 2, bit_depth: 24 },
              { codec: "flac", sample_rate: 44100, channels: 2, bit_depth: 24 },
              // PCM fallback (uncompressed)
              { codec: "pcm", sample_rate: 48000, channels: 2, bit_depth: 16 },
              { codec: "pcm", sample_rate: 44100, channels: 2, bit_depth: 16 },
            ],
            buffer_capacity: 1024 * 1024 * 5, // 5MB buffer
            supported_commands: ["volume", "mute"],
          },
        },
      };
      sendMessage(hello);
    };

    ws.onmessage = handleMessage;

    ws.onerror = (error) => {
      console.error("Resonate: WebSocket error", error);
    };

    ws.onclose = () => {
      console.log("Resonate: WebSocket disconnected");
      // Try to reconnect after a delay
      setTimeout(() => {
        if (webPlayer.audioSource === WebPlayerMode.BUILTIN) {
          connect();
        }
      }, 5000);
    };
  } catch (error) {
    console.error("Resonate: Failed to connect", error);
  }
}

// Disconnect from Resonate server
function disconnect() {
  if (timeSyncInterval) {
    clearInterval(timeSyncInterval);
    timeSyncInterval = null;
  }

  if (stateInterval) {
    clearInterval(stateInterval);
    stateInterval = null;
  }

  if (ws) {
    ws.close();
    ws = null;
  }

  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }

  // Reset Kalman filter
  timeFilter.reset();

  gainNode = null;
  currentStreamFormat = null;
  audioBufferQueue = [];
  isPlaying.value = false;
}

// Watch for volume changes
watch([volume, muted], () => {
  updateVolume();
});

// MediaSession setup for metadata
let unsubMetadata: (() => void) | undefined;

// Setup on mount
onMounted(() => {
  console.log("Resonate: Component mounted, connecting...");

  // Set audio source to indicate this tab is handling audio
  // (for coordination with other tabs via web_player.ts)
  webPlayer.audioSource = WebPlayerMode.BUILTIN;

  // Setup metadata listener for MediaSession
  unsubMetadata = useMediaBrowserMetaData(props.playerId);

  // Connect to Resonate server
  connect();

  // Start state update interval (sends client/state to Resonate server)
  stateInterval = setInterval(sendStateUpdate, STATE_UPDATE_INTERVAL);
  sendStateUpdate();

  // MediaSession setup for browser controls
  // These forward to Music Assistant player commands (not Resonate-specific)
  navigator.mediaSession.setActionHandler("play", () => {
    if (!props.playerId) return;
    api.playerCommandPlay(props.playerId);
  });

  navigator.mediaSession.setActionHandler("pause", () => {
    if (!props.playerId) return;
    api.playerCommandPause(props.playerId);
  });

  navigator.mediaSession.setActionHandler("nexttrack", () => {
    if (!props.playerId) return;
    api.playerCommandNext(props.playerId);
  });

  navigator.mediaSession.setActionHandler("previoustrack", () => {
    if (!props.playerId) return;
    api.playerCommandPrevious(props.playerId);
  });
});

// Cleanup on unmount
onBeforeUnmount(() => {
  disconnect();
  if (unsubMetadata) unsubMetadata();
});
</script>

<style lang="css">
.resonate-player {
  width: 0;
  height: 0;
}
</style>
