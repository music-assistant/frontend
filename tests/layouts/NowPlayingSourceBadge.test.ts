import NowPlayingSourceBadge from "@/layouts/default/PlayerOSD/NowPlayingSourceBadge.vue";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Player, PlayerQueue, QueueItem } from "@/plugins/api/interfaces";
import { audioSource } from "../fixtures/audioSource";
import { providerMapping } from "../fixtures/providerMapping";
import { queueItem } from "../fixtures/queueItem";
import { track } from "../fixtures/track";

const { apiMock } = vi.hoisted(() => ({
  apiMock: { queues: {} as Record<string, unknown> },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));

vi.mock("@/plugins/store", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  return {
    store: reactive({
      activePlayer: undefined,
      activePlayerQueue: undefined,
      curQueueItem: undefined,
    }),
  };
});

const { store } = await import("@/plugins/store");

enableAutoUnmount(afterEach);

function mountBadge() {
  return mount(NowPlayingSourceBadge, {
    global: {
      mocks: { $t: (key: string, args: string[]) => `${key}:${args?.[0]}` },
      // ProviderIcon fetches its artwork from the real api singleton
      stubs: { ProviderIcon: { template: "<i data-provider-icon />" } },
    },
  });
}

function playing(item: QueueItem) {
  store.activePlayerQueue = { queue_id: "player-1" } as PlayerQueue;
  store.curQueueItem = item;
}

beforeEach(() => {
  store.activePlayer = {
    player_id: "player-1",
    powered: true,
    active_source: "player-1",
    source_list: [],
  } as unknown as Player;
  store.activePlayerQueue = undefined;
  store.curQueueItem = undefined;
});

describe("NowPlayingSourceBadge", () => {
  it("names the active source and labels it for assistive tech", () => {
    playing(
      queueItem({
        media_item: audioSource({
          name: "Spotify Connect",
          provider_mappings: [
            providerMapping({ provider_domain: "spotify_connect" }),
          ],
        }),
      }),
    );

    const badge = mountBadge();

    expect(badge.text()).toContain("Spotify Connect");
    expect(badge.get("[data-slot=badge]").attributes("title")).toBe(
      "tooltip.playing_from:Spotify Connect",
    );
    expect(badge.find("[data-provider-icon]").exists()).toBe(true);
  });

  it("renders nothing while the media names itself", () => {
    playing(queueItem({ media_item: track() }));

    expect(mountBadge().find("[data-slot=badge]").exists()).toBe(false);
  });

  it("drops the icon for a source with no provider behind it", () => {
    store.activePlayer = {
      player_id: "player-1",
      powered: true,
      active_source: "line-in",
      source_list: [{ id: "line-in", name: "Line In" }],
    } as unknown as Player;

    const badge = mountBadge();

    expect(badge.text()).toContain("Line In");
    expect(badge.find("[data-provider-icon]").exists()).toBe(false);
  });
});
