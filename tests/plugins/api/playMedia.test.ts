import { describe, it, expect, vi, afterEach } from "vitest";
import { api } from "@/plugins/api";
import {
  QueueOption,
  SortDirection,
  SortField,
} from "@/plugins/api/interfaces";

describe("playMedia start_from_beginning passthrough", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("forwards start_from_beginning in the play_media payload", () => {
    const spy = vi
      .spyOn(api, "sendCommand")
      .mockResolvedValue(undefined as never);

    api.playMedia("library://podcast_episode/1", QueueOption.PLAY, {
      start_from_beginning: true,
    });

    expect(spy).toHaveBeenCalledWith(
      "player_queues/play_media",
      expect.objectContaining({ start_from_beginning: true }),
    );
  });

  it("omits start_from_beginning as undefined when not requested", () => {
    const spy = vi
      .spyOn(api, "sendCommand")
      .mockResolvedValue(undefined as never);

    api.playMedia("library://track/1", QueueOption.PLAY);

    const payload = spy.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.start_from_beginning).toBeUndefined();
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
