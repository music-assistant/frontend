<template>
  <div>
    <div class="tasks-header w-100">
      <BackgroundTaskFilters @update:search="searchQuery = $event" />

      <Button
        v-if="isAdmin"
        class="clear-finished-btn"
        variant="outline"
        @click="clearFinishedTasks"
      >
        <Trash2 class="size-4" />
        {{ t("background_tasks.clear_finished") }}
      </Button>
    </div>

    <div class="pl-5 font-weight-medium">
      {{
        t("background_tasks.total", [
          filteredTasks.length,
          filteredTasks.length !== 1 ? "s" : "",
        ])
      }}
    </div>

    <Container
      :variant="viewMode === 'list' ? 'default' : 'panel'"
      class="mt-4 px-5"
    >
      <div v-if="showInitialLoading" class="empty-state">
        <v-progress-circular indeterminate color="primary" size="48" />
      </div>

      <v-list
        v-else-if="viewMode === 'list' && filteredTasks.length"
        class="tasks-list"
      >
        <BackgroundTaskItem
          v-for="task in filteredTasks"
          :key="task.id"
          :task="task"
          variant="list"
          @click="showTaskDetails"
          @menu="onMenu"
        />
      </v-list>

      <v-row v-else-if="filteredTasks.length">
        <v-col
          v-for="task in filteredTasks"
          :key="task.id"
          cols="12"
          md="6"
          lg="4"
          class="d-flex"
        >
          <BackgroundTaskItem
            :task="task"
            variant="card"
            @click="showTaskDetails"
            @menu="onMenu"
          />
        </v-col>
      </v-row>

      <div v-else class="empty-state">
        <v-icon icon="mdi-list-status" size="64" class="empty-icon" />
        <div class="empty-title">{{ emptyTitle }}</div>
        <div class="empty-message">
          {{ emptyDescription }}
        </div>
      </div>
    </Container>

    <BackgroundTaskDetailsDialog
      v-model:open="detailsDialogOpen"
      :task="selectedTask"
      :log-text="taskLogText"
      :log-loading="taskLogLoading"
      :user-labels="userLabels"
      @copy="copyLogs"
      @download="downloadLogs"
      @edit-schedule="editSelectedTaskSchedule"
    />
    <BackgroundTaskScheduleDialog
      v-model:open="scheduleDialogOpen"
      :task="scheduleTask"
      :saving="scheduleDialogSaving"
      @save="saveTaskSchedule"
    />
  </div>
</template>

<script setup lang="ts">
import Container from "@/components/Container.vue";
import BackgroundTaskDetailsDialog from "@/components/settings/background-tasks/BackgroundTaskDetailsDialog.vue";
import BackgroundTaskFilters from "@/components/settings/background-tasks/BackgroundTaskFilters.vue";
import BackgroundTaskItem from "@/components/settings/background-tasks/BackgroundTaskItem.vue";
import BackgroundTaskScheduleDialog from "@/components/settings/background-tasks/BackgroundTaskScheduleDialog.vue";
import { Button } from "@/components/ui/button";
import {
  canEditTaskSchedule,
  canRemoveTask,
  canRunTaskManually,
  isCancelableTask,
  isRetryableTask,
  isScheduledTask,
} from "@/composables/useBackgroundTaskDisplay";
import { useBackgroundTasks } from "@/composables/useBackgroundTasks";
import { getBackgroundTaskName } from "@/helpers/backgroundTasks";
import { type ContextMenuItem } from "@/layouts/default/ItemContextMenu.vue";
import { api } from "@/plugins/api";
import {
  type BackgroundTask,
  type TaskSchedule,
  type User,
  TaskStatus,
  UserRole,
} from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import { Trash2 } from "lucide-vue-next";
import { computed, inject, ref } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";

const tasksViewMode = inject<{
  viewMode: { value: "list" | "card" };
  toggleViewMode: () => void;
}>("tasksViewMode")!;

