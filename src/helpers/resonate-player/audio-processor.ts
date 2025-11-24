import type { AudioBufferQueueItem, StreamFormat } from "./types";
import type { StateManager } from "./state-manager";
import almostSilentMp3 from "@/assets/almost_silent.mp3";

export class AudioProcessor {
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private streamDestination: MediaStreamAudioDestinationNode | null = null;
  private audioBufferQueue: AudioBufferQueueItem[] = [];
  private scheduledSources: AudioBufferSourceNode[] = [];
  private queueProcessTimeout: number | null = null;

  constructor(
    private audioElement: HTMLAudioElement,
    private isAndroid: boolean,
    private stateManager: StateManager,
  ) {}

  // Initialize AudioContext with platform-specific setup
  initAudioContext(): void {
    if (this.audioContext) {
      return; // Already initialized
    }

    const streamSampleRate =
      this.stateManager.currentStreamFormat?.sample_rate || 48000;
    this.audioContext = new AudioContext({ sampleRate: streamSampleRate });
    this.gainNode = this.audioContext.createGain();

    if (this.isAndroid) {
      // Android MediaSession workaround: Play almost-silent audio file
      // Android browsers don't support MediaSession with MediaStream from Web Audio API
      // Solution: Loop almost-silent audio to keep MediaSession active
      // Real audio plays through Web Audio API → audioContext.destination
      this.gainNode.connect(this.audioContext.destination);

      // Use almost-silent audio file to trick Android into showing MediaSession
      this.audioElement.src = almostSilentMp3;
      this.audioElement.loop = true;
      // CRITICAL: Do NOT mute - Android requires audible audio for MediaSession
      this.audioElement.muted = false;
      // Set volume to 100% (the file itself is almost silent)
      this.audioElement.volume = 1.0;
      // Start playing to activate MediaSession
      this.audioElement.play().catch((e) => {
        console.warn("Resonate: Audio autoplay blocked:", e);
      });
    } else {
      // iOS/Desktop: Use MediaStream approach for background playback
      // Create MediaStreamDestination to bridge Web Audio API to HTML5 audio element
      this.streamDestination = this.audioContext.createMediaStreamDestination();
      this.gainNode.connect(this.streamDestination);
      // Do NOT connect to audioContext.destination to avoid echo

      // Connect to HTML5 audio element for iOS background playback
      this.audioElement.srcObject = this.streamDestination.stream;
      this.audioElement.volume = 1.0;
      // Start playing to activate MediaSession
      this.audioElement.play().catch((e) => {
        console.warn("Resonate: Audio autoplay blocked:", e);
      });
    }

    this.updateVolume();
  }

  // Resume AudioContext if suspended (required for browser autoplay policies)
  async resumeAudioContext(): Promise<void> {
    if (this.audioContext && this.audioContext.state === "suspended") {
      await this.audioContext.resume();
      console.log("Resonate: AudioContext resumed");
    }
  }

  // Update volume based on current state
  updateVolume(): void {
    if (!this.gainNode) return;

    if (this.stateManager.muted) {
      this.gainNode.gain.value = 0;
    } else {
      this.gainNode.gain.value = this.stateManager.volume / 100;
    }
  }

