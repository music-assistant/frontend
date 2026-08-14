import { MediaType, type StreamDetails } from "@/plugins/api/interfaces";
import { audioFormat } from "./audioFormat";

/**
 * Complete stream details, for tests that only care about a few of its fields
 * but should still model a payload the server can send.
 */
export function streamDetails(
  overrides: Partial<StreamDetails> = {},
): StreamDetails {
  return {
    provider: "test_provider--1",
    item_id: "item-1",
    audio_format: audioFormat(),
    media_type: MediaType.TRACK,
    stream_metadata: null,
    duration: 200,
    audio_processing: null,
    ...overrides,
  };
}