const detailsDialogOpen = ref(false);
const scheduleDialogOpen = ref(false);
const scheduleDialogSaving = ref(false);
const searchQuery = ref("");
const scheduleTask = ref<BackgroundTask | null>(null);
const selectedTaskId = ref<string | null>(null);
const taskLogText = ref("");
const taskLogLoading = ref(false);
const userLabels = ref<Record<string, string>>({});
const usersLoaded = ref(false);

const { t, te } = useI18n();
const viewMode = computed(() => tasksViewMode.viewMode.value);
const isAdmin = computed(() => store.currentUser?.role === UserRole.ADMIN);
const {
  loading,
  refreshTasks: refreshTasksState,
  tasks,
} = useBackgroundTasks();

const selectedTask = computed<BackgroundTask | null>(() => {
  if (!selectedTaskId.value) {
    return null;
  }
  return tasks.value.find((task) => task.id === selectedTaskId.value) ?? null;
});

const showInitialLoading = computed(
  () => loading.value && tasks.value.length === 0,
);

const filteredTasks = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();

  return [...tasks.value]
    .filter((task) => {
      if (!query) {
        return true;
      }

      const providerName = String(task.metadata.provider_name || "");
      const mediaType = String(task.metadata.media_type || "");
      const values = [
        getTaskName(task),
        task.name,
        task.id,
        task.status,
        providerName,
        mediaType,
        task.last_error,
        task.progress_text,
        ...task.failure_messages,
      ];

      return values.some(
        (value) =>
          typeof value === "string" && value.toLowerCase().includes(query),
      );
    })
    .sort((left, right) => {
      const leftPriority = getPriority(left);
      const rightPriority = getPriority(right);
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }
      return right.updated_at.localeCompare(left.updated_at);
    });
});

const emptyTitle = computed(() =>
  tasks.value.length === 0
    ? t("background_tasks.empty_title")
    : t("no_content"),
);

const emptyDescription = computed(() =>
  tasks.value.length === 0
    ? t("background_tasks.empty_description")
    : t("no_content_filter"),
);

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string" && error.length) {
    return error;
  }
  return fallback;
};

const getTaskName = (task: BackgroundTask) =>
  getBackgroundTaskName(task, t, te);

const clearFinishedTasks = async () => {
  try {
    await api.clearFinishedTasks();
    await refreshTasksState();
    if (
      selectedTaskId.value &&
      !tasks.value.some((task) => task.id === selectedTaskId.value)
    ) {
      detailsDialogOpen.value = false;
      selectedTaskId.value = null;
      taskLogText.value = "";
      taskLogLoading.value = false;
    }
    toast.success(t("background_tasks.toast.history_cleared"));
  } catch (error) {
    toast.error(
      getErrorMessage(error, t("background_tasks.toast.history_clear_failed")),
    );
  }
};

const runTask = async (task: BackgroundTask) => {
  try {
    await api.runTask(task.id, { showBackgroundTaskToast: false });
    await refreshTasksState();
  } catch (error) {
    toast.error(
      getErrorMessage(
        error,
        t("background_tasks.toast.run_failed", [getTaskName(task)]),
      ),
    );
  }
};

const toggleTaskEnabled = async (task: BackgroundTask) => {
  if (!task.schedule) return;
  const isEnabling = !task.schedule.enabled;
  try {
    await api.setTaskEnabled(task.id, isEnabling);
    await refreshTasksState();
    toast.success(
      isEnabling
        ? t("background_tasks.toast.schedule_enabled", [getTaskName(task)])
        : t("background_tasks.toast.schedule_disabled", [getTaskName(task)]),
    );
  } catch (error) {
    toast.error(
      getErrorMessage(
        error,
        isEnabling
          ? t("background_tasks.toast.schedule_enable_failed", [
              getTaskName(task),
            ])
          : t("background_tasks.toast.schedule_disable_failed", [
              getTaskName(task),
            ]),
      ),
    );
  }
};

