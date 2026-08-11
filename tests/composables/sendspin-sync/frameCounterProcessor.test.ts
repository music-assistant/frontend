import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const RENDER_QUANTUM = 128;
const REPORT_INTERVAL_QUANTA = 64;

interface Report {
  frames: number;
  quanta: number;
  silentQuanta: number;
  unconnectedQuanta: number;
  peak: number;
  contextTime: number;
}

let posted: Report[] = [];
let ProcessorClass: new () => { process(inputs: Float32Array[][]): boolean };
let registeredName = "";

/**
 * The worklet registers itself on import, so its globals have to exist first.
 *
 * It ships to the browser untranspiled and is never covered by the composable's
 * tests, which drive the port directly — this is the only place its counting
 * logic runs.
 */
beforeAll(async () => {
  class FakeAudioWorkletProcessor {
    port = { postMessage: (report: Report) => posted.push(report) };
  }
  vi.stubGlobal("AudioWorkletProcessor", FakeAudioWorkletProcessor);
  vi.stubGlobal("currentTime", 0);
  vi.stubGlobal(
    "registerProcessor",
    (name: string, processor: typeof ProcessorClass) => {
      registeredName = name;
      ProcessorClass = processor;
    },
  );

  // The processor ships as untyped JavaScript on purpose: it is loaded by
  // `addModule()` into a worklet scope, never through the app's type graph.
  // @ts-expect-error -- no declarations, and none wanted
  await import("@/composables/sendspin-sync/frameCounterProcessor.js");
});

afterAll(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  posted = [];
  vi.stubGlobal("currentTime", 0);
});

function render(
  processor: InstanceType<typeof ProcessorClass>,
  quanta: number,
  channel: Float32Array | undefined,
): void {
  const inputs = channel ? [[channel]] : [[]];
  for (let i = 0; i < quanta; i++) processor.process(inputs);
}

/** A quantum carrying a signal, so it is not counted as a dropout. */
function tone(level = 0.5): Float32Array {
  const channel = new Float32Array(RENDER_QUANTUM);
  channel[0] = level;
  channel[1] = -level;
  return channel;
}

describe("frameCounterProcessor", () => {
  it("registers under the name the composable instantiates", () => {
    expect(registeredName).toBe("sendspin-frame-counter");
  });

  it("reports running totals with the context clock, not every quantum", () => {
    const processor = new ProcessorClass();

    render(processor, REPORT_INTERVAL_QUANTA - 1, tone());
    expect(posted).toHaveLength(0);

    vi.stubGlobal("currentTime", 0.17);
    render(processor, 1, tone());

    expect(posted).toEqual([
      {
        frames: REPORT_INTERVAL_QUANTA * RENDER_QUANTUM,
        quanta: REPORT_INTERVAL_QUANTA,
        silentQuanta: 0,
        unconnectedQuanta: 0,
        peak: 0.5,
        contextTime: 0.17,
      },
    ]);
  });

  it("counts digital silence, which is how a dropout actually arrives", () => {
    const processor = new ProcessorClass();
    const dropped = 4;

    render(processor, dropped, new Float32Array(RENDER_QUANTUM));
    render(processor, REPORT_INTERVAL_QUANTA - dropped, tone());

    expect(posted).toHaveLength(1);
    expect(posted[0].silentQuanta).toBe(dropped);
    expect(posted[0].unconnectedQuanta).toBe(0);
    // Silence still carries frames, so the count alone would hide the gap.
    expect(posted[0].frames).toBe(REPORT_INTERVAL_QUANTA * RENDER_QUANTUM);
  });

  it("keeps the loudest sample of the whole run", () => {
    const processor = new ProcessorClass();

    render(processor, 1, tone(0.25));
    render(processor, 1, tone(0.75));
    render(processor, REPORT_INTERVAL_QUANTA - 2, tone(0.1));

    expect(posted[0].peak).toBe(0.75);
  });

  it("leaves the peak at zero when the microphone heard nothing", () => {
    const processor = new ProcessorClass();

    render(processor, REPORT_INTERVAL_QUANTA, new Float32Array(RENDER_QUANTUM));

    expect(posted[0].peak).toBe(0);
    expect(posted[0].silentQuanta).toBe(REPORT_INTERVAL_QUANTA);
  });

  it("separates an unconnected input from a silent one", () => {
    const processor = new ProcessorClass();

    render(processor, REPORT_INTERVAL_QUANTA, undefined);

    expect(posted[0].unconnectedQuanta).toBe(REPORT_INTERVAL_QUANTA);
    expect(posted[0].silentQuanta).toBe(0);
    expect(posted[0].frames).toBe(0);
  });

  it("keeps the totals cumulative across reports", () => {
    const processor = new ProcessorClass();

    render(processor, REPORT_INTERVAL_QUANTA * 3, tone());

    expect(posted.map((report) => report.quanta)).toEqual([
      REPORT_INTERVAL_QUANTA,
      REPORT_INTERVAL_QUANTA * 2,
      REPORT_INTERVAL_QUANTA * 3,
    ]);
  });
});
