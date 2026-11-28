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
const BATCH_FRAMES = 4096;

interface Batch {
  startFrame: number;
  dropouts: number;
  lostFrames: number;
  samples: Float32Array;
}

interface Processor {
  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean;
  port: { onmessage: ((event: { data: unknown }) => void) | null };
}

let posted: Batch[] = [];
let ProcessorClass: new () => Processor;
let registeredName = "";
/** The render clock, in frames, standing where the next quantum begins. */
let clock = 0;

/**
 * The worklet registers itself on import, so its globals have to exist first.
 *
 * It ships to the browser untranspiled and is never covered by the composable's
 * tests, which drive the port directly — this is the only place its buffering
 * and frame counting actually run.
 */
beforeAll(async () => {
  class FakeAudioWorkletProcessor {
    port = {
      onmessage: null,
      postMessage: (batch: Batch, transfer?: unknown[]) => {
        // The real port transfers the buffer away, so a processor that reused it
        // would corrupt the batch already posted. Copying here keeps the
        // assertions honest about what was sent at the time.
        posted.push({ ...batch, samples: Float32Array.from(batch.samples) });
        expect(transfer).toEqual([batch.samples.buffer]);
      },
    };
  }
  vi.stubGlobal("AudioWorkletProcessor", FakeAudioWorkletProcessor);
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
  await import("@/composables/sendspin-sync/chirpCaptureProcessor.js");
});

afterAll(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  posted = [];
  tick(0);
});

/** Put the render clock at `frames`, where the worklet reads it. */
function tick(frames: number): void {
  clock = frames;
  vi.stubGlobal("currentFrame", clock);
}

/** Run `quanta` render quanta, filling each input frame from `fill`. */
function render(
  processor: Processor,
  quanta: number,
  fill?: (frame: number) => number,
): void {
  for (let quantum = 0; quantum < quanta; quantum++) {
    const outputs = [[new Float32Array(RENDER_QUANTUM)]];
    const inputs = fill
      ? [
          [
            Float32Array.from({ length: RENDER_QUANTUM }, (_, index) =>
              fill(clock + index),
            ),
          ],
        ]
      : [[]];
    processor.process(inputs as Float32Array[][], outputs);
    tick(clock + RENDER_QUANTUM);
  }
}

/**
 * Advance the render clock past `quanta` the worklet is never called for.
 *
 * What a stalled audio thread does: the engine keeps the clock, `process` simply
 * does not run, and nothing at all is heard for that whole stretch.
 */
function stall(quanta: number): void {
  tick(clock + quanta * RENDER_QUANTUM);
}

function arm(processor: Processor, armed: boolean): void {
  processor.port.onmessage?.({ data: { armed } });
}

