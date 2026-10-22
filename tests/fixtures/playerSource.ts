import type { PlayerSource } from "@/plugins/api/interfaces";

/**
 * A source in a player's source list, for tests that only care about a few of
 * its fields but should still model a payload the server can send.
 *
 * Defaults to a transport-only source: it names itself and nothing more.
 */
export function playerSource(
  overrides: Partial<PlayerSource> = {},
): PlayerSource {
  return {
    id: "line-in",
    name: "Line In",
    passive: true,
    can_play_pause: false,
    can_seek: false,
    can_next_previous: false,
    can_shuffle: false,
    can_repeat: false,
    shuffle_enabled: null,
    repeat_mode: null,
    ...overrides,
  };
}
