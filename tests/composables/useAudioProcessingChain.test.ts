import { flushPromises } from "@vue/test-utils";
import {
  effectScope,
  nextTick,
  reactive,
  ref,
  type EffectScope,
  type Ref,
} from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AudioProcessingChain,
  PlayerQueue,
  StreamDetails,
} from "@/plugins/api/interfaces";
import {
  ContentType,
  MediaType,
  PlaybackState,
  RepeatMode,
} from "@/plugins/api/interfaces";
import {
  clearAudioProcessingSnapshots,
  replaceAudioProcessingSnapshot,
  type AudioProcessingSnapshotStore,
} from "@/plugins/api/audioProcessing";

interface MockApi {
  serverInfo: Ref<{ schema_version: number } | undefined>;
  state: Ref<string>;
  audioProcessingChains: AudioProcessingSnapshotStore;
  getAudioProcessingChain: ReturnType<typeof vi.fn>;
}

const apiMock = vi.hoisted(() => ({
  current: undefined as MockApi | undefined,
}));

vi.mock("@/plugins/api", async () => {
  const { reactive, ref } = await import("vue");
  const ConnectionState = {
    AUTHENTICATED: "authenticated",
    INITIALIZED: "initialized",
    RECONNECTING: "reconnecting",
  };
  const api: MockApi = {
    serverInfo: ref(),
    state: ref("disconnected"),
    audioProcessingChains: reactive({}),
    getAudioProcessingChain: vi.fn(),
  };
  apiMock.current = api;
  return { default: api, api, ConnectionState };
});

import { ConnectionState } from "@/plugins/api";
import {
  selectAudioProcessingSource,
  useAudioProcessingChain,
} from "@/composables/useAudioProcessingChain";

let scope: EffectScope | undefined;

beforeEach(() => {
  const api = getApi();
  api.serverInfo.value = { schema_version: 38 };
  api.state.value = ConnectionState.AUTHENTICATED;
  api.getAudioProcessingChain.mockReset();
  clearAudioProcessingSnapshots(api.audioProcessingChains);
});

afterEach(() => {
  scope?.stop();
  scope = undefined;
});

describe("useAudioProcessingChain", () => {
  it("fetches and selects the active queue snapshot", async () => {
    const snapshot = makeChain(1);
    getApi().getAudioProcessingChain.mockResolvedValue(snapshot);
    const queue = ref<PlayerQueue | undefined>(makeQueue("item-1"));
    const result = runComposable(queue);

    await flushPromises();

    expect(getApi().getAudioProcessingChain).toHaveBeenCalledWith("queue-1");
    expect(result.chain.value).toStrictEqual(snapshot);
  });

  it("refreshes after reconnect and when the active queue item changes", async () => {
    const queue = ref<PlayerQueue | undefined>(makeQueue("item-1"));
    getApi().getAudioProcessingChain.mockResolvedValueOnce(makeChain(1));
    const result = runComposable(queue);
    await flushPromises();

    getApi().state.value = ConnectionState.RECONNECTING;
    await nextTick();
    getApi().getAudioProcessingChain.mockResolvedValueOnce(makeChain(2));
    getApi().state.value = ConnectionState.AUTHENTICATED;
    await flushPromises();

    const secondItem = makeChain(3, { queue_item_id: "item-2" });
    getApi().getAudioProcessingChain.mockResolvedValueOnce(secondItem);
    queue.value = makeQueue("item-2");
    await flushPromises();

    expect(getApi().getAudioProcessingChain).toHaveBeenCalledTimes(3);
    expect(result.chain.value).toStrictEqual(secondItem);
  });

  it("does not call the command on older servers", async () => {
    getApi().serverInfo.value = { schema_version: 37 };
    const result = runComposable(
      ref<PlayerQueue | undefined>(makeQueue("item-1")),
    );

    await flushPromises();

    expect(getApi().getAudioProcessingChain).not.toHaveBeenCalled();
    expect(result.isSupported.value).toBe(false);
    expect(result.chain.value).toBeUndefined();
  });

  it("does not restore a snapshot fetched before a null event", async () => {
    let resolveFetch!: (snapshot: AudioProcessingChain) => void;
    getApi().getAudioProcessingChain.mockReturnValue(
      new Promise<AudioProcessingChain>((resolve) => {
        resolveFetch = resolve;
      }),
    );
    const result = runComposable(
      ref<PlayerQueue | undefined>(makeQueue("item-1")),
    );
    await nextTick();

    replaceAudioProcessingSnapshot(
      getApi().audioProcessingChains,
      "queue-1",
      null,
    );
    resolveFetch(makeChain(1));
    await flushPromises();

    expect(getApi().audioProcessingChains["queue-1"]).toBeUndefined();
    expect(result.chain.value).toBeUndefined();
  });

  it("does not restore a snapshot fetched before a full clear", async () => {
    let resolveFetch!: (snapshot: AudioProcessingChain) => void;
    getApi().getAudioProcessingChain.mockReturnValue(
      new Promise<AudioProcessingChain>((resolve) => {
        resolveFetch = resolve;
      }),
    );
    const result = runComposable(
      ref<PlayerQueue | undefined>(makeQueue("item-1")),
    );
    await nextTick();

    clearAudioProcessingSnapshots(getApi().audioProcessingChains);
    resolveFetch(makeChain(1));
    await flushPromises();

    expect(getApi().audioProcessingChains["queue-1"]).toBeUndefined();
    expect(result.chain.value).toBeUndefined();
  });

  it("fetches on activation and cancels a delayed fetch on deactivation", async () => {
    let resolveFetch!: (snapshot: AudioProcessingChain) => void;
    const delayedFetch = new Promise<AudioProcessingChain>((resolve) => {
      resolveFetch = resolve;
    });
    const freshSnapshot = makeChain(2);
    getApi()
      .getAudioProcessingChain.mockReturnValueOnce(delayedFetch)
      .mockResolvedValueOnce(freshSnapshot);
    const activeQueue = makeQueue("item-1", false);
    const queue = ref<PlayerQueue | undefined>(activeQueue);
    const result = runComposable(queue);

    expect(getApi().getAudioProcessingChain).not.toHaveBeenCalled();
    activeQueue.active = true;
    expect(getApi().getAudioProcessingChain).toHaveBeenCalledTimes(1);

    activeQueue.active = false;
    resolveFetch(makeChain(1));
    await flushPromises();

    expect(getApi().audioProcessingChains["queue-1"]).toBeUndefined();
    expect(result.chain.value).toBeUndefined();

    activeQueue.active = true;
    await flushPromises();

    expect(getApi().getAudioProcessingChain).toHaveBeenCalledTimes(2);
    expect(result.chain.value).toStrictEqual(freshSnapshot);
  });
});

