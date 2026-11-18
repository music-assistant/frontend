import { ChannelLayout, Player, PlayerType } from "@/plugins/api/interfaces";
import { describe, expect, it } from "vitest";
import { getPlayerTypeLabel, isSpeakerPlayer } from "./players";

const player = (type: PlayerType, channel_layout?: ChannelLayout | null) =>
  ({ type, channel_layout }) as Player;

describe("isSpeakerPlayer", () => {
  it("holds for a speaker and for a set of speakers", () => {
    expect(isSpeakerPlayer(player(PlayerType.PLAYER))).toBe(true);
    expect(isSpeakerPlayer(player(PlayerType.MULTI_CHANNEL))).toBe(true);
  });

  it("does not hold for a group player, a screen or no player", () => {
    expect(isSpeakerPlayer(player(PlayerType.GROUP))).toBe(false);
    expect(isSpeakerPlayer(player(PlayerType.DISPLAY))).toBe(false);
    expect(isSpeakerPlayer(undefined)).toBe(false);
  });
});

describe("getPlayerTypeLabel", () => {
  it("names the type alone for a player without a layout to show", () => {
    expect(getPlayerTypeLabel(player(PlayerType.PLAYER))).toBe("Player");
    expect(getPlayerTypeLabel(player(PlayerType.PLAYER, null))).toBe("Player");
    expect(
      getPlayerTypeLabel(
        player(PlayerType.MULTI_CHANNEL, ChannelLayout.UNKNOWN),
      ),
    ).toBe("Multi-channel");
  });

  it("adds the layout of a set of speakers", () => {
    expect(
      getPlayerTypeLabel(
        player(PlayerType.MULTI_CHANNEL, ChannelLayout.STEREO),
      ),
    ).toBe("Multi-channel · Stereo pair");
    expect(
      getPlayerTypeLabel(
        player(PlayerType.MULTI_CHANNEL, ChannelLayout.LAYOUT_5_1),
      ),
    ).toBe("Multi-channel · 5.1");
  });
});
