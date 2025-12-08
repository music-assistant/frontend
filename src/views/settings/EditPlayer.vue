<template>
  <section class="edit-player">
    <div
      v-if="
        config &&
        api.getProviderManifest(config.provider)!.domain in
          api.providerManifests
      "
    >
      <!-- Header card -->
      <v-card class="header-card mb-4" elevation="0">
        <div class="header-content">
          <div class="header-icon">
            <v-icon size="32" color="primary">mdi-speaker</v-icon>
          </div>
          <div class="header-info">
            <h2 class="header-title">
              {{
                config.name ||
                api.players[config.player_id]?.name ||
                config.default_name
              }}
            </h2>
            <div class="header-meta">
              <span class="meta-item">
                <v-icon size="14" class="mr-1">mdi-identifier</v-icon>
                {{ config.player_id }}
              </span>
              <span class="meta-item">
                <v-icon size="14" class="mr-1">mdi-puzzle</v-icon>
                {{ api.getProviderManifest(config.provider)?.name }}
                <a
                  v-if="api.getProviderManifest(config.provider)?.documentation"
                  class="docs-link"
                  @click="
                    openLinkInNewTab(
                      api.getProviderManifest(config.provider)?.documentation!,
                    )
                  "
                >
                  <v-icon size="12">mdi-open-in-new</v-icon>
                </a>
              </span>
              <span v-if="api.players[config.player_id]" class="meta-item">
                <v-icon size="14" class="mr-1">mdi-information</v-icon>
                {{ api.players[config.player_id].device_info.manufacturer }} /
                {{ api.players[config.player_id].device_info.model }}
              </span>
              <span
                v-if="api.players[config.player_id]?.device_info.ip_address"
                class="meta-item"
              >
                <v-icon size="14" class="mr-1">mdi-ip-network</v-icon>
                {{ api.players[config.player_id].device_info.ip_address }}
              </span>
              <span v-if="api.players[config.player_id]" class="meta-item">
                <v-icon size="14" class="mr-1">mdi-tag</v-icon>
                {{ $t(`player_type.${api.players[config.player_id].type}`) }}
              </span>
            </div>
          </div>
        </div>
      </v-card>

      <!-- Basic settings card -->
      <v-card class="settings-card mb-4" elevation="0">
        <div class="settings-card-header">
          <v-icon size="20">mdi-cog</v-icon>
          <h3 class="settings-card-title">
            {{ $t("settings.category.generic", "Basic settings") }}
          </h3>
        </div>
        <div class="settings-card-content">
          <v-text-field
            v-if="'name' in config"
            v-model="config.name"
            :placeholder="config?.name"
            :label="$t('settings.player_name')"
            variant="outlined"
            density="comfortable"
            clearable
          />
          <v-switch
            v-if="'enabled' in config"
            v-model="config.enabled"
            :label="$t('settings.enable_player')"
            color="primary"
            :disabled="api.getProviderManifest(config.provider)?.builtin"
            hide-details
          />
          <!-- Generic config entries -->
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
      :disabled="!config.enabled"
      :config-entries="nonGenericConfigEntries"
      :show-generic-section="false"
      @submit="onSubmit"
      @action="onAction"
    />
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
import { computed, onBeforeUnmount, ref } from "vue";
import { useRouter } from "vue-router";
import { api } from "@/plugins/api";
import {
  ConfigEntryType,
  ConfigValueType,
  DSPConfig,
  EventType,
  PlayerConfig,
  PlayerFeature,
  PlayerType,
  ConfigEntry,
} from "@/plugins/api/interfaces";
import EditConfig from "./EditConfig.vue";
import ConfigEntryField from "./ConfigEntryField.vue";
import { watch } from "vue";
import { openLinkInNewTab, markdownToHtml } from "@/helpers/utils";
import { nanoid } from "nanoid";
import { useI18n } from "vue-i18n";

// global refs
const router = useRouter();
const config = ref<PlayerConfig>();
const sessionId = nanoid(11);
const loading = ref(false);

// props
const props = defineProps<{
  playerId?: string;
}>();

const dspEnabled = ref(false);
const showPasswordValues = ref(false);
const showHelpInfo = ref<ConfigEntry>();

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

