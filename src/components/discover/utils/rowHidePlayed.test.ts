import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  RecommendationFolderType,
  type RecommendationFolder,
} from "@/plugins/api/interfaces";

const { storeMock } = vi.hoisted(() => ({
  storeMock: {
    currentUser: null as { preferences?: Record<string, unknown> } | null,
  },
}));

vi.mock("@/plugins/store", () => ({ store: storeMock }));

import {
  rowHidePlayedKey,
  rowHidesPlayed,
  rowSupportsHidePlayed,
} from "./rowHidePlayed";

const ROW_ID = "library://folder/latest_episodes";

const folder = (
  supports_hide_played = true,
  type: RecommendationFolderType = RecommendationFolderType.DEFAULT,
): RecommendationFolder =>
  ({ supports_hide_played, type }) as RecommendationFolder;

describe("rowSupportsHidePlayed", () => {
  it("is offered on a row the server marks as supporting it", () => {
    expect(rowSupportsHidePlayed(folder())).toBe(true);
  });

  it("is not offered on a row without support", () => {
    expect(rowSupportsHidePlayed(folder(false))).toBe(false);
  });

  it("is never offered on a timeline row", () => {
    expect(
      rowSupportsHidePlayed(folder(true, RecommendationFolderType.TIMELINE)),
    ).toBe(false);
  });
});

describe("rowHidesPlayed", () => {
  beforeEach(() => {
    storeMock.currentUser = { preferences: {} };
  });

  it("follows the saved choice for the row", () => {
    expect(rowHidesPlayed(folder(), ROW_ID)).toBe(false);

    storeMock.currentUser!.preferences![rowHidePlayedKey(ROW_ID)] = true;

    expect(rowHidesPlayed(folder(), ROW_ID)).toBe(true);
  });

  it("ignores a choice saved for a row that no longer supports it", () => {
    storeMock.currentUser!.preferences![rowHidePlayedKey(ROW_ID)] = true;

    expect(rowHidesPlayed(folder(false), ROW_ID)).toBe(false);
  });
});
