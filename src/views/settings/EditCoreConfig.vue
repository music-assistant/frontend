<template>
  <v-container class="pa-4 mx-auto" style="max-width: 600px">
    <div v-if="config && api.providerManifests[config.domain]">
      <!-- Header -->
      <div class="d-flex align-center mb-6">
        <v-avatar color="primary" variant="tonal" size="48" class="mr-4">
          <v-icon size="24">{{ getCoreIcon(config.domain) }}</v-icon>
        </v-avatar>
        <div>
          <h2 class="text-h6 font-weight-bold">
            {{ getItemTitle(config) }}
          </h2>
          <p class="text-body-2 text-medium-emphasis">
            {{ getItemDescription(config) }}
          </p>
        </div>
      </div>
    </div>

    <edit-config
      v-if="config"
      :config-entries="allConfigEntries"
      :disabled="false"
      @submit="onSubmit"
      @action="onAction"
    />

    <v-overlay
      v-model="loading"
      scrim="true"
      persistent
      class="loading-overlay"
    >
      <v-progress-circular indeterminate size="64" color="primary" />
    </v-overlay>
  </v-container>
</template>

<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { api } from "@/plugins/api";
import {
  CoreConfig,
  ConfigValueType,
  ConfigEntry,
} from "@/plugins/api/interfaces";
import EditConfig from "./EditConfig.vue";
import { nanoid } from "nanoid";

// global refs
const router = useRouter();
const { t } = useI18n();
const config = ref<CoreConfig>();
const sessionId = nanoid(11);
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

const getCoreIcon = (domain: string): string => {
  const iconMap: Record<string, string> = {
    streams: "mdi-radio-tower",
    players: "mdi-speaker-multiple",
    metadata: "mdi-tag-multiple",
    music: "mdi-music",
    webserver: "mdi-web",
    cache: "mdi-cached",
  };
  return iconMap[domain] || "mdi-cog";
};

const onSubmit = async function (values: Record<string, ConfigValueType>) {
  // save new provider config
  loading.value = true;
  api
    .saveCoreConfig(config.value!.domain, values)
    .then(() => {
      loading.value = false;
      router.push({ name: "providersettings" });
    })
    .catch((err) => {
      // TODO: make this a bit more fancy someday
      alert(err);
      loading.value = false;
    });
};

const onAction = async function (
  action: string,
  values: Record<string, ConfigValueType>,
) {
  loading.value = true;
  // append existing ConfigEntry values to allow
  // values be passed between flow steps
  for (const entry of Object.values(config.value!.values)) {
    if (entry.value !== undefined && values[entry.key] == undefined) {
      values[entry.key] = entry.value;
    }
  }
  // ensure the session id is passed along
  values["session_id"] = sessionId;
  api
    .getCoreConfigEntries(config.value!.domain, action, values)
    .then((entries) => {
      config.value!.values = {};
      for (const entry of entries) {
        config.value!.values[entry.key] = entry;
      }
      loading.value = false;
    })
    .catch((err) => {
      // TODO: make this a bit more fancy someday
      alert(err);
      loading.value = false;
    });
};
</script>

<style scoped>
.loading-overlay {
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
