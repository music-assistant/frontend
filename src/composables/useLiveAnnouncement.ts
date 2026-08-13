// Live announcement: streams this browser's microphone to a player, which plays
// it while the user is still speaking. Owns the microphone capture and the
// `/live_announcement` protocol, so the announcement dialog only has to start
// and stop a clip.
import { ref } from "vue";

import api from "@/plugins/api";
import { authManager } from "@/plugins/auth";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";

// The server ends a clip once it reaches this length; stopping first keeps the
// UI from claiming to record audio that is no longer accepted.
const MAX_DURATION_MS = 300000;
// Budget for connecting, authenticating and having the clip accepted.
const START_TIMEOUT_MS = 10000;
// Close code the server rejects a session with; its reason is user facing.
const REJECTED_CODE = 4001;
// Audio is streamed in frames of this length: short enough to keep the
// announcement in step with the speaker, long enough to not thrash the socket.
const FRAME_MS = 20;

const PROCESSOR_NAME = "live-announcement-recorder";

// Runs in the AudioWorklet global scope: collects the microphone's render
// quanta into FRAME_MS sized blocks of little-endian signed 16 bit PCM and
// hands each finished block to the main thread.
const PROCESSOR_SOURCE = `
class LiveAnnouncementProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.frameSamples = Math.round(
      (sampleRate * options.processorOptions.frameMs) / 1000,
    );
    this.startFrame();
  }

  startFrame() {
    this.frame = new ArrayBuffer(this.frameSamples * 2);
    this.view = new DataView(this.frame);
    this.sampleCount = 0;
  }

  process(inputs) {
    const samples = inputs[0] && inputs[0][0];
    if (!samples) return true;
    for (let i = 0; i < samples.length; i++) {
      const clamped = Math.max(-1, Math.min(1, samples[i]));
      this.view.setInt16(this.sampleCount * 2, Math.round(clamped * 0x7fff), true);
      this.sampleCount++;
      if (this.sampleCount === this.frameSamples) {
        const frame = this.frame;
        this.startFrame();
        this.port.postMessage(frame, [frame]);
      }
    }
    return true;
  }
}

registerProcessor(${JSON.stringify(PROCESSOR_NAME)}, LiveAnnouncementProcessor);
`;

export type LiveAnnouncementState =
  | "idle"
  | "connecting"
  | "recording"
  | "finishing";

export interface LiveAnnouncementCallbacks {
  /** The clip finished playing on the player. */
  onFinished: () => void;
  /** The clip could not be recorded or played; the message is user facing. */
  onError: (message: string) => void;
}

interface Capture {
  stream: MediaStream;
  context: AudioContext;
  worklet: AudioWorkletNode;
}

/**
 * Whether this session can speak a live announcement.
 */
export function liveAnnouncementSupported(): boolean {
  // A remote (WebRTC) session has no route to the webserver's endpoints, and
  // getUserMedia needs a secure context - so a page served over plain http
  // (a LAN address, typically) can never record.
  if (api.isRemoteConnection.value || !api.baseUrl) return false;
  return !!(window.isSecureContext && navigator.mediaDevices?.getUserMedia);
}

/**
 * Records the microphone and streams it to a player as a live announcement.
 *
 * @param callbacks - Called when the clip finished playing or failed.
 */
