import { type AudioFormat, ContentType } from "@/plugins/api/interfaces";

/**
 * A complete audio format, for tests that only care about a few of its fields
 * but should still model a payload the server can send.
 *
 * The server derives output_format_str from the content type, so it follows
 * any content type the caller overrides.
 */
export function audioFormat(overrides: Partial<AudioFormat> = {}): AudioFormat {
  const format = {
    content_type: ContentType.FLAC,
    codec_type: ContentType.FLAC,
    sample_rate: 44100,
    bit_depth: 16,
    channels: 2,
    output_format_str: "",
    bit_rate: 0,
    ...overrides,
  };
  return {
    ...format,
    output_format_str: format.output_format_str || format.content_type,
  };
}
