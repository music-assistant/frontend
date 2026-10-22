<template>
  <section class="p-4">
    <SettingsHeaderCard
      v-if="config && api.providerManifests[config.domain]"
      :icon="getCoreIcon(config.domain)"
      :title="getItemTitle(config)"
      :description="getItemDescription(config)"
      :documentation-url="
        getExternalLinkUrl(api.providerManifests[config.domain].documentation)
      "
      @reset-to-defaults="resetToDefaults"
    />

    <ServerUrlsCard
      v-if="config?.domain === 'webserver'"
      ref="urlCard"
      :base-url="config.values.base_url"
      :external-url="config.values.external_url"
      @update:value="onUrlUpdate"
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
import { getExternalLinkUrl } from "@/helpers/utils";
import { api } from "@/plugins/api";
import { ConfigValueType, CoreConfig } from "@/plugins/api/interfaces";
import {
  Database,
  Globe,
  Music,
  RadioTower,
  Settings2,
  Speaker,
  Tags,
} from "@lucide/vue";
import { computed, ref, watch, type Component } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import EditConfig from "./EditConfig.vue";
import ServerUrlsCard from "./ServerUrlsCard.vue";
import SettingsHeaderCard from "./SettingsHeaderCard.vue";

// global refs
const router = useRouter();
const { t } = useI18n();
const config = ref<CoreConfig>();
const editConfig = ref<InstanceType<typeof EditConfig>>();
const urlCard = ref<InstanceType<typeof ServerUrlsCard>>();
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

// the webserver entries the URL card edits in place of the form
const urlCardEntries = computed(() => {
  if (config.value?.domain !== "webserver") return [];
  const { base_url, external_url } = config.value.values;
  return [base_url, external_url];
});

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

// hidden from the form, while EditConfig still saves and guards their values
watch(
  urlCardEntries,
  (entries) => {
    for (const entry of entries) entry.hidden = true;
  },
  { immediate: true },
);

// methods
const getItemTitle = (item: CoreConfig) => {
  // Try translation first, fall back to manifest
  const translated = t(`settings.core_module.${item.domain}.name`);
  // If translation returns the key itself, it doesn't exist - use manifest
  return translated !== `settings.core_module.${item.domain}.name`
    ? translated
    : api.providerManifests[item.domain].name;
};

const getItemDescription = (item: CoreConfig) => {
  const translated = t(`settings.core_module.${item.domain}.description`);
  return translated !== `settings.core_module.${item.domain}.description`
    ? translated
    : api.providerManifests[item.domain].description;
};

const getCoreIcon = (domain: string): Component => {
  const iconMap: Record<string, Component> = {
    streams: RadioTower,
    players: Speaker,
    metadata: Tags,
    music: Music,
    webserver: Globe,
    cache: Database,
  };
  return iconMap[domain] || Settings2;
};

const resetToDefaults = function () {
  editConfig.value?.resetToDefaults();
  // the form's reset skips hidden entries, and these are hidden only because
  // the URL card shows them
  for (const entry of urlCardEntries.value) entry.value = entry.default_value;
  urlCard.value?.reset();
};

const onUrlUpdate = function (key: string, value: string) {
  config.value!.values[key].value = value;
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
  for (const [key, entry] of Object.entries(updatedConfig.values)) {
    config.value!.values[key] = entry;
  }
};

const { onAction } = useConfigAction({
  config,
  loading,
  invokeAction: (action) =>
    api.invokeCoreConfigAction(config.value!.domain, action),
  saveValues: (values) => api.saveCoreConfig(config.value!.domain, values),
});
</script>
