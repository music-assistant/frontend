import { ContentType, type ProviderMapping } from "@/plugins/api/interfaces";

export function providerMapping(
  overrides: Partial<ProviderMapping> = {},
): ProviderMapping {
  // Provider mapping with every field the server always sends, so tests that
  // only care about a few of them still model a payload that can exist.
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
