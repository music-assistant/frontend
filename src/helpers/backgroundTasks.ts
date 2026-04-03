import type { BackgroundTask } from "@/plugins/api/interfaces";

const GENERIC_SYNC_TRANSLATION_KEYS = new Set([
  "settings.sync",
  "sync",
  "sync_now",
]);

const MUSIC_SYNC_TRANSLATION_KEYS: Record<string, string> = {
  artist: "background_task.sync_provider_artists",
  album: "background_task.sync_provider_albums",
  track: "background_task.sync_provider_tracks",
  playlist: "background_task.sync_provider_playlists",
  radio: "background_task.sync_provider_radios",
  audiobook: "background_task.sync_provider_audiobooks",
  podcast: "background_task.sync_provider_podcasts",
};

export const isMusicSyncTask = (task: BackgroundTask): boolean =>
  task.metadata.task_domain === "music_sync";

export const getBackgroundTaskTranslation = (
  task: BackgroundTask,
): { key: string; args: unknown[] } | null => {
  const translationKey = task.translation_key;
  if (translationKey && !GENERIC_SYNC_TRANSLATION_KEYS.has(translationKey)) {
    return {
      key: translationKey,
      args: task.translation_args,
    };
  }

  if (isMusicSyncTask(task)) {
    const mediaType = String(task.metadata.media_type || "");
    const providerName = String(task.metadata.provider_name || "");
    const key = MUSIC_SYNC_TRANSLATION_KEYS[mediaType];
    if (key && providerName) {
      return {
        key,
        args: [providerName],
      };
    }
  }

  if (translationKey) {
    return {
      key: translationKey,
      args: task.translation_args,
    };
  }

  return null;
};

export const hasSelfContainedBackgroundTaskTitle = (
  task: BackgroundTask,
): boolean => {
  return Boolean(
    getBackgroundTaskTranslation(task)?.key.startsWith(
      "background_task.sync_provider_",
    ),
  );
};

export const getBackgroundTaskName = (
  task: BackgroundTask,
  t: (key: string, args?: unknown[]) => string,
  te: (key: string) => boolean,
): string => {
  const translation = getBackgroundTaskTranslation(task);
  if (translation && te(translation.key)) {
    return t(translation.key, translation.args);
  }
  return task.name;
};

export default getBackgroundTaskName;