const openScheduleDialog = (task: BackgroundTask) => {
  scheduleTask.value = task;
  scheduleDialogOpen.value = true;
};

const editSelectedTaskSchedule = () => {
  if (!selectedTask.value?.schedule) {
    return;
  }
  detailsDialogOpen.value = false;
  openScheduleDialog(selectedTask.value);
};

const saveTaskSchedule = async (schedule: TaskSchedule) => {
  if (!scheduleTask.value) return;
  scheduleDialogSaving.value = true;
  try {
    await api.updateTaskSchedule(scheduleTask.value.id, {
      schedule,
    });
    await refreshTasksState();
    scheduleDialogOpen.value = false;
    toast.success(
      t("background_tasks.toast.schedule_updated", [
        getTaskName(scheduleTask.value),
      ]),
    );
  } catch (error) {
    toast.error(
      getErrorMessage(
        error,
        t("background_tasks.toast.schedule_update_failed", [
          getTaskName(scheduleTask.value),
        ]),
      ),
    );
  } finally {
    scheduleDialogSaving.value = false;
  }
};

const retryTask = async (task: BackgroundTask) => {
  try {
    await api.retryTask(task.id, { showBackgroundTaskToast: false });
    await refreshTasksState();
  } catch (error) {
    toast.error(
      getErrorMessage(
        error,
        t("background_tasks.toast.retry_failed", [getTaskName(task)]),
      ),
    );
  }
};

const cancelTask = async (task: BackgroundTask) => {
  try {
    await api.cancelTask(task.id);
    await refreshTasksState();
    toast.success(
      t("background_tasks.toast.cancel_requested", [getTaskName(task)]),
    );
  } catch (error) {
    toast.error(
      getErrorMessage(
        error,
        t("background_tasks.toast.cancel_failed", [getTaskName(task)]),
      ),
    );
  }
};

const removeTask = async (task: BackgroundTask) => {
  try {
    await api.removeTask(task.id);
    if (selectedTaskId.value === task.id) {
      detailsDialogOpen.value = false;
      selectedTaskId.value = null;
      taskLogText.value = "";
      taskLogLoading.value = false;
    }
    await refreshTasksState();
    toast.success(t("background_tasks.toast.removed", [getTaskName(task)]));
  } catch (error) {
    toast.error(
      getErrorMessage(
        error,
        t("background_tasks.toast.remove_failed", [getTaskName(task)]),
      ),
    );
  }
};

const ensureUserLabelsLoaded = async () => {
  if (
    usersLoaded.value ||
    !store.currentUser ||
    store.currentUser.role !== UserRole.ADMIN
  ) {
    return;
  }
  try {
    const users = await api.getAllUsers();
    userLabels.value = Object.fromEntries(
      users.map((user: User) => [
        user.user_id,
        user.display_name || user.username || user.user_id,
      ]),
    );
    usersLoaded.value = true;
  } catch {
    // Ignore user lookup failures in the details dialog.
  }
};

const showTaskDetails = async (task: BackgroundTask) => {
  selectedTaskId.value = task.id;
  detailsDialogOpen.value = true;
  taskLogText.value = "";
  taskLogLoading.value = true;
  void ensureUserLabelsLoaded();
  try {
    const logText = await api.getTaskLog(task.id);
    if (selectedTaskId.value === task.id) {
      taskLogText.value = logText;
    }
  } catch (error) {
    toast.error(
      getErrorMessage(
        error,
        t("background_tasks.toast.log_load_failed", [getTaskName(task)]),
      ),
    );
  } finally {
    if (selectedTaskId.value === task.id) {
      taskLogLoading.value = false;
    }
  }
};

const copyLogs = async () => {
  try {
    await navigator.clipboard.writeText(taskLogText.value);
    toast.success(t("background_tasks.toast.log_copied"));
  } catch (error) {
    toast.error(
      getErrorMessage(error, t("background_tasks.toast.log_copy_failed")),
    );
  }
};

