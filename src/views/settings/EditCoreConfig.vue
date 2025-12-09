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

      <!-- Basic settings card (only if there are generic entries) -->
      <v-card
        v-if="genericConfigEntries.length > 0"
        class="settings-card mb-4"
        elevation="0"
      >
        <div class="settings-card-header">
          <v-icon size="20">mdi-cog</v-icon>
          <h3 class="settings-card-title">
            {{ $t("settings.category.generic", "Basic settings") }}
          </h3>
        </div>
        <div class="settings-card-content">
          <div
            v-for="conf_entry of genericConfigEntries"
            :key="conf_entry.key"
            class="config-entry"
          >
            <ConfigEntryField
              :conf-entry="conf_entry"
              :show-password-values="showPasswordValues"
              :disabled="isDisabled(conf_entry)"
              @toggle-password="showPasswordValues = !showPasswordValues"
              @clear-value="conf_entry.value = conf_entry.default_value"
              @update:value="conf_entry.value = $event"
              @action="
                onAction(conf_entry.action || conf_entry.key, {});
                conf_entry.value = conf_entry.action ? null : conf_entry.key;
              "
            />
            <v-btn
              v-if="hasDescriptionOrHelpLink(conf_entry)"
              icon="mdi-help-circle-outline"
              variant="text"
              size="small"
              class="help-btn"
              @click="
                $t(
                  `settings.${conf_entry?.key}.description`,
                  conf_entry.description || '',
                )
                  ? (showHelpInfo = conf_entry)
                  : openLink(conf_entry.help_link!)
              "
            />
          </div>
        </div>
      </v-card>
    </div>

    <edit-config
      v-if="config"
      :config-entries="nonGenericConfigEntries"
      :disabled="false"
      :show-generic-section="false"
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
    <v-dialog
      :model-value="showHelpInfo !== undefined"
      width="auto"
      @update:model-value="showHelpInfo = undefined"
    >
      <v-card>
        <v-card-text>
          <h2>
            {{
              $t(
                `settings.${showHelpInfo?.key}.label`,
                showHelpInfo?.label || "",
              )
            }}
          </h2>
        </v-card-text>
        <!-- eslint-disable vue/no-v-html -->
        <!-- eslint-disable vue/no-v-text-v-html-on-component -->
        <v-card-text
          v-html="
            markdownToHtml(
              $t(
                `settings.${showHelpInfo?.key}.description`,
                showHelpInfo?.description || '',
              ),
            )
          "
        />
        <!-- eslint-enable vue/no-v-html -->
        <!-- eslint-enable vue/no-v-text-v-html-on-component -->
        <v-card-actions>
          <v-btn
            v-if="showHelpInfo?.help_link"
            @click="openLink(showHelpInfo!.help_link!)"
          >
            {{ $t("read_more") }}
          </v-btn>
          <v-spacer />
          <v-btn color="primary" @click="showHelpInfo = undefined">
            {{ $t("close") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
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
import ConfigEntryField from "./ConfigEntryField.vue";
import { nanoid } from "nanoid";
import { markdownToHtml } from "@/helpers/utils";

// global refs
const router = useRouter();
const { t } = useI18n();
const config = ref<CoreConfig>();
const sessionId = nanoid(11);
const loading = ref(false);
const showPasswordValues = ref(false);
const showHelpInfo = ref<ConfigEntry>();

// props
const props = defineProps<{
  domain?: string;
}>();

// helper functions
const isNullOrUndefined = (value: unknown) => {
  return value === null || value === undefined;
};

const isVisible = (entry: ConfigEntry) => {
  return !entry.hidden;
};

const isDisabled = (entry: ConfigEntry) => {
  if (!config.value) return false;
  if (!isNullOrUndefined(entry.depends_on)) {
    const allEntries = Object.values(config.value.values);
    const dependentEntry = allEntries.find((x) => x.key == entry.depends_on);
    if (!dependentEntry) return false;

    const dependentValue = dependentEntry.value;

    if (!isNullOrUndefined(entry.depends_on_value)) {
      return dependentValue != entry.depends_on_value;
    }

    if (!isNullOrUndefined(entry.depends_on_value_not)) {
      return dependentValue == entry.depends_on_value_not;
    }

    return !dependentValue;
  }
  return false;
};

// computed properties
const genericConfigEntries = computed(() => {
  if (!config.value) return [];
  return Object.values(config.value.values).filter(
    (entry) =>
      (!entry.category || entry.category === "generic") && isVisible(entry),
  );
});

const nonGenericConfigEntries = computed(() => {
  if (!config.value) return [];
  return Object.values(config.value.values).filter(
    (entry) => entry.category && entry.category !== "generic",
  );
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

const openLink = function (url: string) {
  const a = document.createElement("a");
  a.setAttribute("href", url);
  a.setAttribute("target", "_blank");
  a.click();
};

const hasDescriptionOrHelpLink = function (conf_entry: ConfigEntry) {
  return (
    (
      t(
        `settings.${conf_entry?.key}.description`,
        conf_entry.description || " ",
      ) ||
      conf_entry.help_link ||
      " "
    )?.length > 1
  );
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

.settings-card {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 12px;
  overflow: hidden;
}

.settings-card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  background: rgba(var(--v-theme-primary), 0.08);
  border-bottom: 1px solid rgba(var(--v-theme-primary), 0.12);
}

.settings-card-header .v-icon {
  color: rgb(var(--v-theme-primary));
}

.settings-card-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0;
  color: rgb(var(--v-theme-primary));
}

.settings-card-content {
  padding: 20px;
}

/* Config entry row */
.config-entry {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 12px;
}

.config-entry:first-child {
  margin-top: 0;
}

/* Help button */
.help-btn {
  flex-shrink: 0;
  margin-top: 8px;
  opacity: 0.6;
  transition: opacity 0.2s ease;
}

.help-btn:hover {
  opacity: 1;
}

/* Add extra top margin for entries that follow a checkbox (which is shorter) */
.config-entry:has(.v-checkbox) + .config-entry:has(.v-text-field),
.config-entry:has(.v-checkbox) + .config-entry:has(.v-select),
.config-entry:has(.v-checkbox) + .config-entry:has(.v-slider),
.config-entry:has(.v-checkbox) + .config-entry:has(.v-combobox) {
  margin-top: 16px;
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