describe("selectAudioProcessingSource", () => {
  it("uses the snapshot exclusively on supported servers", () => {
    const chain = makeChain(1);
    const legacy = makeLegacyStreamDetails();

    expect(selectAudioProcessingSource(true, chain, legacy)).toEqual({
      audioProcessingChain: chain,
    });
    expect(selectAudioProcessingSource(true, undefined, legacy)).toEqual({
      audioProcessingChain: undefined,
    });
  });

  it("uses legacy stream details only on unsupported servers", () => {
    const chain = makeChain(1);
    const legacy = makeLegacyStreamDetails();

    expect(selectAudioProcessingSource(false, chain, legacy)).toEqual({
      streamDetails: legacy,
    });
  });
});

function runComposable(queue: Ref<PlayerQueue | undefined>) {
  scope = effectScope();
  let result!: ReturnType<typeof useAudioProcessingChain>;
  scope.run(() => {
    result = useAudioProcessingChain(queue);
  });
  return result;
}

function getApi(): MockApi {
  if (!apiMock.current) throw new Error("API mock was not initialized");
  return apiMock.current;
}

function makeChain(
  revision: number,
  overrides: Partial<AudioProcessingChain> = {},
): AudioProcessingChain {
  return {
    queue_id: "queue-1",
    queue_item_id: "item-1",
    revision,
    ...overrides,
  };
}

function makeQueue(queueItemId: string, active = true): PlayerQueue {
  return reactive({
    queue_id: "queue-1",
    active,
    display_name: "Queue",
    available: true,
    items: 1,
    shuffle_enabled: false,
    smart_shuffle_active: false,
    autoplay_enabled: false,
    repeat_mode: RepeatMode.OFF,
    crossfade_enabled: false,
    smart_fades_active: false,
    overlay_enabled: false,
    overlay_volume: 100,
    elapsed_time: 0,
    elapsed_time_last_updated: 0,
    state: PlaybackState.PLAYING,
    current_item: {
      queue_id: "queue-1",
      queue_item_id: queueItemId,
      name: "Track",
      duration: 180,
      sort_index: 0,
      available: true,
    },
    sources: [],
    enqueued_media_items: [],
    is_dynamic: false,
  });
}

function makeLegacyStreamDetails(): StreamDetails {
  return {
    provider: "test",
    item_id: "track-1",
    media_type: MediaType.TRACK,
    audio_format: {
      content_type: ContentType.FLAC,
      codec_type: ContentType.FLAC,
      sample_rate: 44100,
      bit_depth: 16,
      channels: 2,
      output_format_str: "",
      bit_rate: 0,
    },
  };
}
