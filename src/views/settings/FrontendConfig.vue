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

    <!-- Config entries (generic entries shown in card, non-generic in expansion panels) -->
    <EditConfig
      v-if="config.length > 0"
      :config-entries="config"
      :disabled="false"
      @submit="onSubmit"
      @action="onAction"
      @immediate-apply="onImmediateApply"
    />

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
import { DEFAULT_MENU_ITEMS } from "@/constants";
import { getSendspinDefaultSyncDelay } from "@/helpers/utils";
import { webPlayer } from "@/plugins/web_player";
import {
  ConfigEntry,
  ConfigEntryType,
  ConfigValueType,
} from "@/plugins/api/interfaces";
import { $t, i18n } from "@/plugins/i18n";
import { useColorMode } from "@vueuse/core";
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import EditConfig from "./EditConfig.vue";
import { companionMode, isCompanionApp } from "@/plugins/companion";

// global refs
const router = useRouter();
const config = ref<ConfigEntry[]>([]);
const loading = ref(false);
const mode = useColorMode();

onMounted(() => {
  const storedMenuConf = localStorage.getItem("frontend.settings.menu_items");
  const enabledMenuItems: string[] = storedMenuConf
    ? storedMenuConf.split(",")
    : DEFAULT_MENU_ITEMS;
  const enabledMenuItemsSet = new Set(enabledMenuItems);
  for (const defaultItem of DEFAULT_MENU_ITEMS) {
    if (!enabledMenuItemsSet.has(defaultItem)) {
      enabledMenuItems.push(defaultItem);
      enabledMenuItemsSet.add(defaultItem);
    }
  }

  const storedTheme = localStorage.getItem("frontend.settings.theme") || "auto";
  mode.value = storedTheme as "light" | "dark" | "auto";

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
      value: storedTheme,
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
        { title: $t("genres"), value: "genres" },
        { title: $t("browse"), value: "browse" },
        { title: $t("settings.settings"), value: "settings" },
      ],
      multi_value: true,
      category: "generic",
      value: enabledMenuItems,
    },
    {
      key: "enable_browser_controls",
      type: ConfigEntryType.BOOLEAN,
      label: "enable_browser_controls",
      default_value: true,
      required: false,
      multi_value: false,
      category: "generic",
      hidden: companionMode.value,
      value:
        localStorage.getItem("frontend.settings.enable_browser_controls") !==
        "false",
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
    {
      key: "mobile_sidebar_side",
      type: ConfigEntryType.STRING,
      label: "mobile_sidebar_side",
      default_value: "left",
      required: false,
      options: [
        { title: "Left", value: "left" },
        { title: "Right", value: "right" },
      ],
      multi_value: false,
      category: "generic",
      value:
        localStorage.getItem("frontend.settings.mobile_sidebar_side") || "left",
    },
  ];

  // Add web player settings (if not running in companion mode)
  if (!companionMode.value) {
    configEntries.push({
      key: "web_player_enabled",
      type: ConfigEntryType.BOOLEAN,
      label: "web_player_enabled",
      default_value: true,
      required: false,
      category: "web_player",
      value:
        localStorage.getItem("frontend.settings.web_player_enabled") !==
        "false",
    });

    // Sendspin sync delay option
    const defaultSyncDelay = getSendspinDefaultSyncDelay();
    configEntries.push({
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
      range: [-1000, 1000],
      immediate_apply: true,
      depends_on: "web_player_enabled",
    });

    // Output latency compensation - enabled by default everywhere
    const storedOutputLatency = localStorage.getItem(
      "frontend.settings.sendspin_output_latency_compensation",
    );
    configEntries.push({
      key: "sendspin_output_latency_compensation",
      type: ConfigEntryType.BOOLEAN,
      label: "sendspin_output_latency_compensation",
      default_value: true,
      required: false,
      multi_value: false,
      category: "web_player",
      value:
        storedOutputLatency !== null ? storedOutputLatency === "true" : true,
      depends_on: "web_player_enabled",
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

      if (key === "theme") {
        mode.value = value.toString() as "light" | "dark" | "auto";
      }
    } else {
      localStorage.removeItem(storageKey);
    }
  }
  router.push({ name: "home" }).then(() => {
    // enforce refresh
    window.location.reload();
  });
};

const onSubmit = function (values: Record<string, ConfigValueType>) {
  saveValues(values);
};

const onAction = async function (
  _action: string,
  _values: Record<string, ConfigValueType>,
) {};

const onImmediateApply = function (values: Record<string, ConfigValueType>) {
  for (const key in values) {
    localStorage.setItem(`frontend.settings.${key}`, String(values[key]));
  }
  if ("sendspin_sync_delay" in values) {
    webPlayer.setSyncDelay(values.sendspin_sync_delay as number);
  }
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
</style>
