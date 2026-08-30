import { reactive } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AudioQuality,
  CrossfadeMode,
  type Player,
  type PlayerQueue,
  type QueueItem,
  VolumeNormalizationMode,
} from "@/plugins/api/interfaces";
import { audioFidelity, audioOutputDetails } from "../fixtures/audioProcessing";
import { audioFormat } from "../fixtures/audioFormat";
import { playerQueue } from "../fixtures/playerQueue";
import { playerSource } from "../fixtures/playerSource";
import { queueItem } from "../fixtures/queueItem";
import { streamDetails } from "../fixtures/streamDetails";

const storeMock = reactive({
  activePlayer: undefined as Player | undefined,
  activePlayerQueue: undefined as PlayerQueue | undefined,
  curQueueItem: undefined as QueueItem | undefined,
});

vi.mock("@/plugins/store", () => ({ store: storeMock }));

const { useActiveAudioPath } = await import("@/composables/useActiveAudioPath");

/** A player with only the fields the composable reads. */
function player(overrides: Partial<Player> = {}): Player {
  return {
    player_id: "player-1",
    active_source: "player-1",
    source_list: [],
    ...overrides,
  } as Player;
}

beforeEach(() => {
  storeMock.activePlayer = player();
  storeMock.activePlayerQueue = undefined;
  storeMock.curQueueItem = undefined;
});

