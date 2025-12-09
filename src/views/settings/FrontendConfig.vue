<template>
  <section class="frontend-config">
    <!-- Header card -->
    <v-card class="header-card mb-4" elevation="0">
      <div class="header-content">
        <div class="header-icon">
          <v-icon size="32" color="orange">mdi-palette</v-icon>
        </div>
        <div class="header-info">
          <h2 class="header-title">
            {{ $t("settings.frontend") }}
          </h2>
          <p class="header-description">
            {{ $t("settings.frontend_description") }}
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
            :disabled="false"
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

    <!-- Non-generic config entries (rendered in expansion panels by EditConfig) -->
    <EditConfig
      v-if="nonGenericConfigEntries.length > 0"
      :config-entries="nonGenericConfigEntries"
      :disabled="false"
      :show-generic-section="false"
      @submit="onEditConfigSubmit"
      @action="onAction"
    />

    <!-- Help dialog -->
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
        <v-card-text>
          {{
            $t(
              `settings.${showHelpInfo?.key}.description`,
              showHelpInfo?.description || "",
            )
          }}
        </v-card-text>
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

    <v-overlay
      v-model="loading"
      scrim="true"
      persistent
      style="display: flex; align-items: center; justify-content: center"
    >
      <v-progress-circular indeterminate size="64" color="primary" />
    </v-overlay>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import {
  ConfigEntry,
  ConfigEntryType,
  ConfigValueType,
} from "@/plugins/api/interfaces";
import ConfigEntryField from "./ConfigEntryField.vue";
import EditConfig from "./EditConfig.vue";
import { $t, i18n } from "@/plugins/i18n";
import { DEFAULT_MENU_ITEMS } from "@/constants";
import { api } from "@/plugins/api";
import { getSendspinDefaultSyncDelay } from "@/helpers/utils";

// global refs
const router = useRouter();
const config = ref<ConfigEntry[]>([]);
const loading = ref(false);
const showPasswordValues = ref(false);
const showHelpInfo = ref<ConfigEntry>();

// computed properties
const genericConfigEntries = computed(() => {
  return config.value.filter(
    (entry) => !entry.category || entry.category === "generic",
  );
});

const nonGenericConfigEntries = computed(() => {
  return config.value.filter(
    (entry) => entry.category && entry.category !== "generic",
  );
});

