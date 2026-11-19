<template>
  <section class="p-4">
    <SettingsHeaderCard
      v-if="config && api.providerManifests[config.domain]"
      :icon="Settings2"
      :title="moduleName"
      :description="api.providerManifests[config.domain].description"
      :documentation-url="
        getExternalLinkUrl(api.providerManifests[config.domain].documentation)
      "
      @reset-to-defaults="resetToDefaults"
    />

    <edit-config
      v-if="config"
      ref="editConfig"
      :config-entries="allConfigEntries"
      :disabled="false"
      @submit="onSubmit"
      @action="onAction"
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
import { Spinner } from "@/components/ui/spinner";
import { useConfigAction } from "@/composables/useConfigAction";
import { mergeConfigEntries } from "@/helpers/config_entry_ui";
import { coreModuleName } from "@/helpers/core_modules";
import { LOG_LEVEL_KEY } from "@/helpers/settings_pages";
import { getExternalLinkUrl } from "@/helpers/utils";
import { api } from "@/plugins/api";
import { ConfigValueType, CoreConfig } from "@/plugins/api/interfaces";
import { Settings2 } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import EditConfig from "./EditConfig.vue";
import SettingsHeaderCard from "./SettingsHeaderCard.vue";

/**
 * The settings of a core module that no settings page shows.
 */

// global refs
const router = useRouter();
const { t } = useI18n();
const config = ref<CoreConfig>();
const editConfig = ref<InstanceType<typeof EditConfig>>();
const loading = ref(false);

// props
const props = defineProps<{
  domain?: string;
}>();

// computed properties
const allConfigEntries = computed(() => {
  if (!config.value) return [];
  // Pass all entries (including hidden ones) to EditConfig
  // Hidden entries contain values that need to be preserved on save
  return Object.values(config.value.values);
});

const moduleName = computed(() =>
  config.value
    ? coreModuleName(
        config.value.domain,
        (key) => t(key),
        api.providerManifests[config.value.domain]?.name,
      )
    : "",
);

// watchers
watch(
  () => props.domain,
  async (val) => {
    if (val) {
      config.value = await api.getCoreConfig(val);
    }
  },
  { immediate: true },
);

// Diagnostics sets the log level of every module; hidden from the form rather
// than left out, so EditConfig still saves its value
watch(
  () => config.value?.values[LOG_LEVEL_KEY],
  (logLevel) => {
    if (logLevel) logLevel.hidden = true;
  },
  { immediate: true },
);

// methods
const resetToDefaults = function () {
  editConfig.value?.resetToDefaults();
};

const onSubmit = async function (values: Record<string, ConfigValueType>) {
  // save core config
  loading.value = true;
  api
    .saveCoreConfig(config.value!.domain, values)
    .then(() => {
      router.push({ name: "systemsettings" });
    })
    .catch(() => {
      // the api reports the failure itself
      editConfig.value?.saveFailed();
    })
    .finally(() => {
      loading.value = false;
    });
};

const onImmediateApply = async function (
  values: Record<string, ConfigValueType>,
) {
  // Immediately apply a config value change to the backend
  // and refresh the local config with the server response
  const updatedConfig = await api.saveCoreConfig(config.value!.domain, values);
  // the other values the user changed are still waiting for a save
  config.value!.values = mergeConfigEntries(
    config.value!.values,
    updatedConfig.values,
    Object.keys(values),
  );
};

const { onAction } = useConfigAction({
  config,
  loading,
  invokeAction: (action) =>
    api.invokeCoreConfigAction(config.value!.domain, action),
  saveValues: (values) => api.saveCoreConfig(config.value!.domain, values),
});
</script>
