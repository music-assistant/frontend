/**
 * Client for the MilkDrop Visualizer plugin's relay endpoint.
 *
 * The relay (provided by the `milkdrop_visualizer` server plugin) taps the
 * audio the server already decodes for the player's playback and streams
 * timestamped waveform (and beat) frames over a plain WebSocket. This client
 * keeps a clock sync against the server, buffers frames in a FrameScheduler,
 * and exposes a pull API for the render loop.
 */

import { parseVisualizerBinary } from "@/helpers/visualizer/binaryFrames";
import { FrameScheduler } from "@/helpers/visualizer/frameScheduler";
import { ClockSync, computeTimeSample } from "@/helpers/visualizer/timeSync";
import { isVisualizerSupported } from "@/composables/visualizer/useVisualizerEngine";
import api from "@/plugins/api";
import { authManager } from "@/plugins/auth";
import { store } from "@/plugins/store";

const N_SAMPLES = 1024; // matches butterchurn's fixed internal buffers
const RECONNECT_DELAY_MS = 3000;
const TIME_SYNC_BURST = 8;
const TIME_SYNC_BURST_INTERVAL_MS = 250;
const TIME_SYNC_INTERVAL_MS = 5000;
// Close code the relay uses to reject authentication (mirrors the Sendspin proxy).
const AUTH_FAILED_CODE = 4001;

export type RelayState = "connecting" | "streaming" | "waiting" | "closed";

// color@v1 fields (see aiosendspin.models.color.SessionUpdateColor).
const COLOR_PALETTE_FIELDS = [
  "background_dark",
  "background_light",
  "primary",
  "accent",
  "on_dark",
  "on_light",
] as const;
export type ColorPaletteField = (typeof COLOR_PALETTE_FIELDS)[number];
export type ColorPalette = Partial<
  Record<ColorPaletteField, [number, number, number] | null>
>;

// Palette entries come off the wire; only a numeric 3-tuple may pass as one.
const isRgbTuple = (value: unknown): value is [number, number, number] =>
  Array.isArray(value) &&
  value.length === 3 &&
  value.every((channel) => Number.isFinite(channel));

export interface VisualizerRelayCallbacks {
  onState?: (state: RelayState) => void;
  onDownbeat?: (timestampUs: number) => void;
  // Fired with the full merged palette, not just what changed.
  onColor?: (palette: ColorPalette) => void;
}

