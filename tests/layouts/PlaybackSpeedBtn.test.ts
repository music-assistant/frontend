import PlaybackSpeedBtn from "@/layouts/default/PlayerOSD/PlayerControlBtn/PlaybackSpeedBtn.vue";
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
  const api = {
    queueCommandSetPlaybackSpeed: vi.fn(),
    providers: {},
    players: {},
  };
  return { api, default: api };
});

// the label is built from a placeholder, so the args have to come through with it
vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, args?: unknown[]) =>
    args ? `${key}(${args.join(",")})` : key,
}));

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

function setPlaying(mediaType: MediaType, playbackSpeed?: number) {
  mockStore.curQueueItem = queueItem({
    media_item: {
      media_type: mediaType,
      metadata: {},
    } as PlayableMediaItemType,
    extra_attributes: { playback_speed: playbackSpeed },
  });
}

function mountButton() {
  return mount(PlaybackSpeedBtn, {
    global: { stubs: { PlaybackSpeedDialog: true } },
  });
}

enableAutoUnmount(afterEach);

describe("PlaybackSpeedBtn", () => {
  afterEach(() => {
    mockStore.curQueueItem = undefined;
  });

  // the speed is a per-item setting, so it only belongs to the spoken-word
  // content that carries one
  it.each([
    { mediaType: MediaType.AUDIOBOOK, offered: true },
    { mediaType: MediaType.PODCAST_EPISODE, offered: true },
    { mediaType: MediaType.TRACK, offered: false },
    { mediaType: MediaType.RADIO, offered: false },
  ])("offers the speed for $mediaType: $offered", ({ mediaType, offered }) => {
    setPlaying(mediaType);

    expect(mountButton().find("button").exists()).toBe(offered);
  });

  it("shows nothing while there is no playing item", () => {
    expect(mountButton().find("button").exists()).toBe(false);
  });

  // the x comes from the translation, so what the button settles is the value
  it.each([
    { speed: undefined, reads: "1.0" },
    { speed: 1.25, reads: "1.25" },
    { speed: 2, reads: "2.0" },
  ])("reads a speed of $speed as $reads", ({ speed, reads }) => {
    setPlaying(MediaType.AUDIOBOOK, speed);

    expect(mountButton().get("button").text()).toBe(
      `playback_speed_value(${reads})`,
    );
  });

  it("opens the speed dialog on click", async () => {
    setPlaying(MediaType.AUDIOBOOK);
    const button = mountButton();

    expect(button.findComponent(PlaybackSpeedDialog).props("open")).toBe(false);

    await button.get("button").trigger("click");

    expect(button.findComponent(PlaybackSpeedDialog).props("open")).toBe(true);
  });

  // the dialog closes itself on an item with no speed to set, so what matters
  // here is that it is never taken down and put back up: it would come back
  // open, over whatever the queue had moved on to
  it("keeps the dialog mounted across a change of item", async () => {
    setPlaying(MediaType.AUDIOBOOK);
    const button = mountButton();

    expect(button.findComponent(PlaybackSpeedDialog).exists()).toBe(true);

    setPlaying(MediaType.TRACK);
    await nextTick();

    expect(button.find("button").exists()).toBe(false);
    expect(button.findComponent(PlaybackSpeedDialog).exists()).toBe(true);
  });
});
