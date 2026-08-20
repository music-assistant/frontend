import type { OutputProtocol } from "@/plugins/api/interfaces";

/**
 * One of the ways a player can be played to, for tests that only care about a
 * few of its fields but should still model a payload the server can send.
 */
export function outputProtocol(
  overrides: Partial<OutputProtocol> = {},
): OutputProtocol {
  return {
    output_protocol_id: "airplay-kitchen",
    name: "AirPlay",
    is_native: false,
    protocol_domain: "airplay",
    priority: 1,
    available: true,
    derived_from: null,
    ...overrides,
  };
}
