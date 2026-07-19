import type { MusicQuizPlaybackOptions } from "@/composables/useMusicQuiz";
import {
  reconcileMusicQuizPlaybackSelection,
  type MusicQuizPlaybackSelection,
} from "@/helpers/music_quiz_playback";
import { describe, expect, it } from "vitest";

const PLAYBACK_OPTIONS = {
  default_playback_mode: "venue",
  default_venue_player_id: "living-room",
  venue_available: true,
  remote_available: true,
  venue_players: [
    { player_id: "living-room", name: "Living Room" },
    { player_id: "kitchen", name: "Kitchen" },
  ],
} satisfies MusicQuizPlaybackOptions;

describe("reconcileMusicQuizPlaybackSelection", () => {
  it("initializes from server defaults", () => {
    expect(reconcile({ mode: null, venuePlayerId: null })).toEqual({
      mode: "venue",
      venuePlayerId: "living-room",
    });
  });

  it("retains an available remote mode", () => {
    expect(reconcile({ mode: "remote", venuePlayerId: "living-room" })).toEqual(
      {
        mode: "remote",
        venuePlayerId: "living-room",
      },
    );
  });

  it("retains an available venue speaker", () => {
    expect(reconcile({ mode: "venue", venuePlayerId: "kitchen" })).toEqual({
      mode: "venue",
      venuePlayerId: "kitchen",
    });
  });

  it("falls back from a stale venue speaker while remote is selected", () => {
    expect(reconcile({ mode: "remote", venuePlayerId: "bedroom" })).toEqual({
      mode: "remote",
      venuePlayerId: "living-room",
    });
  });

  it("falls back when the remembered mode is unavailable", () => {
    expect(
      reconcile(
        { mode: "remote", venuePlayerId: "kitchen" },
        { ...PLAYBACK_OPTIONS, remote_available: false },
      ),
    ).toEqual({
      mode: "venue",
      venuePlayerId: "kitchen",
    });
  });

  it("falls back from Venue when no speakers remain", () => {
    expect(
      reconcile(
        { mode: "venue", venuePlayerId: "kitchen" },
        {
          ...PLAYBACK_OPTIONS,
          default_playback_mode: "remote",
          default_venue_player_id: null,
          venue_players: [],
        },
      ),
    ).toEqual({
      mode: "remote",
      venuePlayerId: null,
    });
  });

  it("returns the same selection when no reconciliation is needed", () => {
    const selection: MusicQuizPlaybackSelection = {
      mode: "venue",
      venuePlayerId: "kitchen",
    };

    expect(reconcile(selection)).toBe(selection);
  });
});

function reconcile(
  selection: MusicQuizPlaybackSelection,
  options: MusicQuizPlaybackOptions = PLAYBACK_OPTIONS,
) {
  return reconcileMusicQuizPlaybackSelection(selection, options);
}
