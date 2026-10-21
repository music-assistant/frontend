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

const collection = (items: Audiobook[]): MediaCollection<Audiobook> =>
  ({ media_type: MediaType.COLLECTION, items }) as MediaCollection<Audiobook>;

const FINISHED = book(true, 0);
const IN_PROGRESS = book(false, 60000);
const NOT_STARTED = book(false, 0);

describe("getPlayedState", () => {
  it.each([
    [FINISHED, "fully_played"],
    [book(true, 60000), "fully_played"],
    [IN_PROGRESS, "in_progress"],
    [NOT_STARTED, undefined],
  ])("derives the state of a book", (item, expected) => {
    expect(getPlayedState(item)).toBe(expected);
  });

  it.each([
    [[FINISHED, FINISHED], "fully_played"],
    [[FINISHED, IN_PROGRESS, NOT_STARTED], "in_progress"],
    [[NOT_STARTED, IN_PROGRESS], "in_progress"],
    [[FINISHED, NOT_STARTED], undefined],
    [[NOT_STARTED, NOT_STARTED], undefined],
    [[], undefined],
  ])("derives the state of a collection from its books", (items, expected) => {
    expect(getPlayedState(collection(items))).toBe(expected);
  });
});
