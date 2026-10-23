import { describe, expect, it } from "vitest";
import { getPlayedState } from "./played_state";
import {
  MediaType,
  type Audiobook,
  type MediaCollection,
} from "../plugins/api/interfaces";

const book = (fully_played: boolean, resume_position_ms: number): Audiobook =>
  ({
    media_type: MediaType.AUDIOBOOK,
    fully_played,
    resume_position_ms,
  }) as Audiobook;

const collection = (
  fully_played: boolean,
  in_progress: boolean,
): MediaCollection<Audiobook> =>
  ({
    media_type: MediaType.COLLECTION,
    items: [] as Audiobook[],
    metadata: { fully_played, in_progress },
  }) as MediaCollection<Audiobook>;

describe("getPlayedState", () => {
  it.each([
    [book(true, 0), "fully_played"],
    [book(true, 60000), "fully_played"],
    [book(false, 60000), "in_progress"],
    [book(false, 0), undefined],
    [collection(true, false), "fully_played"],
    [collection(false, true), "in_progress"],
    [collection(false, false), undefined],
  ])("derives the played state", (item, expected) => {
    expect(getPlayedState(item)).toBe(expected);
  });
});
