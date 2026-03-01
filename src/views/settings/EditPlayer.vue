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
      <v-card v-if="config" class="header-card mb-4" elevation="0">
        <div class="header-content">
          <div class="header-icon">
            <v-icon size="32" color="primary">mdi-speaker</v-icon>
          </div>
          <div class="header-info">
            <div class="header-title-row">
              <h2 class="header-title">
                {{
                  config.name ||
                  api.players[config.player_id]?.name ||
                  config.default_name
                }}
              </h2>
              <v-btn
                icon="mdi-pencil"
                variant="text"
                size="small"
                density="compact"
                class="rename-btn"
                @click="showRenameDialog = true"
              />
            </div>
            <div class="header-meta">
              <span class="meta-item">
                <v-icon size="14" class="mr-1">mdi-identifier</v-icon>
                {{ config.player_id }}
              </span>
              <span v-if="api.players[config.player_id]" class="meta-item">
                <v-icon size="14" class="mr-1">mdi-information</v-icon>
                {{ api.players[config.player_id].device_info.manufacturer }} /
                {{ api.players[config.player_id].device_info.model }}
              </span>
              <span
                v-if="
                  api.players[config.player_id]?.device_info.identifiers[
                    IdentifierType.IP_ADDRESS
                  ]
                "
                class="meta-item"
              >
                <v-icon size="14" class="mr-1">mdi-ip-network</v-icon>
                {{
                  api.players[config.player_id]?.device_info.identifiers[
                    IdentifierType.IP_ADDRESS
                  ]
                }}
              </span>
              <span
                v-if="
                  api.players[config.player_id]?.device_info.identifiers[
                    IdentifierType.MAC_ADDRESS
                  ]
                "
                class="meta-item"
              >
                <v-icon size="14" class="mr-1">mdi-network</v-icon>
                {{
                  api.players[config.player_id]?.device_info.identifiers[
                    IdentifierType.MAC_ADDRESS
                  ]
                }}
              </span>
              <span v-if="api.players[config.player_id]" class="meta-item">
                <v-icon size="14" class="mr-1">mdi-tag</v-icon>
                {{ $t(`player_type.${api.players[config.player_id].type}`) }}
              </span>
            </div>
            <div
              v-if="api.players[config.player_id]?.output_protocols?.length"
              class="protocol-chips"
            >
              <v-chip
                v-for="protocol in api.players[config.player_id]
                  .output_protocols"
                :key="protocol.output_protocol_id"
                size="x-small"
                variant="tonal"
                class="protocol-chip"
                :class="{
                  'protocol-chip--clickable': api.getProviderManifest(
                    protocol.protocol_domain!,
                  )?.documentation,
                }"
                @click="
                  api.getProviderManifest(protocol.protocol_domain!)
                    ?.documentation &&
                  openLinkInNewTab(
                    api.getProviderManifest(protocol.protocol_domain!)!
                      .documentation!,
                  )
                "
              >
                <template #prepend>
                  <ProviderIcon
                    :domain="protocol.protocol_domain!"
                    :size="14"
                    class="chip-icon"
                  />
                </template>
                {{
                  api.getProviderManifest(protocol.protocol_domain!)?.name ||
                  protocol.protocol_domain
                }}
                <v-icon
                  v-if="
                    api.getProviderManifest(protocol.protocol_domain!)
                      ?.documentation
                  "
                  size="12"
                  class="ml-1"
                  >mdi-open-in-new</v-icon
                >
              </v-chip>
            </div>
          </div>
        </div>
      </v-card>
    </div>

    <!-- Disabled banner -->
    <v-alert
      v-if="!config?.enabled"
      type="warning"
      variant="tonal"
      class="mb-4"
      closable
    >
      <div class="disabled-banner">
        <span>{{ $t("settings.player_disabled") }}</span>
        <v-btn
          size="small"
          color="warning"
          variant="flat"
          @click="enablePlayer"
        >
          {{ $t("settings.enable_player") }}
        </v-btn>
      </div>
    </v-alert>

    <!-- Needs setup banner -->
    <v-alert
      v-if="
        config && config.enabled && api.players[config.player_id]?.needs_setup
      "
      type="warning"
      variant="tonal"
      class="mb-4"
    >
      <div class="disabled-banner">
        <span>{{ $t("settings.player_needs_setup") }}</span>
      </div>
    </v-alert>

    <!-- Not available banner -->
    <v-alert
      v-else-if="
        config && config.enabled && !api.players[config.player_id]?.available
      "
      type="warning"
      variant="tonal"
      class="mb-4"
    >
      <div class="disabled-banner">
        <span>{{ $t("settings.player_not_available") }}</span>
      </div>
    </v-alert>

    <edit-config
      v-if="config"
      :disabled="!config?.enabled"
      :config-entries="config_entries"
      :default-expanded-protocol="nativeProtocolCategory"
      @submit="onSubmit"
      @action="onAction"
      @immediate-apply="onImmediateApply"
    />

    <!-- Rename dialog -->
    <v-dialog v-model="showRenameDialog" max-width="400">
      <v-card>
        <v-card-title>{{ $t("settings.player_name") }}</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="editName"
            :placeholder="
              api.players[config?.player_id!]?.name || config?.default_name
            "
            variant="outlined"
            density="comfortable"
            autofocus
            clearable
            @keyup.enter="saveRename"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showRenameDialog = false">
            {{ $t("close") }}
          </v-btn>
          <v-btn color="primary" variant="flat" @click="saveRename">
            {{ $t("settings.save") }}
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
  IdentifierType,
} from "@/plugins/api/interfaces";
import EditConfig from "./EditConfig.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import { watch } from "vue";

