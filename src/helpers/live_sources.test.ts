import {
  PlayerType,
  type Player,
  type PlayerSource,
} from "@/plugins/api/interfaces";
import {
  AudioLines,
  Bluetooth,
  Cable,
  Disc,
  Disc3,
  Tv,
  Usb,
} from "@lucide/vue";
import { describe, expect, it } from "vitest";
import { playerSource } from "../../tests/fixtures/playerSource";
import {
  getLiveSourceIcon,
  getLiveSourceOwnerName,
  getSelectableInputs,
  hasSelectableInput,
  liveSourcesAvailable,
  matchLiveSources,
  sortLiveSources,
} from "./live_sources";

const player = (overrides: Partial<Player> = {}) =>
  ({
    player_id: "living_room",
    name: "Living Room",
    type: PlayerType.PLAYER,
    synced_to: null,
    source_list: [],
    ...overrides,
  }) as unknown as Player;

const PLAYERS: Record<string, Player> = {
  living_room: player(),
  den: player({ player_id: "den", name: "Den" }),
  record_player: player({
    player_id: "record_player",
    name: "Record player",
    type: PlayerType.SOURCE,
  }),
};

const liveSource = (overrides: Partial<PlayerSource> = {}) =>
  playerSource({
    id: "spotify_connect--x://audio_source/living_room",
    name: "Spotify Connect",
    passive: false,
    ...overrides,
  });

const input = (id: string, name: string) =>
  playerSource({ id, name, passive: false, is_input: true });

describe("getLiveSourceOwnerName", () => {
  it("names the player a source belongs to", () => {
    const source = liveSource({ owner_player_id: "den" });
    expect(getLiveSourceOwnerName(source, PLAYERS)).toBe("Den");
  });

  it("follows a rename of that player", () => {
    const source = liveSource({ owner_player_id: "den" });
    const renamed = { ...PLAYERS, den: player({ name: "Study" }) };
    expect(getLiveSourceOwnerName(source, renamed)).toBe("Study");
  });

  it("names no player for a source of no player", () => {
    const source = liveSource({ id: "vban://audio_source/1", name: "VBAN" });
    expect(getLiveSourceOwnerName(source, PLAYERS)).toBeUndefined();
  });

  it("names no player for a device that is only an input", () => {
    const source = liveSource({
      name: "Record player",
      owner_player_id: "record_player",
    });
    expect(getLiveSourceOwnerName(source, PLAYERS)).toBeUndefined();
  });

  it("names no player the app does not know", () => {
    const source = liveSource({ owner_player_id: "gone" });
    expect(getLiveSourceOwnerName(source, PLAYERS)).toBeUndefined();
  });
});

describe("getLiveSourceIcon", () => {
  it("gives a live source that is no input the live source icon", () => {
    expect(getLiveSourceIcon(liveSource())).toBe(AudioLines);
  });

  it.each([
    ["tv", "TV", Tv],
    ["hdmi1", "HDMI 1", Tv],
    ["arc", "HDMI ARC", Tv],
    ["bluetooth", "Bluetooth", Bluetooth],
    ["usb_dac", "USB DAC", Usb],
    ["phono", "Phono", Disc3],
    ["cd", "CD", Disc],
    ["line_in", "Line-in", Cable],
    ["optical", "Optical In 1", Cable],
  ])("gives input %s (%s) its icon", (id, name, icon) => {
    expect(getLiveSourceIcon(input(id, name))).toBe(icon);
  });

  it("finds the kind of input in the name the user gave it", () => {
    const source = input("sendspin://audio_source/x", "Record player");
    expect(getLiveSourceIcon(source)).toBe(Disc3);
  });
});

describe("getSelectableInputs", () => {
  it("lists the inputs the player can switch to", () => {
    const tv = input("tv", "TV");
    const passive = { ...input("aux", "AUX"), passive: true };
    const sources = [tv, passive, liveSource()];
    expect(getSelectableInputs(player({ source_list: sources }))).toEqual([tv]);
  });
});

describe("hasSelectableInput", () => {
  it("is true for a player with an input to switch to", () => {
    expect(
      hasSelectableInput(player({ source_list: [input("tv", "TV")] })),
    ).toBe(true);
  });

  it("is false for a player with sources that are no input", () => {
    expect(hasSelectableInput(player({ source_list: [liveSource()] }))).toBe(
      false,
    );
  });

  it("is false for an input that can not be selected", () => {
    const passive = { ...input("tv", "TV"), passive: true };
    expect(hasSelectableInput(player({ source_list: [passive] }))).toBe(false);
  });

  it("is false for a player synced to another", () => {
    const synced = player({
      synced_to: "den",
      source_list: [input("tv", "TV")],
    });
    expect(hasSelectableInput(synced)).toBe(false);
  });
});

describe("liveSourcesAvailable", () => {
  it("is true with a live source", () => {
    expect(liveSourcesAvailable(true, [player()])).toBe(true);
  });

  it("is true with a player that has an input", () => {
    const players = [player(), player({ source_list: [input("tv", "TV")] })];
    expect(liveSourcesAvailable(false, players)).toBe(true);
  });

  it("is false with neither", () => {
    expect(liveSourcesAvailable(false, [player()])).toBe(false);
  });
});

describe("sortLiveSources", () => {
  it("sorts by name, and by the name of the player after that", () => {
    const sources = [
      input("line_in", "Line-in"),
      liveSource({ owner_player_id: "living_room" }),
      { ...input("line_in@den", "Line-in"), owner_player_id: "den" },
      { ...input("tv", "TV"), owner_player_id: "living_room" },
    ];
    expect(sortLiveSources(sources, PLAYERS).map((s) => s.id)).toEqual([
      "line_in",
      "line_in@den",
      "spotify_connect--x://audio_source/living_room",
      "tv",
    ]);
  });
});

describe("matchLiveSources", () => {
  const sources = [
    playerSource({ id: "phono", name: "Record player" }),
    playerSource({ id: "tv", name: "TV" }),
  ];

  it("matches a part of the name, ignoring case", () => {
    expect(matchLiveSources(sources, " RECORD ").map((s) => s.id)).toEqual([
      "phono",
    ]);
  });

  it("matches nothing for an empty term", () => {
    expect(matchLiveSources(sources, "  ")).toEqual([]);
  });
});
