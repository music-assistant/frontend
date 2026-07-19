<template>
  <section class="edit-queue-config">
    <v-card class="header-card mb-4" elevation="0">
      <div class="header-content">
        <div class="header-icon">
          <v-icon size="32" color="primary">mdi-tune</v-icon>
        </div>
        <div class="header-info">
          <h2 class="header-title">{{ $t("settings.queue_settings") }}</h2>
          <p class="header-description">{{ queueName }}</p>
        </div>
      </div>
    </v-card>

    <!-- Global queue settings hint -->
    <div
      class="border-primary/20 bg-primary/5 mb-4 flex flex-wrap items-center gap-4 rounded-xl border px-4 py-3"
    >
      <Info class="text-primary size-5 shrink-0" />
      <p class="text-muted-foreground m-0 flex-1 text-sm">
        {{ $t("settings.queue_global_settings_hint") }}
      </p>
      <Button as-child variant="outline" size="sm">
        <RouterLink to="/settings/editcore/player_queues" class="no-underline">
          {{ $t("settings.queue_global_settings_link") }}
        </RouterLink>
      </Button>
    </div>

    <edit-config
      v-if="config"
      :config-entries="allConfigEntries"
      :disabled="false"
      @submit="onSubmit"
      @immediate-apply="onImmediateApply"
    />

    <v-overlay
      v-model="loading"
      scrim="true"
      persistent
      class="loading-overlay"
    >
      <v-progress-circular indeterminate size="64" color="primary" />
    </v-overlay>
  </section>
</template>

<script setup lang="ts">
import { api } from "@/plugins/api";
import { ConfigValueType, PlayerQueueConfig } from "@/plugins/api/interfaces";
import { Button } from "@/components/ui/button";
import { Info } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { toast } from "vue-sonner";
import EditConfig from "./EditConfig.vue";

// global refs
const router = useRouter();
const config = ref<PlayerQueueConfig>();
const loading = ref(false);

// props
const props = defineProps<{
  queueId?: string;
}>();

// computed properties
const allConfigEntries = computed(() => {
  if (!config.value) return [];
  return Object.values(config.value.values);
});

const queueName = computed(
  () => api.queues[props.queueId || ""]?.display_name || props.queueId,
);

// watchers
watch(
  () => props.queueId,
  async (val) => {
    if (val) {
      config.value = await api.getPlayerQueueConfig(val);
    }
  },
  { immediate: true },
);

// methods
const onSubmit = async function (values: Record<string, ConfigValueType>) {
  loading.value = true;
  api
    .savePlayerQueueConfig(props.queueId!, values)
    .then(() => {
      router.back();
    })
    .catch((err) => {
      toast.error(err.message || err);
    })
    .finally(() => {
      loading.value = false;
    });
};

const onImmediateApply = async function (
  values: Record<string, ConfigValueType>,
) {
  // immediately apply a config value change and refresh from the server response
  await api
    .savePlayerQueueConfig(props.queueId!, values)
    .then((updatedConfig) => {
      for (const [key, entry] of Object.entries(updatedConfig.values)) {
        config.value!.values[key] = entry;
      }
    })
    .catch((err) => {
      toast.error(err.message || err);
    });
};
</script>

<style scoped>
.edit-queue-config {
  padding: 16px;
}

.header-card {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 12px;
}

.header-content {
  display: flex;
  gap: 20px;
  padding: 24px;
}

.header-icon {
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  border-radius: 12px;
  background: rgba(var(--v-theme-primary), 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-info {
  flex: 1;
  min-width: 0;
}

.header-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: rgb(var(--v-theme-on-surface));
}

.header-description {
  font-size: 0.875rem;
  color: rgba(var(--v-theme-on-surface), 0.7);
  margin: 0;
  line-height: 1.5;
}

.loading-overlay {
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (max-width: 600px) {
  .header-content {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