  // Decode audio data based on codec
  async decodeAudioData(
    audioData: ArrayBuffer,
    format: StreamFormat,
  ): Promise<AudioBuffer | null> {
    if (!this.audioContext) return null;

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
        return await this.audioContext.decodeAudioData(dataToEncode);
      } else if (format.codec === "pcm") {
        // PCM data needs manual decoding
        return this.decodePCMData(audioData, format);
      }
    } catch (error) {
      console.error("Error decoding audio data:", error);
    }

    return null;
  }

  // Decode PCM audio data
  private decodePCMData(
    audioData: ArrayBuffer,
    format: StreamFormat,
  ): AudioBuffer | null {
    if (!this.audioContext) return null;

    const bytesPerSample = (format.bit_depth || 16) / 8;
    const dataView = new DataView(audioData);
    const numSamples = audioData.byteLength / (bytesPerSample * format.channels);

    const audioBuffer = this.audioContext.createBuffer(
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

  // Handle binary audio message
  async handleBinaryMessage(data: ArrayBuffer): Promise<void> {
    const format = this.stateManager.currentStreamFormat;
    if (!format) {
      console.warn("Resonate: Received audio chunk but no stream format set");
      return;
    }
    if (!this.audioContext) {
      console.warn("Resonate: Received audio chunk but no audio context");
      return;
    }
    if (!this.gainNode) {
      console.warn("Resonate: Received audio chunk but no gain node");
      return;
    }

    // First byte contains role type and message slot
    // Spec: bits 7-2 identify role type (6 bits), bits 1-0 identify message slot (2 bits)
    const firstByte = new Uint8Array(data)[0];

    // Type 0 is audio chunk (Player role, slot 0)
    if (firstByte === 0) {
      // Next 8 bytes are server timestamp in microseconds (big-endian int64)
      const timestampView = new DataView(data, 1, 8);
      // Read as big-endian int64 and convert to number
      const serverTimeUs = Number(timestampView.getBigInt64(0, false));

      // Rest is audio data
      const audioData = data.slice(9);
      const audioBuffer = await this.decodeAudioData(audioData, format);

      if (audioBuffer) {
        // Add to queue for ordered playback
        this.audioBufferQueue.push({ buffer: audioBuffer, serverTime: serverTimeUs });

        // Debounce queue processing to allow multiple chunks to arrive
        // This handles out-of-order arrivals from async FLAC decoding
        if (this.queueProcessTimeout !== null) {
          clearTimeout(this.queueProcessTimeout);
        }
        this.queueProcessTimeout = window.setTimeout(() => {
          this.processAudioQueue();
          this.queueProcessTimeout = null;
        }, 50); // 50ms debounce - collect a larger batch before scheduling
      } else {
        console.error("Resonate: Failed to decode audio buffer");
      }
    }
  }

  // Process the audio queue and schedule chunks in order
  processAudioQueue(): void {
    if (!this.audioContext || !this.gainNode) return;

    // Sort queue by server timestamp to ensure proper ordering
    this.audioBufferQueue.sort((a, b) => a.serverTime - b.serverTime);

    // Capture currentTime ONCE at the start of scheduling
    const currentTime = this.audioContext.currentTime;

    // If this is the first batch and we haven't established the anchor yet,
    // use the EARLIEST chunk's timestamp as the anchor (not the first one we process)
    if (
      this.stateManager.streamStartServerTime === 0 &&
      this.audioBufferQueue.length > 0
    ) {
      const earliestChunk = this.audioBufferQueue[0];
      this.stateManager.streamStartServerTime = earliestChunk.serverTime;
      this.stateManager.streamStartAudioTime = currentTime + 0.2;
    }

    // Schedule all chunks in the queue
    while (this.audioBufferQueue.length > 0) {
      const chunk = this.audioBufferQueue.shift()!;

      // Calculate time offset from first chunk (in microseconds)
      const offsetUs =
        chunk.serverTime - this.stateManager.streamStartServerTime;
      const offsetSec = offsetUs / 1_000_000;
      const playbackTime = this.stateManager.streamStartAudioTime + offsetSec;

      // Schedule playback (ensure we don't schedule in the past)
      const scheduleTime = Math.max(playbackTime, currentTime);

      const source = this.audioContext.createBufferSource();
      source.buffer = chunk.buffer;
      source.connect(this.gainNode);
      source.start(scheduleTime);

      this.scheduledSources.push(source);
      source.onended = () => {
        const idx = this.scheduledSources.indexOf(source);
        if (idx > -1) this.scheduledSources.splice(idx, 1);
      };
    }
  }

  // Start audio element playback (for MediaSession)
  startAudioElement(): void {
    if (this.audioElement.paused) {
      this.audioElement.play().catch((e) => {
        console.warn("Resonate: Failed to start audio element:", e);
      });
    }
  }

  // Stop audio element playback (for MediaSession)
  stopAudioElement(): void {
    if (!this.isAndroid && !this.audioElement.paused) {
      this.audioElement.pause();
    }
  }

  // Clear all audio buffers and scheduled sources
  clearBuffers(): void {
    // Stop all scheduled audio sources
    this.scheduledSources.forEach((source) => {
      try {
        source.stop();
      } catch (e) {
        // Ignore errors if source already stopped
      }
    });
    this.scheduledSources = [];

    // Clear pending queue processing
    if (this.queueProcessTimeout !== null) {
      clearTimeout(this.queueProcessTimeout);
      this.queueProcessTimeout = null;
    }

    // Clear buffers
    this.audioBufferQueue = [];

    // Reset stream anchors
    this.stateManager.resetStreamAnchors();
  }

  // Cleanup and close AudioContext
  close(): void {
    this.clearBuffers();

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.gainNode = null;
    this.streamDestination = null;

    // Stop and clear the audio element
    if (!this.isAndroid) {
      this.audioElement.pause();
      this.audioElement.srcObject = null;
    }
  }

  // Get AudioContext for external use
  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }
}
