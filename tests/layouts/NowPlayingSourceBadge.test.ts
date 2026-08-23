import NowPlayingSourceBadge from "@/layouts/default/PlayerOSD/NowPlayingSourceBadge.vue";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Player } from "@/plugins/api/interfaces";
import { playerSource } from "../fixtures/playerSource";

vi.mock("@/composables/useProviderIcon", async () => {
  const { computed, toValue } =
    await vi.importActual<typeof import("vue")>("vue");
  return {
    useProviderIcon: (domain: () => string | undefined) => ({
      iconDataUri: computed(() =>
        ["airplay_receiver--abc", "spotify_connect--abc"].includes(
          toValue(domain) ?? "",
        )
          ? "data:image/svg+xml;base64,PHN2Zy8+"
          : null,
      ),
      applyInvert: computed(() => false),
    }),
  };
});

vi.mock("@/plugins/store", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  return {
    store: reactive({
      activePlayer: undefined,
      activePlayerQueue: undefined,
    }),
  };
});

const { store } = await import("@/plugins/store");

enableAutoUnmount(afterEach);

function mountBadge(props: { iconOnly?: boolean; plain?: boolean } = {}) {
  return mount(NowPlayingSourceBadge, {
    props,
    global: {
      mocks: { $t: (key: string, args: string[]) => `${key}:${args?.[0]}` },
      // ProviderIcon fetches its artwork from the real api singleton
      stubs: { ProviderIcon: { template: "<i data-provider-icon />" } },
    },
  });
}

function activateSource(id: string, name: string) {
  const source = playerSource({ id, name });
  store.activePlayer = {
    player_id: "player-1",
    powered: true,
    active_source: source.id,
    source_list: [source],
  } as unknown as Player;
}

beforeEach(() => {
  store.activePlayer = {
    player_id: "player-1",
    powered: true,
    active_source: "player-1",
    source_list: [],
  } as unknown as Player;
  store.activePlayerQueue = undefined;
});

describe("NowPlayingSourceBadge", () => {
  it("names the active source and labels it for assistive tech", () => {
    activateSource(
      "spotify_connect--abc://audio_source/main",
      "Spotify Connect",
    );

    const badge = mountBadge();

    expect(badge.text()).toContain("Spotify Connect");
    expect(badge.get("[data-slot=badge]").attributes("title")).toBe(
      "tooltip.playing_from:Spotify Connect",
    );
    expect(badge.find("img").exists()).toBe(true);
    expect(badge.find(".now-playing-source__fallback").exists()).toBe(false);
  });

  it("uses the AirPlay provider icon", () => {
    activateSource("airplay_receiver--abc://audio_source/main", "AirPlay");

    const badge = mountBadge();

    expect(badge.find("img").exists()).toBe(true);
    expect(badge.find(".now-playing-source__fallback").exists()).toBe(false);
  });

  it("renders nothing while the Music Assistant queue is active", () => {
    expect(mountBadge().find("[data-slot=badge]").exists()).toBe(false);
  });

  it.each([
    ["line-in", "Line In"],
    ["unknown--abc://audio_source/main", "Unknown source"],
  ])("falls back to a generic icon for %s", (id, name) => {
    activateSource(id, name);

    const badge = mountBadge();

    expect(badge.find("img").exists()).toBe(false);
    expect(badge.find(".now-playing-source__fallback").exists()).toBe(true);
  });

  it("hands the name to the tooltip when only the icon is asked for", () => {
    activateSource("line-in", "Line In");

    const badge = mountBadge({ iconOnly: true });

    expect(badge.text()).not.toContain("Line In");
    expect(badge.find(".now-playing-source__fallback").exists()).toBe(true);
    expect(badge.get("[data-slot=badge]").attributes("title")).toBe(
      "tooltip.playing_from:Line In",
    );
  });

  // the player bars have a background of their own, so the badge sheds its
  // pill there and lines up with the text around it
  it("drops the pill when asked to render plain", () => {
    activateSource("line-in", "Line In");

    const pill = mountBadge().get("[data-slot=badge]").classes();
    const plain = mountBadge({ plain: true })
      .get("[data-slot=badge]")
      .classes();

    expect(pill).toContain("bg-background/40");
    expect(plain).not.toContain("bg-background/40");
    expect(plain).toEqual(
      expect.arrayContaining(["border-0", "bg-transparent", "px-0"]),
    );
  });
});
