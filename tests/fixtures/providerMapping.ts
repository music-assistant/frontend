import { ContentType, type ProviderMapping } from "@/plugins/api/interfaces";

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
    audio_format: {
      content_type: ContentType.FLAC,
      codec_type: ContentType.FLAC,
      sample_rate: 44100,
      bit_depth: 16,
      channels: 2,
      output_format_str: "flac",
      bit_rate: 0,
    },
    ...overrides,
  };
}
