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
    </div>

    <edit-config
      v-if="config"
      :disabled="!config.enabled"
      :config-entries="allConfigEntries"
      :name-value="config.name ?? undefined"
      :name-placeholder="config.name || config.default_name"
      :name-label="$t('settings.player_name')"
      :enabled-value="config.enabled"
      :enabled-label="$t('settings.enable_player')"
      :enabled-disabled="api.getProviderManifest(config.provider)?.builtin"
      @update:name-value="config.name = $event ?? undefined"
      @update:enabled-value="config.enabled = $event"
      @submit="onSubmit"
      @action="onAction"
    />
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
import { watch } from "vue";
import { openLinkInNewTab } from "@/helpers/utils";
import { nanoid } from "nanoid";

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

// helper functions
const isVisible = (entry: ConfigEntry) => {
  return !entry.hidden;
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

const allConfigEntries = computed(() => {
  return config_entries.value.filter((entry) => isVisible(entry));
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