onMounted(() => {
  const storedMenuConf = localStorage.getItem("frontend.settings.menu_items");
  const enabledMenuItems: string[] = storedMenuConf
    ? storedMenuConf.split(",")
    : DEFAULT_MENU_ITEMS;

  const configEntries: ConfigEntry[] = [
    {
      key: "theme",
      type: ConfigEntryType.STRING,
      label: "theme",
      default_value: "auto",
      required: false,
      options: [
        { title: "auto", value: "auto" },
        { title: "dark", value: "dark" },
        { title: "light", value: "light" },
      ],
      multi_value: false,
      category: "generic",
      value: localStorage.getItem("frontend.settings.theme"),
    },
    {
      key: "language",
      type: ConfigEntryType.STRING,
      label: "language",
      default_value: "auto",
      required: false,
      options: [
        { title: "auto", value: "auto" },
        ...i18n.global.availableLocales.map((x) => {
          return { title: x, value: x };
        }),
      ],
      multi_value: false,
      category: "generic",
      value: localStorage.getItem("frontend.settings.language"),
    },
    {
      key: "menu_items",
      type: ConfigEntryType.STRING,
      label: "menu_items",
      default_value: DEFAULT_MENU_ITEMS,
      required: false,
      options: [
        { title: $t("home"), value: "home" },
        { title: $t("search"), value: "search" },
        { title: $t("artists"), value: "artists" },
        { title: $t("albums"), value: "albums" },
        { title: $t("tracks"), value: "tracks" },
        { title: $t("playlists"), value: "playlists" },
        { title: $t("audiobooks"), value: "audiobooks" },
        { title: $t("podcasts"), value: "podcasts" },
        { title: $t("radios"), value: "radios" },
        { title: $t("browse"), value: "browse" },
        { title: $t("settings.settings"), value: "settings" },
      ],
      multi_value: true,
      category: "generic",
      value: enabledMenuItems,
    },
    {
      key: "force_mobile_layout",
      type: ConfigEntryType.BOOLEAN,
      label: "force_mobile_layout",
      default_value: false,
      required: false,
      multi_value: false,
      category: "generic",
      value:
        localStorage.getItem("frontend.settings.force_mobile_layout") ===
        "true",
    },
  ];

  // Show web player mode setting when Sendspin provider is available
  const sendspinAvailable = api.getProvider("sendspin")?.available ?? false;
  if (sendspinAvailable) {
    configEntries.splice(3, 0, {
      key: "web_player_mode",
      type: ConfigEntryType.STRING,
      label: "web_player_mode",
      default_value: "sendspin",
      required: false,
      options: [
        {
          title: $t("settings.web_player_mode.options.sendspin"),
          value: "sendspin",
        },
        {
          title: $t("settings.web_player_mode.options.disabled"),
          value: "disabled",
        },
      ],
      multi_value: false,
      category: "web_player",
      value:
        localStorage.getItem("frontend.settings.web_player_mode") || "sendspin",
    });

    // Sendspin sync delay option
    const defaultSyncDelay = getSendspinDefaultSyncDelay();
    configEntries.splice(4, 0, {
      key: "sendspin_sync_delay",
      type: ConfigEntryType.INTEGER,
      label: "sendspin_sync_delay",
      default_value: defaultSyncDelay,
      required: false,
      multi_value: false,
      category: "web_player",
      value: parseInt(
        localStorage.getItem("frontend.settings.sendspin_sync_delay") ||
          String(defaultSyncDelay),
        10,
      ),
    });

    // Output latency compensation - enabled by default everywhere
    const storedOutputLatency = localStorage.getItem(
      "frontend.settings.sendspin_output_latency_compensation",
    );
    configEntries.splice(5, 0, {
      key: "sendspin_output_latency_compensation",
      type: ConfigEntryType.BOOLEAN,
      label: "sendspin_output_latency_compensation",
      default_value: true,
      required: false,
      multi_value: false,
      category: "web_player",
      value:
        storedOutputLatency !== null ? storedOutputLatency === "true" : true,
    });
  }

  config.value = configEntries;
});

// methods
const saveValues = function (values: Record<string, ConfigValueType>) {
  for (const key in values) {
    const storageKey = `frontend.settings.${key}`;
    const value = values[key];
    if (value != null) {
      localStorage.setItem(storageKey, value.toString());
    } else {
      localStorage.removeItem(storageKey);
    }
  }
  router.push({ name: "home" }).then(() => {
    // enforce refresh
    window.location.reload();
  });
};

const onEditConfigSubmit = function (values: Record<string, ConfigValueType>) {
  // Merge generic entries values with the values from EditConfig
  for (const entry of genericConfigEntries.value) {
    if (entry.value !== undefined) {
      values[entry.key] = entry.value;
    }
  }
  saveValues(values);
};

const onAction = async function (
  action: string,
  _values: Record<string, ConfigValueType>,
) {};

const openLink = function (url: string) {
  const a = document.createElement("a");
  a.setAttribute("href", url);
  a.setAttribute("target", "_blank");
  a.click();
};

const hasDescriptionOrHelpLink = function (conf_entry: ConfigEntry) {
  return (
    (
      $t(
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
.frontend-config {
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
  background: rgba(255, 152, 0, 0.1);
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

@media (max-width: 600px) {
  .header-content {
    flex-direction: column;
    align-items: flex-start;
  }
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

/* Action buttons */
.config-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 24px;
  padding-top: 16px;
}
</style>
