<template>
  <section class="edit-core-config">
    <div v-if="config && api.providerManifests[config.domain]">
      <!-- Header card -->
      <v-card class="header-card mb-4" elevation="0">
        <div class="header-content">
          <div class="header-icon">
            <v-icon size="32" color="primary">{{
              getCoreIcon(config.domain)
            }}</v-icon>
          </div>
          <div class="header-info">
            <h2 class="header-title">
              {{ getItemTitle(config) }}
            </h2>
            <p class="header-description">
              {{ getItemDescription(config) }}
            </p>
          </div>
        </div>
      </v-card>
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
  </section>
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

// helper functions
const isVisible = (entry: ConfigEntry) => {
  return !entry.hidden;
};

// computed properties
const allConfigEntries = computed(() => {
  if (!config.value) return [];
  return Object.values(config.value.values).filter((entry) => isVisible(entry));
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
.edit-core-config {
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
