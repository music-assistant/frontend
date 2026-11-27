<template>
  <div class="flex flex-col gap-6 p-6 max-md:gap-5 max-md:px-3 max-md:py-4">
    <SettingsPageHeader :page="page" />
    <EditConfig
      ref="editConfig"
      :config-entries="entries"
      :disabled="false"
      hide-header
      @submit="onSubmit"
      @action="onAction"
      @immediate-apply="applyImmediately"
    />

    <!-- Loading overlay; z-index clears the player bar (2001) floating above it -->
    <div
      v-if="saving"
      data-testid="loading-overlay"
      class="fixed inset-0 z-[2100] flex items-center justify-center bg-background/80"
    >
      <Spinner class="size-16" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { RotateCcw } from "@lucide/vue";
import { computed, markRaw, onBeforeUnmount, ref } from "vue";
import { toast } from "vue-sonner";

import SettingsPageHeader from "@/components/settings/SettingsPageHeader.vue";
import { Spinner } from "@/components/ui/spinner";
import {
  type InterfaceSettingsStorage,
  useInterfaceSettings,
} from "@/composables/useInterfaceSettings";
import { useSettingsPageMenu } from "@/composables/useSettingsPageMenu";
import { ConfigValueType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import EditConfig from "@/views/settings/EditConfig.vue";

/**
 * The interface settings of the signed-in user kept on the account or on this
 * device, as a form that saves them in place. Reloads the app when a saved
 * preference only shows after a reload.
 */
const props = defineProps<{
  storage: InterfaceSettingsStorage;
}>();

// the settings kept on the account are the Interface page, the others This device
const page = computed(() =>
  props.storage === "account" ? "interface" : "device",
);

const editConfig = ref<InstanceType<typeof EditConfig>>();
const saving = ref(false);

const { entries, save, onAction, applyImmediately } = useInterfaceSettings(
  props.storage,
);

// the page's menu resets the form while it is on screen
const pageMenu = useSettingsPageMenu();
pageMenu.value = [
  {
    label: "settings.reset_to_defaults",
    icon: markRaw(RotateCcw),
    action: () => editConfig.value?.resetToDefaults(),
  },
];
onBeforeUnmount(() => {
  pageMenu.value = [];
});

const onSubmit = async function (values: Record<string, ConfigValueType>) {
  saving.value = true;
  let needsReload: boolean;
  try {
    needsReload = await save(values);
  } catch {
    saving.value = false;
    editConfig.value?.saveFailed();
    toast.error($t("settings.save_failed"));
    return;
  }
  // the form stays on screen, so it takes the saved values as its baseline;
  // that also keeps the reload from asking about unsaved changes
  editConfig.value?.saveSucceeded(values);
  if (needsReload) {
    // the overlay stays up until the app has reloaded
    window.location.reload();
    return;
  }
  saving.value = false;
  toast.success($t("settings.settings_saved"));
};
</script>
