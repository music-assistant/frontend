import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ProtocolRole,
  type Player,
  type PlayerMedia,
} from "@/plugins/api/interfaces";
import { playerSource } from "../../tests/fixtures/playerSource";
import { useNowPlayingSource } from "./nowPlayingSource";

const { api, store } = vi.hoisted(() => ({
  api: { providerManifests: {} as Record<string, { name: string }> },
  store: { activePlayer: undefined as Player | undefined },
}));
vi.mock("@/plugins/api", () => ({ api, default: api }));
vi.mock("@/plugins/store", () => ({
  store: {
    get activePlayer() {
      return store.activePlayer;
    },
    activePlayerQueue: undefined,
  },
}));

const livePlayer = (media: Partial<PlayerMedia>, protocolName?: string) => {
  if (protocolName) api.providerManifests.airplay = { name: protocolName };
  return {
    player_id: "speaker",
    powered: true,
    active_source: "line-in",
    active_output_protocol: undefined,
    source_list: [playerSource({ id: "line-in", name: "Line In" })],
    protocols: protocolName
      ? [{ domain: "airplay", active: true, role: ProtocolRole.AUDIO }]
      : [],
    current_media: media as PlayerMedia,
  } as unknown as Player;
};

describe("useNowPlayingSource", () => {
  beforeEach(() => {
    api.providerManifests = {};
    store.activePlayer = undefined;
  });

  it("names a source that differs from the title", () => {
    store.activePlayer = livePlayer({ title: "Some Song" });
    const { nowPlayingSource } = useNowPlayingSource();
    expect(nowPlayingSource.value?.label).toBe("Line In");
  });

  it("names a source for media without a title", () => {
    store.activePlayer = livePlayer({ title: null });
    const { nowPlayingSource } = useNowPlayingSource();
    expect(nowPlayingSource.value?.label).toBe("Line In");
  });

  it("leaves out a source that is already the title", () => {
    store.activePlayer = livePlayer({ title: "Line In" });
    const { nowPlayingSource } = useNowPlayingSource();
    expect(nowPlayingSource.value).toBeUndefined();
  });

  it("leaves out a source that is the title when its label names a protocol", () => {
    store.activePlayer = livePlayer({ title: "Line In" }, "AirPlay");
    const { nowPlayingSource } = useNowPlayingSource();
    expect(nowPlayingSource.value).toBeUndefined();
  });

  it("names a source whose title differs when its label names a protocol", () => {
    store.activePlayer = livePlayer({ title: "Some Song" }, "AirPlay");
    const { nowPlayingSource } = useNowPlayingSource();
    expect(nowPlayingSource.value?.label).toBe("Line In • AirPlay");
  });

  it("still hides an album that repeats the source", () => {
    store.activePlayer = livePlayer({ title: "Line In", album: "Line In" });
    const { albumSubtitle } = useNowPlayingSource();
    expect(albumSubtitle.value).toBe("");
  });
});
