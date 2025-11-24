<template>
  <div ref="playerRef" class="resonate-player">
    <audio ref="audioRef" class="hidden-audio"></audio>
  </div>
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
const audioRef = ref<HTMLAudioElement>();

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
      supported_formats: Array<{
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
    player: {
      codec: string;
      sample_rate: number;
      channels: number;
      bit_depth?: number;
      codec_header?: string;
    };
  };
}

interface StreamUpdate {
  type: MessageType.STREAM_UPDATE;
  payload: {
    player?: {
      codec?: string;
      sample_rate?: number;
      channels?: number;
      bit_depth?: number;
      codec_header?: string;
    };
  };
}

interface ServerCommand {
  type: MessageType.SERVER_COMMAND;
  payload: {
    player: {
      command: "volume" | "mute";
      volume?: number;
      mute?: boolean;
    };
  };
}

// Resonate State
let ws: WebSocket | null = null;
let audioContext: AudioContext | null = null;
let timeFilter = new ResonateTimeFilter(); // Kalman filter for clock synchronization
let streamStartServerTime = 0; // Server timestamp of the first chunk (stream anchor)
let streamStartAudioTime = 0; // AudioContext time when first chunk should play
let isPlaying = ref(false);
let volume = ref(100);
let muted = ref(false);
let playerState = ref<"synchronized" | "error">("synchronized"); // Track synchronization state
let currentStreamFormat: StreamStart["payload"]["player"] | null = null;
let audioBufferQueue: Array<{ buffer: AudioBuffer; serverTime: number }> = [];
let scheduledSources: AudioBufferSourceNode[] = [];
let gainNode: GainNode | null = null;
let streamDestination: MediaStreamAudioDestinationNode | null = null;
let queueProcessTimeout: any = null; // Debounce timer for queue processing

// Clock synchronization
const TIME_SYNC_INTERVAL = 5000; // 5 seconds
let timeSyncInterval: any = null;

// State update interval
let stateInterval: any = null;
const STATE_UPDATE_INTERVAL = 5000; // 5 seconds

// Send JSON message to server
function sendMessage(message: any) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