const downloadLogs = () => {
  if (!selectedTask.value) return;
  const url = window.URL.createObjectURL(
    new Blob([taskLogText.value], { type: "text/plain" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `${selectedTask.value.id}.log`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
  toast.success(t("background_tasks.toast.log_download_started"));
};

const getContextMenuPosition = (
  event: Event,
): { posX: number; posY: number } => {
  if (event instanceof MouseEvent) {
    return { posX: event.clientX, posY: event.clientY };
  }

  const target =
    event.currentTarget instanceof HTMLElement
      ? event.currentTarget
      : event.target instanceof HTMLElement
        ? event.target
        : null;

  if (!target) {
    return { posX: 0, posY: 0 };
  }

  const rect = target.getBoundingClientRect();
  return {
    posX: rect.left + rect.width / 2,
    posY: rect.top + rect.height / 2,
  };
};

const onMenu = (event: Event, task: BackgroundTask) => {
  const menuItems: ContextMenuItem[] = [
    {
      label: "background_tasks.view_details",
      action: () => {
        void showTaskDetails(task);
      },
      icon: "mdi-file-document-outline",
    },
    {
      label: "background_tasks.edit_schedule",
      action: () => {
        openScheduleDialog(task);
      },
      icon: "mdi-timer-edit-outline",
      hide: !isAdmin.value || !canEditTaskSchedule(task),
    },
    {
      label: "background_tasks.run_now",
      action: () => {
        void runTask(task);
      },
      icon: "mdi-play",
      hide: !isAdmin.value || !canRunTaskManually(task),
    },
    {
      label: task.schedule?.enabled
        ? "background_tasks.disable_schedule"
        : "background_tasks.enable_schedule",
      action: () => {
        void toggleTaskEnabled(task);
      },
      icon: task.schedule?.enabled
        ? "mdi-calendar-remove"
        : "mdi-calendar-check",
      hide: !isAdmin.value || !isScheduledTask(task),
    },
    {
      label: "background_tasks.retry",
      action: () => {
        void retryTask(task);
      },
      icon: "mdi-refresh",
      hide: !isAdmin.value || !(task.allow_retry && isRetryableTask(task)),
    },
    {
      label: "background_tasks.cancel",
      action: () => {
        void cancelTask(task);
      },
      icon: "mdi-cancel",
      hide: !isAdmin.value || !(task.allow_cancel && isCancelableTask(task)),
    },
    {
      label: "background_tasks.remove_history",
      action: () => {
        void removeTask(task);
      },
      icon: "mdi-delete",
      color: "error",
      hide: !isAdmin.value || !canRemoveTask(task),
    },
  ];

  eventbus.emit("contextmenu", {
    items: menuItems,
    ...getContextMenuPosition(event),
  });
};

const getPriority = (task: BackgroundTask) => {
  if (task.status === TaskStatus.RUNNING) return 0;
  if (task.status === TaskStatus.PENDING) return 1;
  if (isScheduledTask(task)) return 2;
  return 3;
};
</script>

<style scoped>
.tasks-header {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 20px 20px 6px 20px;
}

.clear-finished-btn {
  flex-shrink: 0;
  align-self: center;
}

.tasks-header :deep(.filters-container) {
  align-items: flex-start;
}

.tasks-list {
  background: transparent;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  width: 100%;
}

.empty-icon {
  color: rgba(var(--v-theme-on-surface), 0.3);
  margin-bottom: 16px;
}

.empty-title {
  font-size: 18px;
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), 0.7);
  margin-bottom: 8px;
}

.empty-message {
  font-size: 14px;
  color: rgba(var(--v-theme-on-surface), 0.5);
  line-height: 1.4;
}

@media (max-width: 960px) {
  .tasks-header {
    flex-direction: column;
    align-items: stretch;
  }

  .clear-finished-btn {
    width: 100%;
    align-self: stretch;
  }
}
</style>
