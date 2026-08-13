<template>
  <section class="p-4">
    <SettingsHeaderCard
      v-model:show-advanced-settings="showAdvancedSettings"
      :icon="SlidersHorizontal"
      :title="$t('settings.queue_settings')"
      :description="queueName"
      :show-advanced-toggle="hasAdvancedEntries(allConfigEntries)"
      @reset-to-defaults="resetToDefaults"
    />

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
      ref="editConfig"
      v-model:show-advanced-settings="showAdvancedSettings"
      :config-entries="allConfigEntries"
      :disabled="false"
      @submit="onSubmit"
      @immediate-apply="onImmediateApply"
    />

    <!-- z-index clears the player bar (2001), which floats above page content -->
    <div
      v-if="loading"
      data-testid="loading-overlay"
      class="fixed inset-0 z-[2100] flex items-center justify-center bg-background/80"
    >
      <Spinner class="size-16" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { api } from "@/plugins/api";
import { ConfigValueType, PlayerQueueConfig } from "@/plugins/api/interfaces";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { hasAdvancedEntries } from "@/helpers/config_entry_ui";
import { goBack } from "@/helpers/navigation";
import { Info, SlidersHorizontal } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { toast } from "vue-sonner";
import EditConfig from "./EditConfig.vue";
import SettingsHeaderCard from "./SettingsHeaderCard.vue";

// global refs
const router = useRouter();
const config = ref<PlayerQueueConfig>();
const editConfig = ref<InstanceType<typeof EditConfig>>();
const loading = ref(false);
const showAdvancedSettings = ref(false);

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
const resetToDefaults = function () {
  editConfig.value?.resetToDefaults();
};

const onSubmit = async function (values: Record<string, ConfigValueType>) {
  loading.value = true;
  api
    .savePlayerQueueConfig(props.queueId!, values)
    .then(() => {
      goBack(router, { name: "playersettings" });
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