describe("chirpCaptureProcessor", () => {
  it("registers under the name the composable asks for", () => {
    expect(registeredName).toBe("sendspin-chirp-capture");
  });

  it("posts nothing until it is armed", () => {
    const processor = new ProcessorClass();
    render(processor, 40, (frame) => frame);

    expect(posted).toHaveLength(0);
  });

  it("posts full batches of the samples it was handed", () => {
    const processor = new ProcessorClass();
    arm(processor, true);
    render(processor, BATCH_FRAMES / RENDER_QUANTUM, (frame) => frame + 1);

    expect(posted).toHaveLength(1);
    expect(posted[0].samples).toHaveLength(BATCH_FRAMES);
    expect(posted[0].startFrame).toBe(0);
    expect(posted[0].samples[0]).toBe(1);
    expect(posted[0].samples[BATCH_FRAMES - 1]).toBe(BATCH_FRAMES);
  });

  it("flushes what it has when it is disarmed mid-batch", () => {
    const processor = new ProcessorClass();
    arm(processor, true);
    render(processor, 3, (frame) => frame + 1);
    arm(processor, false);

    expect(posted).toHaveLength(1);
    expect(posted[0].samples).toHaveLength(3 * RENDER_QUANTUM);
  });

  it("keeps counting frames while disarmed, so recordings share one clock", () => {
    const processor = new ProcessorClass();

    // Walking to the next speaker: recorded by nobody, but the audio clock ran.
    render(processor, 100);
    arm(processor, true);
    render(processor, 2, (frame) => frame + 1);
    arm(processor, false);

    // Without a continuous counter this would start at 0 again, and every arrival
    // in this recording would be timed as if it happened at the start of the run.
    expect(posted[0].startFrame).toBe(100 * RENDER_QUANTUM);
  });

  it("numbers consecutive batches so they join without a gap", () => {
    const processor = new ProcessorClass();
    arm(processor, true);
    render(processor, (2 * BATCH_FRAMES) / RENDER_QUANTUM, (frame) => frame);

    expect(posted).toHaveLength(2);
    expect(posted[0].startFrame).toBe(0);
    expect(posted[1].startFrame).toBe(BATCH_FRAMES);
    expect(posted[1].samples[0]).toBe(BATCH_FRAMES);
  });

  it("contributes silence for a quantum the device did not deliver", () => {
    const processor = new ProcessorClass();
    arm(processor, true);
    render(processor, 1, (frame) => frame + 1);
    render(processor, 1);
    render(processor, 1, () => 7);
    arm(processor, false);

    const { samples, dropouts, lostFrames } = posted[0];
    // The dropped quantum still takes up its frames: dropping them instead would
    // pull every later arrival earlier by the length of the gap.
    expect(samples).toHaveLength(3 * RENDER_QUANTUM);
    expect(samples[RENDER_QUANTUM]).toBe(0);
    expect(samples[2 * RENDER_QUANTUM - 1]).toBe(0);
    expect(samples[2 * RENDER_QUANTUM]).toBe(7);
    expect(dropouts).toBe(1);
    expect(lostFrames).toBe(RENDER_QUANTUM);
  });

  it("numbers batches on the render clock across a stalled audio thread", () => {
    const processor = new ProcessorClass();
    arm(processor, true);
    render(processor, 2, (frame) => frame + 1);
    stall(3);
    render(processor, 2, () => 9);
    arm(processor, false);

    // The samples either side of the stall go out separately, each numbered where
    // the clock says it starts. A tally of delivered frames would have numbered
    // the second batch at 256 and closed the hole up, pulling every arrival in it
    // — and in every recording after it — three quanta early.
    expect(posted).toHaveLength(2);
    expect(posted[0].startFrame).toBe(0);
    expect(posted[0].samples).toHaveLength(2 * RENDER_QUANTUM);
    expect(posted[1].startFrame).toBe(5 * RENDER_QUANTUM);
    expect(posted[1].samples).toHaveLength(2 * RENDER_QUANTUM);
    // Counted onto the batch the stall interrupted rather than the one after it,
    // so a recording that ends mid-batch still carries the loss.
    expect(posted[0].dropouts).toBe(3);
    expect(posted[0].lostFrames).toBe(3 * RENDER_QUANTUM);
  });

  it("does not count a stall it was not recording through", () => {
    const processor = new ProcessorClass();
    render(processor, 5);
    // Carried upstairs while the phone was busy elsewhere.
    stall(40);
    arm(processor, true);
    render(processor, 2, () => 1);
    arm(processor, false);

    // The clock accounted for the walk, stall and all, so this recording is
    // numbered where it really begins. Nothing was lost from it: no chirp was
    // being listened for, which is why the silences between speakers are free.
    expect(posted[0].startFrame).toBe(45 * RENDER_QUANTUM);
    expect(posted[0].dropouts).toBe(0);
    expect(posted[0].lostFrames).toBe(0);
  });

  it("falls back to counting quanta where the scope has no render clock", () => {
    // Older worklet scopes expose no `currentFrame`. Counting is exact for a
    // quantum that ran and was handed nothing, and blind to one that never ran —
    // so the recording is still numbered continuously from the graph being built.
    vi.stubGlobal("currentFrame", undefined);
    const processor = new ProcessorClass();
    render(processor, 10);
    arm(processor, true);
    render(processor, 1, () => 5);
    render(processor, 1);
    arm(processor, false);

    expect(posted[0].startFrame).toBe(10 * RENDER_QUANTUM);
    expect(posted[0].samples).toHaveLength(2 * RENDER_QUANTUM);
    expect(posted[0].dropouts).toBe(1);
  });

  it("ignores a repeated arm and keeps the batch it is filling", () => {
    const processor = new ProcessorClass();
    arm(processor, true);
    render(processor, 2, () => 1);
    arm(processor, true);
    render(processor, 1, () => 1);
    arm(processor, false);

    expect(posted).toHaveLength(1);
    expect(posted[0].samples).toHaveLength(3 * RENDER_QUANTUM);
  });
});