export function useLiveAnnouncement(callbacks: LiveAnnouncementCallbacks) {
  const state = ref<LiveAnnouncementState>("idle");
  const elapsedSeconds = ref(0);

  let capture: Capture | null = null;
  let socket: WebSocket | null = null;
  // audio recorded before the server accepted the clip, flushed on "started"
  let pendingFrames: ArrayBuffer[] = [];
  let accepting = false;
  // the user released the button before the server accepted the clip
  let stopPending = false;
  // invalidates the microphone request of an abandoned press
  let attempt = 0;
  let startTimer: ReturnType<typeof setTimeout> | null = null;
  let clockTimer: ReturnType<typeof setInterval> | null = null;
  let startedAt = 0;

  /**
   * Start recording and stream to the given player.
   *
   * @param playerId - Player that should play the announcement.
   * @param preAnnounce - Play the chime before the announcement.
   */
  async function start(playerId: string, preAnnounce: boolean): Promise<void> {
    if (state.value !== "idle") return;
    const current = ++attempt;
    state.value = "connecting";
    elapsedSeconds.value = 0;
    startedAt = Date.now();

    let opened: Capture;
    try {
      opened = await openCapture();
    } catch (err) {
      if (current === attempt) fail(microphoneErrorMessage(err));
      return;
    }
    if (current !== attempt) {
      // the press was abandoned while the browser asked for permission
      closeCapture(opened);
      return;
    }

    capture = opened;
    // recording starts here, not on "started", or the first word is clipped
    opened.worklet.port.onmessage = (event: MessageEvent) =>
      queueFrame(event.data as ArrayBuffer);
    openSocket(playerId, preAnnounce, opened.context.sampleRate);
  }

  /**
   * Finish the clip: releases the microphone and waits for the player to
   * finish playing what was recorded.
   */
  function stop(): void {
    if (state.value !== "connecting" && state.value !== "recording") return;
    if (!capture) {
      // released before the microphone was handed over (a stray tap, or the
      // permission prompt took the press): there is nothing to announce
      teardown();
      return;
    }
    releaseCapture();
    clearClock();
    if (!accepting) {
      // the queued audio is sent, and the clip ended, once the server accepts
      stopPending = true;
      return;
    }
    sendStop();
  }

  /**
   * Abandon the clip and release everything it holds.
   */
  function cancel(): void {
    teardown();
  }

  async function openCapture(): Promise<Capture> {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    const context = new AudioContext();
    try {
      const moduleUrl = URL.createObjectURL(
        new Blob([PROCESSOR_SOURCE], { type: "text/javascript" }),
      );
      try {
        await context.audioWorklet.addModule(moduleUrl);
      } finally {
        URL.revokeObjectURL(moduleUrl);
      }
      if (context.state === "suspended") await context.resume();

      const worklet = new AudioWorkletNode(context, PROCESSOR_NAME, {
        // an explicit mono count downmixes a stereo microphone for us, so the
        // stream always matches the channel count announced to the server
        channelCount: 1,
        channelCountMode: "explicit",
        processorOptions: { frameMs: FRAME_MS },
      });
      context.createMediaStreamSource(stream).connect(worklet);
      // only a graph that reaches the destination is rendered, so the worklet's
      // (silent) output is routed there through a muted gain node
      const sink = context.createGain();
      sink.gain.value = 0;
      worklet.connect(sink).connect(context.destination);
      return { stream, context, worklet };
    } catch (err) {
      for (const track of stream.getTracks()) track.stop();
      void context.close().catch(() => {});
      throw err;
    }
  }

  function openSocket(
    playerId: string,
    preAnnounce: boolean,
    sampleRate: number,
  ): void {
    const url = socketUrl();
    if (!url) {
      fail($t("play_announcement_live_failed"));
      return;
    }

    const ws = new WebSocket(url);
    socket = ws;
    ws.onopen = () => {
      // ingress sessions are authenticated by Home Assistant via headers
      if (!store.isIngressSession) {
        ws.send(
          JSON.stringify({ type: "auth", token: authManager.getToken() }),
        );
      }
      ws.send(
        JSON.stringify({
          type: "start",
          player_id: playerId,
          sample_rate: Math.round(sampleRate),
          channels: 1,
          pre_announce: preAnnounce,
          volume_level: null,
        }),
      );
    };
    ws.onmessage = (event) => handleMessage(event);
    ws.onclose = (event) => {
      // a rejected session carries a human readable reason
      const rejected = event.code === REJECTED_CODE && event.reason;
      fail(rejected || $t("play_announcement_live_failed"));
    };
    startTimer = setTimeout(
      () => fail($t("play_announcement_live_failed")),
      START_TIMEOUT_MS,
    );
  }

  function handleMessage(event: MessageEvent): void {
    if (typeof event.data !== "string") return;
    let message: { type?: string; message?: string };
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }
    if (message.type === "started") handleStarted();
    else if (message.type === "finished") finish();
    else if (message.type === "error") {
      fail(message.message || $t("play_announcement_live_failed"));
    }
  }

  function handleStarted(): void {
    if (state.value !== "connecting") return;
    accepting = true;
    clearStartTimer();
    for (const frame of pendingFrames) sendFrame(frame);
    pendingFrames = [];
    if (stopPending) {
      sendStop();
      return;
    }
    state.value = "recording";
    clockTimer = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      elapsedSeconds.value = Math.floor(elapsed / 1000);
      if (elapsed >= MAX_DURATION_MS) stop();
    }, 1000);
  }

  function queueFrame(frame: ArrayBuffer): void {
    if (accepting) sendFrame(frame);
    else pendingFrames.push(frame);
  }

  function sendFrame(frame: ArrayBuffer): void {
    if (socket?.readyState === WebSocket.OPEN) socket.send(frame);
  }

  function sendStop(): void {
    state.value = "finishing";
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "stop" }));
    }
  }

  function finish(): void {
    teardown();
    callbacks.onFinished();
  }

  function fail(message: string): void {
    teardown();
    callbacks.onError(message);
  }

  function teardown(): void {
    // abandons a microphone request that is still in flight
    attempt++;
    releaseCapture();
    closeSocket();
    clearStartTimer();
    clearClock();
    pendingFrames = [];
    accepting = false;
    stopPending = false;
    state.value = "idle";
  }

  function releaseCapture(): void {
    if (!capture) return;
    const active = capture;
    capture = null;
    closeCapture(active);
  }

  function closeSocket(): void {
    if (!socket) return;
    const ws = socket;
    socket = null;
    // our own close is not a failure, so drop the handlers before closing
    ws.onopen = null;
    ws.onmessage = null;
    ws.onclose = null;
    ws.close();
  }

  function clearStartTimer(): void {
    if (startTimer === null) return;
    clearTimeout(startTimer);
    startTimer = null;
  }

  function clearClock(): void {
    if (clockTimer === null) return;
    clearInterval(clockTimer);
    clockTimer = null;
  }

  return { state, elapsedSeconds, start, stop, cancel };
}

function closeCapture(capture: Capture): void {
  capture.worklet.port.onmessage = null;
  capture.worklet.disconnect();
  for (const track of capture.stream.getTracks()) track.stop();
  void capture.context.close().catch(() => {});
}

function socketUrl(): string {
  const baseUrl = api.baseUrl;
  if (!baseUrl) return "";
  const wsScheme = baseUrl.startsWith("https") ? "wss" : "ws";
  return `${wsScheme}://${baseUrl.replace(/^https?:\/\//, "")}/live_announcement`;
}

function microphoneErrorMessage(err: unknown): string {
  // NotAllowedError is also what a browser policy that blocks the microphone
  // reports (an iframe without a microphone permission, for instance), not
  // only a user who declined.
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return $t("play_announcement_mic_denied");
  }
  return $t("play_announcement_mic_failed");
}
