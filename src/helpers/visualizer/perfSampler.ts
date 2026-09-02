/**
 * Render performance sampling for adaptive (TV/cast) hosts.
 *
 * Collects per-render timings into windows of PERF_SAMPLE_WINDOW_MS and emits
 * one VisualizerPerfSample per closed window. The reset and guard hooks keep
 * halts, resizes and preset compiles out of the measurements; a
 * PerformanceObserver tracks main-thread long tasks for blockedRatio. Hosts
 * without a callback get the no-op sampler, so nobody else pays for any of it.
 */

export interface VisualizerPerfSample {
  // renders actually achieved per second
  fps: number;
  // renders per second the pacing asked for (refresh rate / vsync divisor)
  targetFps: number;
  // share of renders a whole display tick late; only rises when the GPU cannot keep up
  lateRatio: number;
  // drawing-buffer pixels behind those numbers
  pixels: number;
  // mean wall time inside butterchurn's render call
  renderMs: number;
  // share of the window the main thread spent inside long tasks
  blockedRatio: number;
  // GPU section times in ms (EMA), when the driver exposes timer queries
  gpu?: { warp?: number; blur?: number; comp?: number };
  // preset on screen while the window was measured
  preset?: string;
}

const PERF_SAMPLE_WINDOW_MS = 2000;

export interface PerfRenderEvent {
  now: number;
  // when the previous render happened, or 0 right after a reset
  renderedAt: number;
  // wall time inside this render call
  renderMs: number;
  // the cadence the loop actually paces at; see pacedIntervalMs
  expectedIntervalMs: number;
  // the display tick, as lateness tolerance
  tickMs: number;
  pixels: number;
  preset: string;
  // queried lazily, only when a window closes
  gpu: () => VisualizerPerfSample["gpu"];
}

export interface PerfSampler {
  /** False for the no-op sampler; callers can skip building events then. */
  readonly enabled: boolean;
  /** Drop the open window (loop halt, hidden tab, resize). */
  reset(): void;
  /** Keep renders out of the window until the given performance.now() time. */
  guardUntil(at: number): void;
  /** Record one render; emits a sample when the window closes. */
  onRender(event: PerfRenderEvent): void;
  destroy(): void;
}

const NOOP_SAMPLER: PerfSampler = {
  enabled: false,
  reset() {},
  guardUntil() {},
  onRender() {},
  destroy() {},
};

export function createPerfSampler(
  onSample?: (sample: VisualizerPerfSample) => void,
): PerfSampler {
  if (!onSample) return NOOP_SAMPLER;

  let windowStart = 0;
  let guardUntil = 0;
  let renders = 0;
  let lateRenders = 0;
  let renderMsTotal = 0;
  let blockedMs = 0;

  const openWindow = (at: number) => {
    windowStart = at;
    renders = 0;
    lateRenders = 0;
    renderMsTotal = 0;
    blockedMs = 0;
  };

  // long tasks tell a saturated main thread apart from one idling between
  // frames
  let longTaskObserver: PerformanceObserver | null = null;
  try {
    longTaskObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) blockedMs += entry.duration;
    });
    longTaskObserver.observe({ entryTypes: ["longtask"] });
  } catch {
    longTaskObserver = null;
  }

  return {
    enabled: true,
    reset() {
      windowStart = 0;
    },
    guardUntil(at: number) {
      guardUntil = at;
    },
    onRender(event: PerfRenderEvent) {
      if (event.now < guardUntil) {
        windowStart = 0;
        return;
      }
      // the window's opening render marks the start rather than counting
      if (windowStart === 0) {
        openWindow(event.now);
        return;
      }
      // full-tick tolerance: the controller's thresholds treat "late" as
      // grossly late, not one tick shy of perfect
      if (
        event.renderedAt &&
        event.now - event.renderedAt > event.expectedIntervalMs + event.tickMs
      ) {
        // the scheduled slot passed while the previous render was still on the GPU
        lateRenders += 1;
      }
      renders += 1;
      renderMsTotal += event.renderMs;
      const elapsed = event.now - windowStart;
      if (elapsed < PERF_SAMPLE_WINDOW_MS) return;
      onSample({
        fps: (renders * 1000) / elapsed,
        targetFps: 1000 / event.expectedIntervalMs,
        lateRatio: lateRenders / renders,
        pixels: event.pixels,
        renderMs: renderMsTotal / renders,
        blockedRatio: Math.min(blockedMs / elapsed, 1),
        gpu: event.gpu(),
        preset: event.preset,
      });
      openWindow(event.now);
    },
    destroy() {
      longTaskObserver?.disconnect();
    },
  };
}
