import {
  PlaybackState,
  type PlayerQueue,
  RepeatMode,
} from "@/plugins/api/interfaces";

/**
 * A complete player queue, for tests that only care about a few of its fields
 * but should still model a payload the server can send.
 */
export function playerQueue(overrides: Partial<PlayerQueue> = {}): PlayerQueue {
  return {
    queue_id: "queue-1",
    active: true,
    display_name: "Queue",
    available: true,
    items: 0,
    shuffle_enabled: false,
    smart_shuffle_active: false,
    autoplay_enabled: false,
    repeat_mode: RepeatMode.OFF,
    crossfade_enabled: false,
    smart_fades_active: false,
    overlay_enabled: false,
    overlay_source: null,
    overlay_volume: 100,
    current_index: null,
    index_in_buffer: null,
    ended: false,
    elapsed_time: 0,
    elapsed_time_last_updated: 0,
    state: PlaybackState.IDLE,
    current_item: null,
    next_item: null,
    sources: [],
    is_dynamic: false,
    ...overrides,
  };
}