import { nanoid } from "nanoid";
import { ConfigEntryUI, UI_ENTRY_TYPE } from "@/helpers/config_entry_ui";
import { openLinkInNewTab } from "@/helpers/utils";
// global refs
const router = useRouter();
const config = ref<PlayerConfig>();
const sessionId = nanoid(11);
const loading = ref(false);
const showRenameDialog = ref(false);
const editName = ref<string | null>(null);

// props
const props = defineProps<{
  playerId?: string;
}>();

const dspEnabled = ref(false);

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

// Compute the native protocol category to auto-expand its accordion panel
const nativeProtocolCategory = computed(() => {
  if (!config.value) return undefined;
  const domain = api.getProviderManifest(config.value.provider)?.domain;
  return domain ? `protocol_${domain}` : undefined;
});

// computed properties
const config_entries = computed(() => {
  if (!config.value) return [];
  const player = api.players[config.value.player_id];
  if (!player) return [];

  // inject a link to the DSP config if the player is not a group
  const entries: ConfigEntryUI[] = Object.values(config.value.values);
  if (player.type !== PlayerType.GROUP) {
    entries.push({
      injected: true,
      key: "dsp_settings",
      type: UI_ENTRY_TYPE.DSP_SETTINGS_LINK,
      category: "dsp",
      label: "",
      required: false,
      read_only: false,
      default_value: dspEnabled.value,
    });
  } else if (
    player.type === PlayerType.GROUP &&
    player.supported_features.includes(PlayerFeature.MULTI_DEVICE_DSP)
  ) {
    entries.push({
      key: "dsp_note_multi_device_group",
      type: ConfigEntryType.LABEL,
      label: "You can configure the DSP for each player individually.",
      default_value: null,
      required: false,
      category: "dsp",
      injected: true,
    });
  } else if (
    player.type === PlayerType.GROUP &&
    !player.supported_features.includes(PlayerFeature.MULTI_DEVICE_DSP)
  ) {
    entries.push({
      key: "dsp_note_multi_device_group_unsupported",
      type: ConfigEntryType.LABEL,
      label:
        "This group type does not support DSP when playing to multiple devices.",
      default_value: null,
      required: false,
      category: "dsp",
      injected: true,
    });
  }
  // add player options should they exist
  if (player && player.options.length > 0) {
    entries.push({
      key: "player_options",
      type: ConfigEntryType.OPTIONS,
      label: "",
      default_value: "",
      required: false,
      category: "options",
      injected: true,
    });
  }
  return entries;
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

watch(showRenameDialog, (val) => {
  if (val && config.value) {
    editName.value = config.value.name || null;
  }
});

// methods
const saveRename = function () {
  if (config.value) {
    config.value.name = editName.value || undefined;
  }
  loading.value = true;
  api
    .savePlayerConfig(props.playerId!, { name: config.value!.name || null })
    .finally(() => {
      loading.value = false;
      showRenameDialog.value = false;
    });
  showRenameDialog.value = false;
};

const enablePlayer = function () {
  loading.value = true;
  api
    .savePlayerConfig(props.playerId!, { enabled: true })
    .then(() => {
      router.back();
    })
    .finally(() => {
      loading.value = false;
    });
};

const onSubmit = async function (values: Record<string, ConfigValueType>) {
  values["enabled"] = config.value!.enabled;
  api.savePlayerConfig(props.playerId!, values);
  router.back();
};

const onImmediateApply = async function (
  values: Record<string, ConfigValueType>,
) {
  // Immediately apply a config value change to the backend
  loading.value = true;
  api
    .savePlayerConfig(props.playerId!, values)
    .then((updatedConfig) => {
      // update local config values without overwriting the entire object
      // because the action may have added new entries
      for (const [key, entry] of Object.entries(updatedConfig.values)) {
        if (config.value!.values[key] != null) continue;
        config.value!.values[key] = entry;
      }
    })
    .finally(() => {
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

.header-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.header-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  color: rgb(var(--v-theme-on-surface));
}

.rename-btn {
  opacity: 0.6;
  transition: opacity 0.2s ease;
}

.rename-btn:hover {
  opacity: 1;
}

.disabled-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
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

.protocol-chips {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.protocol-chip {
  text-transform: uppercase;
  font-size: 10px;
  letter-spacing: 0.3px;
}

.protocol-chip--clickable {
  cursor: pointer;
}

.protocol-chip--clickable:hover {
  opacity: 0.85;
}

.chip-icon {
  margin: 0 !important;
  width: auto !important;
}

.chip-icon :deep(div) {
  margin-left: 0 !important;
  margin-right: 4px !important;
  width: 14px !important;
  height: 14px !important;
}

.chip-icon :deep(.svg-wrapper) {
  width: 14px !important;
  height: 14px !important;
}

.chip-icon :deep(.svg-wrapper svg) {
  width: 14px !important;
  height: 14px !important;
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