function relayUrl(playerQuery?: string): string {
  const baseUrl = api.baseUrl;
  if (!baseUrl) return "";
  const wsScheme = baseUrl.startsWith("https") ? "wss" : "ws";
  const host = baseUrl.replace(/^https?:\/\//, "");
  const query = playerQuery ? `?player=${encodeURIComponent(playerQuery)}` : "";
  return `${wsScheme}://${host}/milkdrop_visualizer${query}`;
}

/**
 * Whether the MilkDrop Visualizer server plugin is loaded and available.
 */
export function visualizerProviderAvailable(): boolean {
  // may run before the providers map has loaded (e.g. a cast display booting)
  return Object.values(api.providers ?? {}).some(
    (provider) =>
      provider.domain === "milkdrop_visualizer" && provider.available,
  );
}

/**
 * Whether this session can actually render the visualizer.
 *
 * The plugin being available is not enough: the canvas needs WebGL2, and a
 * remote (WebRTC) session cannot reach the relay route at all. Views gate their
 * "visualizer is on" state on this so the dark-palette / album-art-swap styling
 * is never applied over a canvas that stays transparent.
 */
export function visualizerCanRender(): boolean {
  if (api.isRemoteConnection.value) return false;
  return isVisualizerSupported();
}

/**
 * Report this display's render capabilities to the server.
 *
 * Cast and TV receivers vary wildly in graphics support and have no reachable
 * console; the server logs these reports so it is knowable which devices can
 * render MilkDrop and which cannot. Sent over the main API socket, so a
 * display that cannot render (and thus never opens a relay connection) still
 * gets its probe result recorded.
 */
export async function reportVisualizerCapability(
  renderer: "butterchurn" | "none",
): Promise<void> {
  try {
    await api.sendCommand("milkdrop_visualizer/report_capability", {
      webgl2: isVisualizerSupported(),
      renderer,
      user_agent: navigator.userAgent,
    });
  } catch (error) {
    console.warn("[visualizer] could not report capability:", error);
  }
}

/**
 * Whether the plugin is configured to show the visualizer on dashboard screens.
 *
 * Cast dashboards run as the dashboard viewer, which has no user preferences and
 * no way to set any, so this server-side setting decides for them (and provides
 * the default for anyone who has not picked one).
 */
export async function visualizerShownOnDashboards(): Promise<boolean> {
  if (!visualizerProviderAvailable()) return false;
  try {
    const config = await api.sendCommand<Record<string, boolean>>(
      "milkdrop_visualizer/config",
    );
    return config?.show_on_dashboards === true;
  } catch (error) {
    console.warn("[visualizer] could not read the plugin config:", error);
    return false;
  }
}

export class VisualizerRelayClient {
  readonly scheduler = new FrameScheduler();
  private clock = new ClockSync();
  private ws: WebSocket | null = null;
  private closed = false;
  private reconnectTimer: number | null = null;
  private timeSyncTimer: number | null = null;
  private beatTimers = new Set<number>();
  private pendingBeats: number[] = [];
  private state: RelayState = "connecting";
  private colorPalette: ColorPalette = {};

  constructor(
    private readonly callbacks: VisualizerRelayCallbacks = {},
    private readonly playerQuery?: string,
  ) {}

  connect(): void {
    this.closed = false;
    this.openSocket();
  }

  /**
   * The waveform frame that belongs to "now", or null while unsynchronized
   * or starved. Call once per animation tick.
   */
  currentFrame(): Uint8Array | null {
    const offset = this.clock.offsetUs;
    if (offset === null) return null;
    const serverNowUs = this.clientNowUs() + offset;
    return this.scheduler.pickAt(serverNowUs)?.samples ?? null;
  }

  close(): void {
    this.closed = true;
    this.clearTimers();
    this.clearBeatTimers();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: "client/goodbye",
          payload: { reason: "user_request" },
        }),
      );
    }
    this.ws?.close();
    this.ws = null;
    this.scheduler.clear();
    this.setState("closed");
  }

  private clientNowUs(): number {
    return Math.round(performance.now() * 1000);
  }

  private setState(state: RelayState): void {
    if (state === this.state) return;
    this.state = state;
    this.callbacks.onState?.(state);
  }

  private openSocket(): void {
    const url = relayUrl(this.playerQuery);
    if (!url) {
      this.scheduleReconnect();
      return;
    }
    this.setState("connecting");
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
    this.ws = ws;

    ws.onopen = () => {
      // Ingress sessions are authenticated by Home Assistant via headers;
      // everything else must send the session token first and wait for
      // auth_ok before the relay will serve frames.
      if (store.isIngressSession) {
        this.startTimeSync(ws);
        return;
      }
      ws.send(JSON.stringify({ type: "auth", token: authManager.getToken() }));
    };
    ws.onmessage = (event) => this.handleMessage(event);
    ws.onclose = (event) => {
      this.clearTimers();
      this.clearBeatTimers();
      this.clock.clear();
      this.scheduler.clear();
      // No onColor: the canvas keeps its tint across a reconnect on purpose;
      // stream/start clears it when the server no longer serves color.
      this.colorPalette = {};
      if (this.closed) return;
      if (event.code === AUTH_FAILED_CODE) {
        console.warn("[visualizer] relay authentication rejected");
        this.closed = true;
        this.setState("closed");
        return;
      }
      this.setState("waiting");
      this.scheduleReconnect();
    };
  }

  private handleMessage(event: MessageEvent): void {
    if (typeof event.data === "string") {
      let message: {
        type?: string;
        message?: string;
        payload?: Record<string, unknown>;
      };
      try {
        message = JSON.parse(event.data);
      } catch {
        console.warn("[visualizer] ignoring malformed relay message");
        return;
      }
      if (message.type === "auth_ok") {
        if (this.ws) this.startTimeSync(this.ws);
      } else if (
        message.type === "color" &&
        typeof message.payload === "object" &&
        message.payload !== null &&
        !Array.isArray(message.payload)
      ) {
        // Merge known fields only; the payload is unvalidated wire data, so it
        // has to be an object before `in` may be used on it at all, and a
        // malformed value becomes null so onColor honours the palette type.
        const payload = message.payload as Record<string, unknown>;
        const merged: ColorPalette = { ...this.colorPalette };
        for (const field of COLOR_PALETTE_FIELDS) {
          if (!(field in payload)) continue;
          const value = payload[field];
          merged[field] = isRgbTuple(value) ? value : null;
        }
        this.colorPalette = merged;
        this.callbacks.onColor?.(merged);
      } else if (message.type === "server/time" && message.payload) {
        const p = message.payload as Record<string, number>;
        // A missing/non-numeric field would produce a NaN sample, which
        // ClockSync's lowest-delay compare can keep as "best" for the whole
        // sliding window — stalling sync for minutes.
        if (
          !Number.isFinite(p.client_transmitted) ||
          !Number.isFinite(p.server_received) ||
          !Number.isFinite(p.server_transmitted)
        ) {
          console.warn("[visualizer] ignoring malformed time sync payload");
          return;
        }
        this.clock.addSample(
          computeTimeSample(
            p.client_transmitted,
            p.server_received,
            p.server_transmitted,
            this.clientNowUs(),
          ),
        );
        if (this.pendingBeats.length > 0) {
          const pending = this.pendingBeats;
          this.pendingBeats = [];
          for (const ts of pending) this.scheduleDownbeat(ts);
        }
      } else if (message.type === "stream/start") {
        // The server advertises the message types it will serve. Without
        // "color" (color_tint disabled) no color message will ever replace a
        // tint kept across a reconnect, so it has to be dropped here.
        const types = (
          message.payload as { visualizer?: { types?: unknown } } | undefined
        )?.visualizer?.types;
        if (Array.isArray(types) && !types.includes("color")) {
          this.colorPalette = {};
          this.callbacks.onColor?.({});
        }
        this.setState("streaming");
      } else if (
        message.type === "stream/clear" ||
        message.type === "stream/end"
      ) {
        // Color is not reset here: stream/clear also fires on a plain seek.
        this.scheduler.clear();
        this.clearBeatTimers();
      } else if (message.type === "error") {
        console.warn("[visualizer] relay error:", message.message);
        this.setState("waiting");
      }
      return;
    }
    const frame = parseVisualizerBinary(event.data as ArrayBuffer, N_SAMPLES);
    if (!frame) return;
    if (frame.kind === "waveform") {
      this.scheduler.push({
        timestampUs: frame.timestampUs,
        samples: frame.samples,
      });
      this.setState("streaming");
    } else if (frame.isDownbeat) {
      this.scheduleDownbeat(frame.timestampUs);
    }
  }

  private startTimeSync(ws: WebSocket): void {
    let burst = 0;
    const sendPing = () => {
      if (ws.readyState !== WebSocket.OPEN) return;
      ws.send(
        JSON.stringify({
          type: "client/time",
          payload: { client_transmitted: this.clientNowUs() },
        }),
      );
    };
    this.timeSyncTimer = window.setInterval(() => {
      sendPing();
      burst += 1;
      if (burst >= TIME_SYNC_BURST && this.timeSyncTimer !== null) {
        clearInterval(this.timeSyncTimer);
        this.timeSyncTimer = window.setInterval(
          sendPing,
          TIME_SYNC_INTERVAL_MS,
        );
      }
    }, TIME_SYNC_BURST_INTERVAL_MS);
  }

  // Beat frames carry SCHEDULED timestamps (the server pushes a whole
  // track's beat schedule ahead of time); fire the callback at each beat's
  // translated local time, not on arrival.
  private scheduleDownbeat(timestampUs: number): void {
    if (!this.callbacks.onDownbeat) return;
    const offset = this.clock.offsetUs;
    if (offset === null) {
      // Schedule bursts often arrive before the first time-sync sample;
      // hold them until the clock is available.
      this.pendingBeats.push(timestampUs);
      return;
    }
    const delayMs = (timestampUs - (this.clientNowUs() + offset)) / 1000;
    if (delayMs < -500) return; // already in the past
    const timer = window.setTimeout(
      () => {
        this.beatTimers.delete(timer);
        this.callbacks.onDownbeat?.(timestampUs);
      },
      Math.max(0, delayMs),
    );
    this.beatTimers.add(timer);
  }

  private clearBeatTimers(): void {
    for (const timer of this.beatTimers) clearTimeout(timer);
    this.beatTimers.clear();
    this.pendingBeats = [];
  }

  private scheduleReconnect(): void {
    if (this.closed || this.reconnectTimer !== null) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.closed) this.openSocket();
    }, RECONNECT_DELAY_MS);
  }

  /**
   * Tell the server why this viewer cannot render.
   *
   * Cast displays and kiosks have no reachable console, so an engine that fails
   * to start would otherwise be indistinguishable from a broken relay.
   */
  reportError(message: string): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: "client/error", message }));
  }

  private clearTimers(): void {
    if (this.timeSyncTimer !== null) {
      clearInterval(this.timeSyncTimer);
      this.timeSyncTimer = null;
    }
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