// Initialize audio context
function initAudioContext() {
  if (!audioContext) {
    // Create AudioContext with explicit sample rate matching the stream
    // This avoids resampling artifacts
    const streamSampleRate = currentStreamFormat?.sample_rate || 48000;
    audioContext = new AudioContext({ sampleRate: streamSampleRate });
    gainNode = audioContext.createGain();

    // Create MediaStreamDestination to bridge Web Audio API to HTML5 audio element
    // This enables iOS background playback while preserving Web Audio API functionality
    streamDestination = audioContext.createMediaStreamDestination();
    gainNode.connect(streamDestination);

    // Connect to HTML5 audio element for iOS background playback support
    if (audioRef.value) {
      audioRef.value.srcObject = streamDestination.stream;
      audioRef.value.play().catch((e) => {
        console.warn("Resonate: Audio autoplay blocked:", e);
      });
    }

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
        state: playerState.value,
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
  format: {
    codec: string;
    sample_rate: number;
    channels: number;
    bit_depth?: number;
    codec_header?: string;
  },
): Promise<AudioBuffer | null> {
  if (!audioContext) return null;

  try {
    if (format.codec === "opus" || format.codec === "flac") {
      // Opus and FLAC can be decoded by the browser's native decoder
      // If codec_header is provided, prepend it to the audio data
      let dataToEncode = audioData;
      if (format.codec_header) {
        // Decode Base64 codec header
        const headerBytes = Uint8Array.from(atob(format.codec_header), (c) =>
          c.charCodeAt(0),
        );
        // Concatenate header + audio data
        const combined = new Uint8Array(
          headerBytes.length + audioData.byteLength,
        );
        combined.set(headerBytes, 0);
        combined.set(new Uint8Array(audioData), headerBytes.length);
        dataToEncode = combined.buffer;
      }
      return await audioContext.decodeAudioData(dataToEncode);
    } else if (format.codec === "pcm") {
      // PCM data needs manual decoding
      const bytesPerSample = (format.bit_depth || 16) / 8;
      const dataView = new DataView(audioData);
      const numSamples =
        audioData.byteLength / (bytesPerSample * format.channels);

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
  if (!currentStreamFormat) {
    console.warn("Resonate: Received audio chunk but no stream format set");
    return;
  }
  if (!audioContext) {
    console.warn("Resonate: Received audio chunk but no audio context");
    return;
  }
  if (!gainNode) {
    console.warn("Resonate: Received audio chunk but no gain node");
    return;
  }

  // First byte contains role type and message slot
  // Spec: bits 7-2 identify role type (6 bits), bits 1-0 identify message slot (2 bits)
  const firstByte = new Uint8Array(data)[0];
  const roleType = (firstByte >> 2) & 0x3f; // Extract bits 7-2
  const messageSlot = firstByte & 0x03; // Extract bits 1-0

  // Type 0 is audio chunk (Player role, slot 0)
  if (firstByte === 0) {
    // Next 8 bytes are server timestamp in microseconds (big-endian int64)
    const timestampView = new DataView(data, 1, 8);
    // Read as big-endian int64 and convert to number
    const serverTimeUs = Number(timestampView.getBigInt64(0, false));

    // Rest is audio data
    const audioData = data.slice(9);
    const audioBuffer = await decodeAudioData(audioData, currentStreamFormat);

    if (audioBuffer) {
      // Add to queue for ordered playback
      audioBufferQueue.push({ buffer: audioBuffer, serverTime: serverTimeUs });

      // Debounce queue processing to allow multiple chunks to arrive
      // This handles out-of-order arrivals from async FLAC decoding
      if (queueProcessTimeout) {
        clearTimeout(queueProcessTimeout);
      }
      queueProcessTimeout = setTimeout(() => {
        processAudioQueue();
        queueProcessTimeout = null;
      }, 50); // 50ms debounce - collect a larger batch before scheduling
    } else {
      console.error("Resonate: Failed to decode audio buffer");
    }
  }
}

// Process the audio queue and schedule chunks in order
function processAudioQueue() {
  if (!audioContext || !gainNode) return;

  // Sort queue by server timestamp to ensure proper ordering
  audioBufferQueue.sort((a, b) => a.serverTime - b.serverTime);

  // Capture currentTime ONCE at the start of scheduling
  const currentTime = audioContext.currentTime;

  // If this is the first batch and we haven't established the anchor yet,
  // use the EARLIEST chunk's timestamp as the anchor (not the first one we process)
  if (streamStartServerTime === 0 && audioBufferQueue.length > 0) {
    const earliestChunk = audioBufferQueue[0];
    streamStartServerTime = earliestChunk.serverTime;
    streamStartAudioTime = currentTime + 0.2;
  }

  // Schedule all chunks in the queue
  while (audioBufferQueue.length > 0) {
    const chunk = audioBufferQueue.shift()!;

    // Calculate time offset from first chunk (in microseconds)
    const offsetUs = chunk.serverTime - streamStartServerTime;
    const offsetSec = offsetUs / 1_000_000;
    const playbackTime = streamStartAudioTime + offsetSec;

    // Schedule playback (ensure we don't schedule in the past)
    const scheduleTime = Math.max(playbackTime, currentTime);

    const source = audioContext.createBufferSource();
    source.buffer = chunk.buffer;
    source.connect(gainNode);
    source.start(scheduleTime);

    scheduledSources.push(source);
    source.onended = () => {
      const idx = scheduledSources.indexOf(source);
      if (idx > -1) scheduledSources.splice(idx, 1);
    };
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
        // Per spec: Send initial client/state immediately after server/hello
        sendStateUpdate();
        // Start time synchronization
        sendTimeSync();
        timeSyncInterval = setInterval(sendTimeSync, TIME_SYNC_INTERVAL);
        // Start periodic state updates
        stateInterval = setInterval(sendStateUpdate, STATE_UPDATE_INTERVAL);
        break;

      case MessageType.SERVER_TIME: {
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
        timeFilter.update(measurement, max_error, T4);

        console.log(
          "Resonate: Clock sync - offset:",
          (timeFilter.offset / 1000).toFixed(2),
          "ms, error:",
          (timeFilter.error / 1000).toFixed(2),
          "ms, synced:",
          timeFilter.is_synchronized,
        );
        break;
      }

      case MessageType.STREAM_START:
        currentStreamFormat = message.payload.player;
        console.log("Resonate: Stream started", currentStreamFormat);
        initAudioContext();
        // Resume AudioContext if suspended (required for browser autoplay policies)
        if (audioContext && audioContext.state === "suspended") {
          audioContext.resume().then(() => {
            console.log("Resonate: AudioContext resumed");
          });
        }
        // Reset scheduling state for new stream
        streamStartServerTime = 0;
        streamStartAudioTime = 0;
        scheduledSources = [];
        audioBufferQueue = [];
        isPlaying.value = true;
        break;

      case MessageType.STREAM_UPDATE:
        // Merge delta updates into existing format
        if (message.payload.player && currentStreamFormat) {
          currentStreamFormat = {
            ...currentStreamFormat,
            ...message.payload.player,
          };
        }
        console.log("Resonate: Stream format updated", currentStreamFormat);
        break;

      case MessageType.STREAM_END:
        console.log("Resonate: Stream ended");
        // Per spec: Stop playback and clear buffers
        // Stop all scheduled audio sources
        scheduledSources.forEach((source) => {
          try {
            source.stop();
          } catch (e) {
            // Ignore errors if source already stopped
          }
        });
        scheduledSources = [];
        // Clear pending queue processing
        if (queueProcessTimeout) {
          clearTimeout(queueProcessTimeout);
          queueProcessTimeout = null;
        }
        // Clear buffers and reset state
        audioBufferQueue = [];
        streamStartServerTime = 0;
        streamStartAudioTime = 0;
        currentStreamFormat = null;
        isPlaying.value = false;
        // Send state update to server
        sendStateUpdate();
        // Note: We keep the AudioContext running so it's ready for the next stream
        // The browser will suspend it automatically after inactivity
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
  const playerCommand = message.payload.player;
  if (!playerCommand) return;

  switch (playerCommand.command) {
    case "volume":
      // Set volume command
      if (playerCommand.volume !== undefined) {
        volume.value = playerCommand.volume;
        updateVolume();
      }
      break;

    case "mute":
      // Mute/unmute command - uses boolean mute field
      if (playerCommand.mute !== undefined) {
        muted.value = playerCommand.mute;
        updateVolume();
      }
      break;
  }

  // Send state update to confirm the change
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
      console.log("Resonate: Using player_id:", props.playerId);

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
            supported_formats: (() => {
              // Safari has limited codec support, only use PCM for Safari
              // TODO: add flac support for Safari
              const isSafari = /^((?!chrome|android).)*safari/i.test(
                navigator.userAgent,
              );

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
                // FLAC prefered
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
            })(),
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
  streamDestination = null;
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

.hidden-audio {
  display: none;
}
</style>
