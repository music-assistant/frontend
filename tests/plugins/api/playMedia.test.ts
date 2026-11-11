import { describe, it, expect, vi, afterEach } from "vitest";
import { api } from "@/plugins/api";
import {
  QueueOption,
  SortDirection,
  SortField,
} from "@/plugins/api/interfaces";

describe("playMedia start_position passthrough", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 0 plays from the beginning, so it must survive as a value
  it("forwards a start_position of 0 in the play_media payload", () => {
    const spy = vi
      .spyOn(api, "sendCommand")
      .mockResolvedValue(undefined as never);

    api.playMedia("library://podcast_episode/1", QueueOption.PLAY, {
      start_position: 0,
    });

    expect(spy).toHaveBeenCalledWith(
      "player_queues/play_media",
      expect.objectContaining({ start_position: 0 }),
    );
  });

  it("omits start_position as undefined when not requested", () => {
    const spy = vi
      .spyOn(api, "sendCommand")
      .mockResolvedValue(undefined as never);

    api.playMedia("library://track/1", QueueOption.PLAY);

    const payload = spy.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.start_position).toBeUndefined();
  });

  it("forwards suppressGlobalError to sendCommand as a third argument", () => {
    const spy = vi
      .spyOn(api, "sendCommand")
      .mockResolvedValue(undefined as never);

    api.playMedia("library://track/1", undefined, {
      queue_id: "q",
      suppressGlobalError: true,
    });

    expect(spy).toHaveBeenCalledWith(
      "player_queues/play_media",
      expect.objectContaining({ queue_id: "q" }),
      { suppressGlobalError: true },
    );
  });

  it("calls sendCommand with two arguments when suppressGlobalError is not set", () => {
    const spy = vi
      .spyOn(api, "sendCommand")
      .mockResolvedValue(undefined as never);

    api.playMedia("library://track/1", QueueOption.PLAY);

    expect(spy.mock.calls[0].length).toBe(2);
  });
});

describe("playMedia typed sort passthrough", () => {
  it("forwards sort_field and sort_direction", () => {
    const spy = vi
      .spyOn(api, "sendCommand")
      .mockResolvedValue(undefined as never);

    api.playMedia("library://album/1", QueueOption.PLAY, {
      sort_field: SortField.DURATION,
      sort_direction: SortDirection.DESC,
    });

    expect(spy).toHaveBeenCalledWith(
      "player_queues/play_media",
      expect.objectContaining({
        sort_field: SortField.DURATION,
        sort_direction: SortDirection.DESC,
      }),
    );
  });

  it("preserves sort_by for callers that have not migrated to typed sorts", () => {
    const spy = vi
      .spyOn(api, "sendCommand")
      .mockResolvedValue(undefined as never);

    api.playMedia("library://album/1", QueueOption.PLAY, {
      sort_by: "duration_desc",
    });

    expect(spy).toHaveBeenCalledWith(
      "player_queues/play_media",
      expect.objectContaining({ sort_by: "duration_desc" }),
    );
  });
});
