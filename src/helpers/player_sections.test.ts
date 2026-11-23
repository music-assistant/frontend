import { PlayerType } from "@/plugins/api/interfaces";
import { describe, expect, it } from "vitest";
import { playerSections } from "./player_sections";

interface TestPlayer {
  id: string;
  type: PlayerType;
}

const player = (id: string, type: PlayerType): TestPlayer => ({ id, type });

function sectionsOf(players: TestPlayer[]) {
  return playerSections(players, (item) => item.type).map(
    ({ key, label, items }) => ({ key, label, ids: items.map(({ id }) => id) }),
  );
}

describe("playerSections", () => {
  it("lists each kind of device in a section of its own, in a fixed order", () => {
    expect(
      sectionsOf([
        player("remote", PlayerType.CONTROLLER),
        player("mic", PlayerType.SOURCE),
        player("tv", PlayerType.DISPLAY),
        player("lamp", PlayerType.LIGHT),
        player("kitchen", PlayerType.PLAYER),
      ]),
    ).toEqual([
      { key: "players", label: "players", ids: ["kitchen"] },
      { key: "lights", label: "lights", ids: ["lamp"] },
      { key: "screens", label: "screens", ids: ["tv"] },
      { key: "inputs", label: "audio_inputs", ids: ["mic"] },
      { key: "controllers", label: "controllers", ids: ["remote"] },
    ]);
  });

  it("lists displays and visualizers as screens", () => {
    expect(
      sectionsOf([
        player("tv", PlayerType.DISPLAY),
        player("projector", PlayerType.VISUALIZER),
      ]),
    ).toEqual([{ key: "screens", label: "screens", ids: ["tv", "projector"] }]);
  });

  it("lists pairs, groups and any other type under the players", () => {
    expect(
      sectionsOf([
        player("pair", PlayerType.STEREO_PAIR),
        player("party", PlayerType.GROUP),
        player("odd", PlayerType.UNKNOWN),
        // a type the server knows and this client does not
        player("surround", "multi_channel" as PlayerType),
      ]),
    ).toEqual([
      {
        key: "players",
        label: "players",
        ids: ["pair", "party", "odd", "surround"],
      },
    ]);
  });

  it("keeps the given order within a section", () => {
    expect(
      sectionsOf([
        player("b", PlayerType.LIGHT),
        player("kitchen", PlayerType.PLAYER),
        player("a", PlayerType.LIGHT),
      ])[1].ids,
    ).toEqual(["b", "a"]);
  });

  it("leaves out every section without players", () => {
    expect(sectionsOf([])).toEqual([]);
  });
});