const loadDSPEnabled = async () => {
  if (props.playerId) {
    try {
      dspEnabled.value = (await api.getDSPConfig(props.playerId)).enabled;
    } catch (error) {
      console.error("Error fetching DSP config:", error);
    }
  }
};
loadDSPEnabled();

const unsub = api.subscribe(
  EventType.PLAYER_DSP_CONFIG_UPDATED,
  (evt: { data: DSPConfig }) => {
    dspEnabled.value = evt.data.enabled;
  },
);
onBeforeUnmount(unsub);

// computed properties

const config_entries = computed(() => {
  if (!config.value) return [];
  const entries = Object.values(config.value.values);
  // inject a DSP config property if the player is not a group
  const player = api.players[config.value.player_id];
  if (player && player.type !== PlayerType.GROUP) {
    entries.push({
      key: "dsp_settings",
      type: ConfigEntryType.DSP_SETTINGS,
      label: "",
      default_value: dspEnabled.value,
      required: false,
      category: "audio",
    });
  } else if (
    player &&
    player.type === PlayerType.GROUP &&
    player.supported_features.includes(PlayerFeature.MULTI_DEVICE_DSP)
  ) {
    entries.push({
      key: "dsp_note_multi_device_group",
      type: ConfigEntryType.LABEL,
      label: "You can configure the DSP for each player individually.",
      default_value: null,
      required: false,
      category: "audio",
    });
  } else if (
    player &&
    player.type === PlayerType.GROUP &&
    !player.supported_features.includes(PlayerFeature.MULTI_DEVICE_DSP)
  ) {
    entries.push({
      key: "dsp_note_multi_device_group_not_supported",
      type: ConfigEntryType.LABEL,
      label:
        "This group type does not support DSP when playing to multiple devices.",
      default_value: null,
      required: false,
      category: "audio",
    });
  }
  return entries;
});

const genericConfigEntries = computed(() => {
  return config_entries.value.filter(
    (entry) =>
      (!entry.category || entry.category === "generic") && isVisible(entry),
  );
});

const nonGenericConfigEntries = computed(() => {
  return config_entries.value.filter(
    (entry) => entry.category && entry.category !== "generic",
  );
});

// watchers

watch(
  () => props.playerId,
  async (val) => {
    if (val) {
      config.value = await api.getPlayerConfig(val);
    }
  },
  { immediate: true },
);

// methods
const onSubmit = async function (values: Record<string, ConfigValueType>) {
  delete values["dsp_settings"]; // delete the injected dsp_settings since its UI only
  values["enabled"] = config.value!.enabled;
  values["name"] = config.value!.name || null;
  api.savePlayerConfig(props.playerId!, values);
  router.push({ name: "playersettings" });
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
  // ensure the session id is passed along (for auth actions)
  values["session_id"] = sessionId;
  api
    .getPlayerConfigEntries(config.value!.player_id, action, values)
    .then((entries) => {
      config.value!.values = {};
      for (const entry of entries) {
        config.value!.values[entry.key] = entry;
      }
    })
    .catch((err) => {
      // TODO: make this a bit more fancy someday
      alert(err);
    })
    .finally(() => {
      loading.value = false;
    });
};

const openDspConfig = function () {
  router.push(`/settings/editplayer/${props.playerId}/dsp`);
};

const openLink = function (url: string) {
  const a = document.createElement("a");
  a.setAttribute("href", url);
  a.setAttribute("target", "_blank");
  a.click();
};

const hasDescriptionOrHelpLink = function (conf_entry: ConfigEntry) {
  const { t } = useI18n();
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
.edit-player {
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

.header-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.meta-item {
  display: inline-flex;
  align-items: center;
  font-size: 0.813rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.docs-link {
  margin-left: 4px;
  cursor: pointer;
  color: rgb(var(--v-theme-primary));
  opacity: 0.8;
  transition: opacity 0.2s ease;
}

.docs-link:hover {
  opacity: 1;
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

@media (max-width: 600px) {
  .header-content {
    flex-direction: column;
    align-items: flex-start;
  }

  .header-meta {
    flex-direction: column;
    gap: 8px;
  }
}
</style>
