<template>
  <div v-if="showForm" :aria-busy="busy" data-testid="settings-page-form">
    <EditConfig
      v-if="loaded"
      ref="editConfig"
      :config-entries="entries"
      :disabled="false"
      inline-save
      @submit="onSubmit"
      @action="onAction"
      @immediate-apply="save"
    />

    <Empty v-else-if="loadFailed" class="rounded-xl border border-dashed py-6">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SlidersHorizontal />
        </EmptyMedia>
        <EmptyTitle>{{ $t("settings.settings_load_failed") }}</EmptyTitle>
      </EmptyHeader>
    </Empty>

    <div v-else class="flex min-h-24 items-center justify-center">
      <Spinner class="size-6" />
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { useSettingsPage } from "@/composables/settings/useSettingsPage";
import { useSettingsToolbarMenu } from "@/composables/useSettingsToolbarMenu";
import type { SettingsPageId } from "@/helpers/settings_pages";
import type { ConfigValueType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import EditConfig from "@/views/settings/EditConfig.vue";
import { RotateCcw, SlidersHorizontal } from "@lucide/vue";
import { computed, markRaw, onBeforeUnmount, ref, watch } from "vue";
import { toast } from "vue-sonner";

/**
 * The settings a settings page shows, as a form that saves them in place.
 * Renders nothing for a user who may not change them, or when there are none.
 */
const props = defineProps<{
  page: SettingsPageId;
}>();

const editConfig = ref<InstanceType<typeof EditConfig>>();

const { entries, loaded, loadFailed, busy, canEdit, save, onAction } =
  useSettingsPage(props.page);

const showForm = computed(
  () => canEdit && !(loaded.value && entries.value.length === 0),
);

// the toolbar's menu resets the form while it is on screen
const toolbarMenu = useSettingsToolbarMenu();
watch(
  () => showForm.value && loaded.value,
  (resettable) => {
    toolbarMenu.value = resettable
      ? [
          {
            label: "settings.reset_to_defaults",
            icon: markRaw(RotateCcw),
            action: () => editConfig.value?.resetToDefaults(),
          },
        ]
      : [];
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  toolbarMenu.value = [];
});

const onSubmit = async function (values: Record<string, ConfigValueType>) {
  if (!(await save(values))) {
    editConfig.value?.saveFailed();
    return;
  }
  // the form stays on screen, so it takes the saved values as its baseline
  editConfig.value?.saveSucceeded(values);
  toast.success($t("settings.settings_saved"));
};
</script>
