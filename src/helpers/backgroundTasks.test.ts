import { describe, expect, it, vi } from "vitest";
import type { BackgroundTask } from "@/plugins/api/interfaces";
import { TaskStatus } from "@/plugins/api/interfaces";
import {
  getBackgroundTaskName,
  getBackgroundTaskTranslation,
  hasSelfContainedBackgroundTaskTitle,
} from "./backgroundTasks";

describe("getBackgroundTaskName", () => {
  const createTask = (
    overrides: Partial<BackgroundTask> = {},
  ): BackgroundTask => ({
    id: "task-1",
    name: "Fallback task name",
    status: TaskStatus.PENDING,
    translation_args: [],
    logs: [],
    created_at: "2026-03-18T00:00:00Z",
    updated_at: "2026-03-18T00:00:00Z",
    failure_count: 0,
    failure_messages: [],
    metadata: {},
    allow_retry: false,
    allow_cancel: true,
    ...overrides,
  });

  it("uses the translated name when a translation key exists", () => {
    const task = createTask({
      translation_key: "background_task.sync_provider_artists",
      translation_args: ["Spotify"],
    });
    const t = vi.fn().mockReturnValue("Sync Artists for Spotify");
    const te = vi.fn().mockReturnValue(true);

    expect(getBackgroundTaskName(task, t, te)).toBe("Sync Artists for Spotify");
    expect(t).toHaveBeenCalledWith("background_task.sync_provider_artists", [
      "Spotify",
    ]);
  });

  it("falls back to the hardcoded task name when the translation key is unknown", () => {
    const task = createTask({
      translation_key: "background_task.unknown",
    });

    expect(
      getBackgroundTaskName(task, vi.fn(), vi.fn().mockReturnValue(false)),
    ).toBe("Fallback task name");
  });

  it("falls back to the hardcoded task name when no translation key is set", () => {
    const task = createTask();

    expect(
      getBackgroundTaskName(task, vi.fn(), vi.fn().mockReturnValue(false)),
    ).toBe("Fallback task name");
  });

  it("normalizes old generic music sync translation keys into the new task title", () => {
    const task = createTask({
      name: "Synchronize now",
      translation_key: "settings.sync",
      metadata: {
        task_domain: "music_sync",
        media_type: "radio",
        provider_name: "Tune-In Radio",
      },
    });
    const t = vi.fn().mockReturnValue("Sync Radios for Tune-In Radio");
    const te = vi.fn().mockReturnValue(true);

    expect(getBackgroundTaskTranslation(task)).toEqual({
      key: "background_task.sync_provider_radios",
      args: ["Tune-In Radio"],
    });
    expect(getBackgroundTaskName(task, t, te)).toBe(
      "Sync Radios for Tune-In Radio",
    );
    expect(hasSelfContainedBackgroundTaskTitle(task)).toBe(true);
  });
});
