import { describe, expect, it } from "vitest";
import {
  clearAudioProcessingSnapshots,
  getAudioProcessingSnapshotGeneration,
  getMatchingAudioProcessingSnapshot,
  replaceAudioProcessingSnapshot,
  supportsAudioProcessing,
  type AudioProcessingSnapshotStore,
} from "@/plugins/api/audioProcessing";
import {
  AudioProcessingState,
  type AudioProcessingChain,
} from "@/plugins/api/interfaces";

function makeChain(
  revision: number,
  overrides: Partial<AudioProcessingChain> = {},
): AudioProcessingChain {
  return {
    queue_id: "queue-1",
    queue_item_id: "item-1",
    revision,
    state: AudioProcessingState.READY,
    ...overrides,
  };
}

describe("audio processing snapshot storage", () => {
  it("replaces an event snapshot wholesale when its revision increases", () => {
    const snapshots: AudioProcessingSnapshotStore = {};
    const first = makeChain(1, {
      outputs: [{ player_ids: ["player-1"] }],
    });
    const replacement = makeChain(2, {
      input: null,
      queue_processing: null,
    });

    expect(replaceAudioProcessingSnapshot(snapshots, "queue-1", first)).toBe(
      true,
    );
    expect(
      replaceAudioProcessingSnapshot(snapshots, "queue-1", replacement),
    ).toBe(true);
    expect(snapshots["queue-1"]).toBe(replacement);
    expect(snapshots["queue-1"].outputs).toBeUndefined();
  });

  it("rejects stale, equal, invalid, and mismatched event snapshots", () => {
    const current = makeChain(3);
    const snapshots: AudioProcessingSnapshotStore = {
      "queue-1": current,
    };

    expect(
      replaceAudioProcessingSnapshot(snapshots, "queue-1", makeChain(2)),
    ).toBe(false);
    expect(
      replaceAudioProcessingSnapshot(snapshots, "queue-1", makeChain(3)),
    ).toBe(false);
    expect(
      replaceAudioProcessingSnapshot(
        snapshots,
        "queue-1",
        makeChain(4, { queue_id: "queue-2" }),
      ),
    ).toBe(false);
    expect(
      replaceAudioProcessingSnapshot(
        snapshots,
        "queue-1",
        makeChain(Number.NaN),
      ),
    ).toBe(false);
    expect(snapshots["queue-1"]).toBe(current);
  });

  it("clears only the event queue on a null snapshot", () => {
    const other = makeChain(1, { queue_id: "queue-2" });
    const snapshots: AudioProcessingSnapshotStore = {
      "queue-1": makeChain(1),
      "queue-2": other,
    };

    expect(replaceAudioProcessingSnapshot(snapshots, "queue-1", null)).toBe(
      true,
    );
    expect(snapshots["queue-1"]).toBeUndefined();
    expect(snapshots["queue-2"]).toBe(other);
  });

  it("keeps the revision gate after a null event", () => {
    const snapshots: AudioProcessingSnapshotStore = {
      "queue-1": makeChain(3),
    };
    replaceAudioProcessingSnapshot(snapshots, "queue-1", null);

    expect(
      replaceAudioProcessingSnapshot(snapshots, "queue-1", makeChain(2)),
    ).toBe(false);
    expect(
      replaceAudioProcessingSnapshot(snapshots, "queue-1", makeChain(4)),
    ).toBe(true);
  });

  it("resets revision gates but advances generations on a full clear", () => {
    const snapshots: AudioProcessingSnapshotStore = {};
    replaceAudioProcessingSnapshot(snapshots, "queue-1", makeChain(5));
    const generationBeforeClear = getAudioProcessingSnapshotGeneration(
      snapshots,
      "queue-1",
    );

    clearAudioProcessingSnapshots(snapshots);

    expect(getAudioProcessingSnapshotGeneration(snapshots, "queue-1")).not.toBe(
      generationBeforeClear,
    );
    expect(
      replaceAudioProcessingSnapshot(snapshots, "queue-1", makeChain(1)),
    ).toBe(true);
  });
});

describe("audio processing snapshot selection", () => {
  it("returns only a snapshot matching the active queue item", () => {
    const snapshot = makeChain(1);
    const snapshots = { "queue-1": snapshot };

    expect(
      getMatchingAudioProcessingSnapshot(snapshots, "queue-1", "item-1"),
    ).toBe(snapshot);
    expect(
      getMatchingAudioProcessingSnapshot(snapshots, "queue-1", "item-2"),
    ).toBeUndefined();
    expect(
      getMatchingAudioProcessingSnapshot(snapshots, "queue-2", "item-1"),
    ).toBeUndefined();
  });

  it("gates the API at schema version 38", () => {
    expect(supportsAudioProcessing(37)).toBe(false);
    expect(supportsAudioProcessing(38)).toBe(true);
    expect(supportsAudioProcessing(undefined)).toBe(false);
  });
});
