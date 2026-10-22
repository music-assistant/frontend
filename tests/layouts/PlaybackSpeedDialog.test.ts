import PlaybackSpeedDialog from "@/layouts/default/PlayerOSD/PlaybackSpeedDialog.vue";
import {
  MediaType,
  type PlayableMediaItemType,
  type QueueItem,
} from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { queueItem } from "../fixtures/queueItem";

vi.mock("@/plugins/api", () => {
  const api = { queueCommandSetPlaybackSpeed: vi.fn() };
  return { api, default: api };
});

vi.mock("@/plugins/store", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  return {
    store: reactive({
      curQueueItem: undefined,
      dialogActive: false,
    }),
  };
});

const mockStore = store as unknown as { curQueueItem?: QueueItem };

function setPlaying(mediaType: MediaType) {
  mockStore.curQueueItem = queueItem({
    media_item: {
      media_type: mediaType,
      metadata: {},
    } as PlayableMediaItemType,
  });
}

// the dialog body is reka's, and what is under test is which item this closes
// itself on, so the shell is stubbed out
function mountDialog(open: boolean) {
  return mount(PlaybackSpeedDialog, {
    props: { open },
    global: { stubs: { Dialog: true } },
  });
}

enableAutoUnmount(afterEach);

describe("PlaybackSpeedDialog", () => {
  afterEach(() => {
    mockStore.curQueueItem = undefined;
  });

  // both the player bar and the full screen player leave this showing while the
  // queue plays on, and a track has no speed of its own to set
  it("closes itself when the queue moves to an item without a speed", async () => {
    setPlaying(MediaType.AUDIOBOOK);
    const dialog = mountDialog(true);

    setPlaying(MediaType.TRACK);
    await nextTick();

    expect(dialog.emitted("update:open")).toEqual([[false]]);
  });

  it("stays open while the item still has a speed", async () => {
    setPlaying(MediaType.AUDIOBOOK);
    const dialog = mountDialog(true);

    setPlaying(MediaType.PODCAST_EPISODE);
    await nextTick();

    expect(dialog.emitted("update:open")).toBeUndefined();
  });

  it("leaves a closed dialog alone", async () => {
    setPlaying(MediaType.AUDIOBOOK);
    const dialog = mountDialog(false);

    setPlaying(MediaType.TRACK);
    await nextTick();

    expect(dialog.emitted("update:open")).toBeUndefined();
  });
});
