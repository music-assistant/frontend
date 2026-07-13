import { computed, onMounted, onUnmounted, ref } from "vue";
import { api } from "@/plugins/api";
import {
  type BackgroundTask,
  type EventMessage,
  EventType,
  TaskStatus,
} from "@/plugins/api/interfaces";

const MUSIC_SYNC_TASK_DOMAIN = "music_sync";

const tasks = ref<BackgroundTask[]>([]);
const loading = ref(true);

let consumerCount = 0;
let refreshPromise: Promise<void> | undefined;
let unsubscribeTasksUpdated: (() => void) | undefined;

const activeSyncTasks = computed(() => {
  return tasks.value.filter(
    (task) =>
      (task.status === TaskStatus.PENDING ||
        task.status === TaskStatus.RUNNING) &&
      task.metadata.task_domain === MUSIC_SYNC_TASK_DOMAIN,
  );
});

const subscribeToTaskUpdates = () => {
  if (unsubscribeTasksUpdated) {
    return;
  }

  unsubscribeTasksUpdated = api.subscribe(
    EventType.TASKS_UPDATED,
    (event: EventMessage) => {
      tasks.value = event.data as BackgroundTask[];
    },
  );
};

const unsubscribeFromTaskUpdates = () => {
  if (consumerCount > 0 || !unsubscribeTasksUpdated) {
    return;
  }

  unsubscribeTasksUpdated();
  unsubscribeTasksUpdated = undefined;
};

const refreshTasks = async () => {
  if (refreshPromise) {
    return refreshPromise;
  }

  loading.value = true;
  refreshPromise = api
    .getTasks()
    .then((updatedTasks) => {
      tasks.value = updatedTasks;
    })
    .finally(() => {
      loading.value = false;
      refreshPromise = undefined;
    });

  return refreshPromise;
};

export function useBackgroundTasks() {
  onMounted(() => {
    consumerCount += 1;
    subscribeToTaskUpdates();
    void refreshTasks();
  });

  onUnmounted(() => {
    consumerCount = Math.max(0, consumerCount - 1);
    unsubscribeFromTaskUpdates();
  });

  const isProviderSyncing = (providerInstanceId: string): boolean => {
    return activeSyncTasks.value.some(
      (task) => task.metadata.provider_instance === providerInstanceId,
    );
  };

  return {
    tasks,
    loading,
    activeSyncTasks,
    refreshTasks,
    isProviderSyncing,
  };
}