describe("useActiveAudioPath", () => {
  it("reports no active path without a queue item or source snapshot", () => {
    const { activeAudioPath, hasActiveAudioPath } = useActiveAudioPath();

    expect(activeAudioPath.value).toBeUndefined();
    expect(hasActiveAudioPath.value).toBe(false);
  });

  it("prefers the active queue item over a source snapshot", () => {
    const details = streamDetails({
      audio_processing: {
        input_fidelity: audioFidelity({ quality: AudioQuality.LOSSLESS }),
        queue_processing: null,
        outputs: [],
      },
    });
    storeMock.curQueueItem = queueItem({ streamdetails: details });
    storeMock.activePlayerQueue = playerQueue({
      crossfade_enabled: true,
      smart_fades_active: true,
    });
    // a source snapshot is present too, but the queue item must win
    storeMock.activePlayer = player({
      active_source_audio: {
        input_format: audioFormat(),
        input_fidelity: audioFidelity({ quality: AudioQuality.HI_RES }),
        crossfade_mode: CrossfadeMode.DISABLED,
        volume_normalization_mode: VolumeNormalizationMode.DISABLED,
        outputs: [],
      },
    });

    const { activeAudioPath } = useActiveAudioPath();

    expect(activeAudioPath.value).toEqual({
      kind: "queue",
      streamDetails: details,
      audioProcessing: details.audio_processing,
      crossfadeIntent: CrossfadeMode.SMART_CROSSFADE,
    });
  });

  it("omits the source snapshot on older servers that never send it", () => {
    // active_source_audio absent entirely, as an older server would send
    storeMock.activePlayer = player();

    const { activeAudioPath, hasActiveAudioPath } = useActiveAudioPath();

    expect(activeAudioPath.value).toBeUndefined();
    expect(hasActiveAudioPath.value).toBe(false);
  });

  it("resolves a live source snapshot when no queue item is active", () => {
    const source = playerSource({
      id: "spotify_connect--1://audio_source/main",
      name: "Spotify Connect",
    });
    storeMock.activePlayer = player({
      active_source: source.id,
      source_list: [source],
      active_source_audio: {
        input_format: audioFormat({ sample_rate: 48000 }),
        input_fidelity: audioFidelity({ quality: AudioQuality.LOSSLESS }),
        crossfade_mode: CrossfadeMode.DISABLED,
        volume_normalization_mode: VolumeNormalizationMode.DISABLED,
        outputs: [audioOutputDetails()],
      },
    });

    const { activeAudioPath, hasActiveAudioPath } = useActiveAudioPath();

    expect(hasActiveAudioPath.value).toBe(true);
    expect(activeAudioPath.value?.kind).toBe("source");
    expect(activeAudioPath.value?.crossfadeIntent).toBeUndefined();
    expect(activeAudioPath.value?.streamDetails.provider).toBe(
      "spotify_connect--1",
    );
    expect(activeAudioPath.value?.audioProcessing.input_fidelity.quality).toBe(
      AudioQuality.LOSSLESS,
    );
    expect(activeAudioPath.value?.audioProcessing.outputs).toEqual([
      audioOutputDetails(),
    ]);
  });

  it("hides the pill for an active queue item whose processing chain has not arrived yet", () => {
    // an active queue item with no audio_processing yet must never fall back
    // to a source snapshot, even a stale one left over from before the queue
    // took over playback
    storeMock.curQueueItem = queueItem({
      streamdetails: streamDetails({ audio_processing: null }),
    });
    storeMock.activePlayerQueue = playerQueue();
    storeMock.activePlayer = player({
      active_source_audio: {
        input_format: audioFormat(),
        input_fidelity: audioFidelity({ quality: AudioQuality.HI_RES }),
        crossfade_mode: CrossfadeMode.DISABLED,
        volume_normalization_mode: VolumeNormalizationMode.DISABLED,
        outputs: [],
      },
    });

    const { activeAudioPath, hasActiveAudioPath } = useActiveAudioPath();

    expect(activeAudioPath.value).toBeUndefined();
    expect(hasActiveAudioPath.value).toBe(false);
  });

  it("resolves the provider from active_source when the source list entry is missing", () => {
    // a sync/protocol child player may not carry the source_list entry
    // itself, but active_source still carries the provider-prefixed id
    storeMock.activePlayer = player({
      active_source: "airplay_receiver--1://audio_source/main",
      source_list: [],
      active_source_audio: {
        input_format: audioFormat(),
        input_fidelity: audioFidelity(),
        crossfade_mode: CrossfadeMode.DISABLED,
        volume_normalization_mode: VolumeNormalizationMode.DISABLED,
        outputs: [],
      },
    });

    const { activeAudioPath } = useActiveAudioPath();

    expect(activeAudioPath.value?.streamDetails.provider).toBe(
      "airplay_receiver--1",
    );
  });

  it("marks crossfade and normalization as source-applied only in SOURCE mode", () => {
    storeMock.activePlayer = player({
      active_source_audio: {
        input_format: audioFormat(),
        input_fidelity: audioFidelity(),
        crossfade_mode: CrossfadeMode.SOURCE,
        volume_normalization_mode: VolumeNormalizationMode.SOURCE,
        outputs: [],
      },
    });

    const { activeAudioPath } = useActiveAudioPath();
    const processing = activeAudioPath.value?.audioProcessing.queue_processing;

    expect(processing?.crossfade_mode).toBe(CrossfadeMode.SOURCE);
    expect(processing?.normalization?.mode).toBe(
      VolumeNormalizationMode.SOURCE,
    );
  });

  it("never fabricates crossfade or normalization outside SOURCE mode", () => {
    storeMock.activePlayer = player({
      active_source_audio: {
        input_format: audioFormat(),
        input_fidelity: audioFidelity(),
        crossfade_mode: CrossfadeMode.STANDARD_CROSSFADE,
        volume_normalization_mode: VolumeNormalizationMode.FIXED_GAIN,
        outputs: [],
      },
    });

    const { activeAudioPath } = useActiveAudioPath();
    const processing = activeAudioPath.value?.audioProcessing.queue_processing;

    expect(processing?.crossfade_mode).toBe(CrossfadeMode.DISABLED);
    expect(processing?.normalization).toBeNull();
  });

  it("passes grouped outputs through unmodified", () => {
    const outputs = [
      audioOutputDetails({ player_ids: ["p1", "p2"] }),
      audioOutputDetails({ player_ids: ["p3"] }),
    ];
    storeMock.activePlayer = player({
      active_source_audio: {
        input_format: audioFormat(),
        input_fidelity: audioFidelity(),
        crossfade_mode: CrossfadeMode.DISABLED,
        volume_normalization_mode: VolumeNormalizationMode.DISABLED,
        outputs,
      },
    });

    const { activeAudioPath } = useActiveAudioPath();

    expect(activeAudioPath.value?.audioProcessing.outputs).toEqual(outputs);
  });

  it("clears reactively when the source snapshot disappears", () => {
    storeMock.activePlayer = player({
      active_source_audio: {
        input_format: audioFormat(),
        input_fidelity: audioFidelity(),
        crossfade_mode: CrossfadeMode.DISABLED,
        volume_normalization_mode: VolumeNormalizationMode.DISABLED,
        outputs: [],
      },
    });

    const { activeAudioPath, hasActiveAudioPath } = useActiveAudioPath();
    expect(hasActiveAudioPath.value).toBe(true);

    storeMock.activePlayer!.active_source_audio = null;

    expect(hasActiveAudioPath.value).toBe(false);
    expect(activeAudioPath.value).toBeUndefined();
  });

  it("switches from a source snapshot to a queue item reactively", () => {
    storeMock.activePlayer = player({
      active_source_audio: {
        input_format: audioFormat(),
        input_fidelity: audioFidelity(),
        crossfade_mode: CrossfadeMode.DISABLED,
        volume_normalization_mode: VolumeNormalizationMode.DISABLED,
        outputs: [],
      },
    });
    const { activeAudioPath } = useActiveAudioPath();
    expect(activeAudioPath.value?.kind).toBe("source");

    const details = streamDetails({
      audio_processing: {
        input_fidelity: audioFidelity(),
        queue_processing: null,
        outputs: [],
      },
    });
    storeMock.curQueueItem = queueItem({ streamdetails: details });
    storeMock.activePlayerQueue = playerQueue();

    expect(activeAudioPath.value?.kind).toBe("queue");
  });
});
