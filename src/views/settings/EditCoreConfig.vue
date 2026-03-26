<template>
  <section class="edit-core-config">
    <div v-if="config && api.providerManifests[config.domain]">
      <!-- Header card -->
      <Card class="header-card mb-4">
        <div class="header-content">
          <div class="header-icon">
            <component :is="getCoreIcon(config.domain)" class="size-8 text-primary" />
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
      </Card>
    </div>

    <edit-config
      v-if="config"
      :config-entries="allConfigEntries"
      :disabled="false"
      @submit="onSubmit"
      @action="onAction"
      @immediate-apply="onImmediateApply"
    />

    <div
      v-if="loading"
      class="loading-overlay"
    >
      <Spinner class="size-16 text-primary" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/plugins/api";
import { ConfigValueType, CoreConfig } from "@/plugins/api/interfaces";
import {
  Radio,
  Speaker,
  Tags,
  Music,
  Globe,
  DatabaseZap,
  Settings,
} from "lucide-vue-next";
import { nanoid } from "nanoid";
import { computed, ref, watch, type Component } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";
import EditConfig from "./EditConfig.vue";

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

const getCoreIcon = (domain: string): Component => {
  const iconMap: Record<string, Component> = {
    streams: Radio,
    players: Speaker,
    metadata: Tags,
    music: Music,
    webserver: Globe,
    cache: DatabaseZap,
  };
  return iconMap[domain] || Settings;
};

const onSubmit = async function (values: Record<string, ConfigValueType>) {
  // save core config
  loading.value = true;
  api
    .saveCoreConfig(config.value!.domain, values)
    .then(() => {
      router.push({ name: "systemsettings" });
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
  // Immediately apply a config value change to the backend
  // and refresh the local config with the server response
  const updatedConfig = await api.saveCoreConfig(config.value!.domain, values);
  for (const [key, entry] of Object.entries(updatedConfig.values)) {
    config.value!.values[key] = entry;
  }
};

const onAction = async function (
  action: string,
  values: Record<string, ConfigValueType>,
  immediateApply: boolean,
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
    .then(async (entries) => {
      config.value!.values = {};
      for (const entry of entries) {
        config.value!.values[entry.key] = entry;
      }
      // If the action has immediate_apply, save the updated values right away
      if (immediateApply) {
        const saveValues: Record<string, ConfigValueType> = {};
        for (const entry of entries) {
          if (entry.value !== undefined) {
            saveValues[entry.key] = entry.value;
          }
        }
        const updatedConfig = await api.saveCoreConfig(
          config.value!.domain,
          saveValues,
        );
        for (const [key, entry] of Object.entries(updatedConfig.values)) {
          config.value!.values[key] = entry;
        }
      }
      loading.value = false;
    })
    .catch((err) => {
      toast.error(err.message || err);
      loading.value = false;
    });
};
</script>

<style scoped>
.edit-core-config {
  padding: 16px;
}

.header-card {
  border: 1px solid hsl(var(--border));
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
  background: hsl(var(--primary) / 0.1);
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
  color: hsl(var(--foreground));
}

.header-description {
  font-size: 0.875rem;
  color: hsl(var(--muted-foreground));
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
