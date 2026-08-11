import { type ProviderMapping } from "@/plugins/api/interfaces";
import { audioFormat } from "./audioFormat";

/**
 * A complete provider mapping, for fixtures that only care about a few of its
 * fields but should still model a payload the server can send.
 */
export function providerMapping(
  overrides: Partial<ProviderMapping> = {},
): ProviderMapping {
  return {
    item_id: "item-1",
    provider_domain: "test_provider",
    provider_instance: "test_provider--1",
    available: true,
    in_library: null,
    details: null,
    url: null,
    audio_format: audioFormat(),
    ...overrides,
  };
}
