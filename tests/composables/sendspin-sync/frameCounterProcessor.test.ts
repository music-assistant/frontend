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

describe("frameCounterProcessor", () => {
  it("registers under the name the composable instantiates", () => {
    expect(registeredName).toBe("sendspin-frame-counter");
  });

  it("reports running totals with the context clock, not every quantum", () => {
    const processor = new ProcessorClass();

    render(processor, REPORT_INTERVAL_QUANTA - 1, new Float32Array(128));
    expect(posted).toHaveLength(0);

    vi.stubGlobal("currentTime", 0.17);
    render(processor, 1, new Float32Array(128));

    expect(posted).toEqual([
      {
        frames: REPORT_INTERVAL_QUANTA * RENDER_QUANTUM,
        quanta: REPORT_INTERVAL_QUANTA,
        silentQuanta: 0,
        contextTime: 0.17,
      },
    ]);
  });

  it("counts a quantum the device supplied nothing for", () => {
    const processor = new ProcessorClass();
    const silent = 4;

    render(processor, silent, undefined);
    render(processor, REPORT_INTERVAL_QUANTA - silent, new Float32Array(128));

    expect(posted).toHaveLength(1);
    expect(posted[0].silentQuanta).toBe(silent);
    expect(posted[0].quanta).toBe(REPORT_INTERVAL_QUANTA);
    // The frames those quanta would have carried are simply absent.
    expect(posted[0].frames).toBe(
      (REPORT_INTERVAL_QUANTA - silent) * RENDER_QUANTUM,
    );
  });

  it("keeps the totals cumulative across reports", () => {
    const processor = new ProcessorClass();

    render(processor, REPORT_INTERVAL_QUANTA * 3, new Float32Array(128));

    expect(posted.map((report) => report.quanta)).toEqual([
      REPORT_INTERVAL_QUANTA,
      REPORT_INTERVAL_QUANTA * 2,
      REPORT_INTERVAL_QUANTA * 3,
    ]);
  });
});
