import { api } from "@/plugins/api";
import {
  type BackgroundTask,
  type EventMessage,
  EventType,
  MediaType,
  TaskStatus,
} from "@/plugins/api/interfaces";

const MUSIC_SYNC_TASK_DOMAIN = "music_sync";
const ACTIVE_STATUSES: ReadonlySet<TaskStatus> = new Set([
  TaskStatus.PENDING,
  TaskStatus.RUNNING,
]);
const COMPLETED_STATUSES: ReadonlySet<TaskStatus> = new Set([
  TaskStatus.SUCCESS,
  TaskStatus.PARTIAL_SUCCESS,
]);

interface SyncCompletedListener {
  mediaType: MediaType;
  callback: () => void;
}

// The server suppresses per-item MEDIA_ITEM_ADDED/UPDATED events while a
// provider library sync runs, and creates one background task per
// (provider, media_type) — each streamed via TASKS_UPDATED with its media_type
// in the metadata. We watch those tasks transition from active to a successful
// terminal status and notify the matching library view, so each view refreshes
// as soon as its own media type finishes syncing. The task manager is the
// source of truth here; the server keeps MUSIC_SYNC_COMPLETED for its own
// batch-level work and the frontend does not depend on it.
const lastStatusByTaskId = new Map<string, TaskStatus>();
const listeners = new Set<SyncCompletedListener>();
let unsubscribe: (() => void) | undefined;

const notify = (mediaType: MediaType) => {
  for (const listener of listeners) {
    if (listener.mediaType === mediaType) listener.callback();
  }
};

const handleTasksUpdated = (evt: EventMessage) => {
  const tasks = (evt.data as BackgroundTask[] | undefined) ?? [];
  for (const task of tasks) {
    if (task.metadata.task_domain !== MUSIC_SYNC_TASK_DOMAIN) continue;
    const previous = lastStatusByTaskId.get(task.id);
    lastStatusByTaskId.set(task.id, task.status);
    if (
      previous !== undefined &&
      ACTIVE_STATUSES.has(previous) &&
      COMPLETED_STATUSES.has(task.status)
    ) {
      const mediaType = task.metadata.media_type;
      if (typeof mediaType === "string") notify(mediaType as MediaType);
    }
  }
};

const ensureSubscribed = () => {
  if (unsubscribe) return;
  unsubscribe = api.subscribe(EventType.TASKS_UPDATED, handleTasksUpdated);
};

const teardownIfIdle = () => {
  if (listeners.size > 0 || !unsubscribe) return;
  unsubscribe();
  unsubscribe = undefined;
  lastStatusByTaskId.clear();
};

/**
 * Register a callback that runs when a provider library sync for the given media
 * type finishes.
 *
 * Fires once each time a music_sync background task for `mediaType` transitions
 * from running to a successful state, so a view can flag that fresh items may be
 * available. Only completions observed while subscribed are reported; sync tasks
 * that already finished before the caller registered are ignored.
 *
 * Returns an unsubscribe function; call it in onBeforeUnmount.
 */
export function onLibrarySyncCompleted(
  mediaType: MediaType,
  callback: () => void,
): () => void {
  const listener: SyncCompletedListener = { mediaType, callback };
  listeners.add(listener);
  ensureSubscribed();
  return () => {
    listeners.delete(listener);
    teardownIfIdle();
  };
}
