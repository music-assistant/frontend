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
import { api } from "@/plugins/api";
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
      key: "startup_view",
      type: ConfigEntryType.STRING,
      label: "startup_view",
      default_value: "home",
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
      ],
      multi_value: false,
      category: "generic",
      value: localStorage.getItem("frontend.settings.startup_view") || "home",
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
      range: [-1000, 1000],
      immediate_apply: true,
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
