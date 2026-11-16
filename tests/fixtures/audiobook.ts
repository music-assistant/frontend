import { MediaType, type Audiobook } from "@/plugins/api/interfaces";
import { withUri } from "./mediaItem";

/** A complete audiobook payload with overrides for the fields under test. */
export function audiobook(overrides: Partial<Audiobook> = {}): Audiobook {
  return withUri<Omit<Audiobook, "uri">>({
    item_id: "1",
    provider: "library",
    name: "Audiobook",
    version: "",
    external_ids: [],
    is_playable: true,
    media_type: MediaType.AUDIOBOOK,
    provider_mappings: [],
    metadata: {},
    favorite: null,
    authors: [],
    narrators: [],
    duration: 3600,
    fully_played: false,
    resume_position_ms: 0,
    ...overrides,
  });
}
