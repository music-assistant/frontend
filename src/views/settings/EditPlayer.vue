<template>
  <section class="edit-player">
    <div v-if="config">
      <!-- Header card -->
      <Card class="mb-4 gap-0 py-0">
        <CardHeader class="relative flex flex-col gap-5 p-6 pr-16 sm:flex-row">
          <div class="header-icon">
            <PlayerIcon
              :icon="api.players[config.player_id]?.icon"
              :size="32"
              class="text-primary"
            />
          </div>
          <div class="header-info">
            <div class="header-title-row">
              <h2 class="header-title">{{ getPlayerName(config) }}</h2>
              <Button
                variant="ghost"
                size="icon-sm"
                class="rename-btn"
                :title="$t('settings.player_name')"
                @click="renamePlayer"
              >
                <Pencil class="size-4" />
                <span class="sr-only">{{ $t("settings.player_name") }}</span>
              </Button>
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
              v-if="api.players[config.player_id]?.output_protocols.length"
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
                    protocol.protocol_domain,
                  )?.documentation,
                  'protocol-chip--unavailable': !protocol.available,
                }"
                @click="
                  api.getProviderManifest(protocol.protocol_domain)
                    ?.documentation &&
                  openLinkInNewTab(
                    api.getProviderManifest(protocol.protocol_domain)!
                      .documentation!,
                  )
                "
              >
                <template #prepend>
                  <ProviderIcon
                    :domain="protocol.protocol_domain"
                    :size="14"
                    class="chip-icon"
                  />
                </template>
                {{
                  api.getProviderManifest(protocol.protocol_domain)?.name ||
                  protocol.protocol_domain
                }}
                <v-icon
                  v-if="
                    api.getProviderManifest(protocol.protocol_domain)
                      ?.documentation
                  "
                  size="12"
                  class="ml-1"
                  >mdi-open-in-new</v-icon
                >
              </v-chip>
            </div>
          </div>
          <Button
            data-testid="player-menu"
            variant="ghost"
            size="icon-sm"
            class="absolute top-4 right-4"
            aria-haspopup="menu"
            :aria-label="$t('more_options')"
            @click="openPlayerMenu"
          >
            <MoreVertical class="size-4" />
          </Button>
        </CardHeader>
        <CardContent
          v-if="playerSetupLabel || showAdvancedToggle"
          class="flex flex-wrap items-center gap-3 border-t bg-muted/20 px-6 py-4"
        >
          <Button
            v-if="playerSetupLabel"
            data-testid="player-setup"
            @click="startPlayerSetup"
          >
            <RefreshCw class="size-4" />
            {{ $t(playerSetupLabel) }}
          </Button>
          <AdvancedSettingsToggle
            v-if="showAdvancedToggle"
            v-model:show-advanced-settings="showAdvancedSettings"
            test-id="player-advanced-settings"
          />
        </CardContent>
      </Card>
    </div>

    <!-- Disabled banner -->
    <v-alert
      v-if="config && !config.enabled"
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
          :loading="enabling"
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
        <v-btn
          size="small"
          color="warning"
          variant="flat"
          @click="startPlayerSetup"
        >
          {{ $t("settings.start_setup") }}
        </v-btn>
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

    <PlayerSettingsLinks
      v-if="config"
      :player-id="config.player_id"
      class="mb-4"
    />

    <edit-config
      v-if="config"
      ref="editConfig"
      v-model:show-advanced-settings="showAdvancedSettings"
      :disabled="!config?.enabled"
      :config-entries="config_entries"
      :output-protocols="api.players[config.player_id]?.output_protocols || []"
      @submit="onSubmit"
      @action="onAction"
      @immediate-apply="onImmediateApply"
    />

    <v-overlay
      :model-value="loading || enabling"
      scrim="true"
      persistent
      style="display: flex; align-items: center; justify-content: center"
    >
      <v-progress-circular indeterminate size="64" color="primary" />
    </v-overlay>
  </section>
</template>

<script setup lang="ts">
import { computed, markRaw, onBeforeUnmount, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";
import ProviderIcon from "@/components/ProviderIcon.vue";
import PlayerIcon from "@/components/PlayerIcon.vue";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { api } from "@/plugins/api";
import {
  ConfigEntryType,
  ConfigValueType,
  EventMessage,
  EventType,
  PlayerConfig,
  PlayerFeature,
  PlayerType,
  IdentifierType,
} from "@/plugins/api/interfaces";
import {
  ConfigEntryUI,
  HASS_CONTROL_KEY_BY_PLAYER_KEY,
  HassControlPickerEntry,
  HassControlPlayerKey,
  UI_ENTRY_TYPE,
  hasAdvancedEntries,
  isInjected,
  mergeConfigEntries,
} from "@/helpers/config_entry_ui";
import { getHassProviderInstance } from "@/helpers/hass_controls";
import { goBack } from "@/helpers/navigation";
import { getPlayerSetupLabel } from "@/helpers/player_config";
import {
  getPlayerName,
  getPlayerSettingsMenuItems,
} from "@/helpers/player_settings_actions";
import { useConfigAction } from "@/composables/useConfigAction";
import { openLinkInNewTab } from "@/helpers/utils";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { MoreVertical, Pencil, RefreshCw, RotateCcw } from "@lucide/vue";
import AdvancedSettingsToggle from "./AdvancedSettingsToggle.vue";
import EditConfig from "./EditConfig.vue";
import PlayerSettingsLinks from "./PlayerSettingsLinks.vue";
// global refs
const router = useRouter();
const config = ref<PlayerConfig>();
const editConfig = ref<InstanceType<typeof EditConfig>>();
const loading = ref(false);
const showAdvancedSettings = ref(false);
const enabling = ref(false);
let configLoadRequestId = 0;
let configRefreshRequestId = 0;
let enableRequestId = 0;

// props
const props = defineProps<{
  playerId?: string;
}>();

const unsubProvidersUpdated = api.subscribe(EventType.PROVIDERS_UPDATED, () => {
  if (props.playerId) void refreshPlayerConfig(props.playerId);
});
onBeforeUnmount(unsubProvidersUpdated);

// renaming, enabling and deleting all happen through the shared menu, so pick the
// change up from the server rather than from whoever made it
const unsubConfigUpdated = api.subscribe(
  EventType.PLAYER_CONFIG_UPDATED,
  (evt: EventMessage) => {
    if (evt.object_id && evt.object_id === props.playerId) {
      void refreshPlayerConfig(evt.object_id);
    }
  },
);
onBeforeUnmount(unsubConfigUpdated);

// computed properties
const player = computed(() =>
  config.value ? api.players[config.value.player_id] : undefined,
);

const playerSetupLabel = computed(() =>
  config.value?.enabled ? getPlayerSetupLabel(player.value) : undefined,
);

const config_entries = computed(() => {
  if (!config.value) return [];
  const player = api.players[config.value.player_id];
  if (!player) return [];

  // offer the Home Assistant entity picker beneath each player control entry, but only
  // while there is a Home Assistant provider to register the picked entity with
  const hassInstance = getHassProviderInstance();
  const entries: ConfigEntryUI[] = [];
  for (const entry of Object.values(config.value.values)) {
    entries.push(entry);
    const hassControlKey =
      HASS_CONTROL_KEY_BY_PLAYER_KEY[entry.key as HassControlPlayerKey];
    if (!hassInstance || !hassControlKey) continue;
    const pickerEntry: HassControlPickerEntry = {
      injected: true,
      key: `${entry.key}_${UI_ENTRY_TYPE.HASS_CONTROL_PICKER}`,
      type: UI_ENTRY_TYPE.HASS_CONTROL_PICKER,
      category: entry.category,
      // stay with the entry it fills in when the form hides, folds away or gates that one
      advanced: entry.advanced,
      hidden: entry.hidden,
      depends_on: entry.depends_on,
      depends_on_value: entry.depends_on_value,
      depends_on_value_not: entry.depends_on_value_not,
      label: "",
      required: false,
      options: [],
      default_value: null,
      hass_instance_id: hassInstance.instance_id,
      hass_control_key: hassControlKey,
      target_key: entry.key as HassControlPlayerKey,
    };
    entries.push(pickerEntry);
  }

  if (
    player.type === PlayerType.GROUP &&
    player.supported_features.includes(PlayerFeature.MULTI_DEVICE_DSP)
  ) {
    entries.push({
      key: "dsp_note_multi_device_group",
      type: ConfigEntryType.LABEL,
      label: $t("settings.dsp_note_multi_device_group.label"),
      default_value: null,
      required: false,
      options: [],
      category: "dsp",
      injected: true,
    });
  } else if (player.type === PlayerType.GROUP) {
    entries.push({
      key: "dsp_note_multi_device_group_unsupported",
      type: ConfigEntryType.LABEL,
      label: $t("settings.dsp_note_multi_device_group_unsupported.label"),
      default_value: null,
      required: false,
      options: [],
      category: "dsp",
      injected: true,
    });
  }
  // Frontend-injected entries need their category heading translated here
  // (server-provided entries get category_label resolved server-side).
  for (const entry of entries) {
    if (isInjected(entry) && entry.category) {
      entry.category_label = $t(
        `settings.category.${entry.category}`,
        entry.category,
      );
    }
  }
  return entries;
});

const showAdvancedToggle = computed(
  () => !!config.value?.enabled && hasAdvancedEntries(config_entries.value),
);

// watchers

watch(
  () => props.playerId,
  (val) => {
    resetPlayerState(val);
    if (val) void loadConfig(val);
  },
  { immediate: true },
);

// methods
const resetToDefaults = function () {
  editConfig.value?.resetToDefaults();
};

const openPlayerMenu = function (evt: MouseEvent) {
  if (!config.value) return;
  const menuItems = getPlayerSettingsMenuItems(config.value, {
    // the player is gone, and with it the page showing its settings; unsaved
    // edits have nothing left to save to, so they must not hold the way out
    onDeleted: () => {
      editConfig.value?.discardChanges();
      router.replace({ name: "playersettings" });
    },
  });
  // resetting acts on the form rather than on the player, so it is not part of
  // the menu the other player surfaces share
  menuItems.push({
    label: "settings.reset_to_defaults",
    action: resetToDefaults,
    icon: markRaw(RotateCcw),
    disabled: !config.value.enabled,
  });
  // a click from the keyboard carries no coordinates, so fall back to the
  // button itself and the menu opens against it rather than in the corner
  const trigger =
    evt.clientX || evt.clientY
      ? undefined
      : (evt.currentTarget as HTMLElement | null)?.getBoundingClientRect();
  eventbus.emit("contextmenu", {
    items: menuItems,
    posX: trigger ? trigger.left : evt.clientX,
    posY: trigger ? trigger.bottom : evt.clientY,
  });
};

const renamePlayer = function () {
  if (!config.value) return;
  eventbus.emit("playerRenameDialog", {
    playerId: config.value.player_id,
    name: config.value.name,
    defaultName: config.value.default_name,
  });
};

const enablePlayer = async function () {
  if (!config.value || enabling.value) return;

  const playerId = config.value.player_id;
  const requestId = ++enableRequestId;
  enabling.value = true;
  try {
    const updatedConfig = await api.savePlayerConfig(playerId, {
      enabled: true,
    });
    if (!isCurrentPlayer(playerId)) return;

    applyPlayerConfig(updatedConfig);
    toast.success($t("settings.player_saved"));
  } catch (err) {
    if (!isCurrentPlayer(playerId)) return;

    toast.error(String(err));
    await refreshPlayerConfig(playerId);
  } finally {
    if (requestId === enableRequestId) enabling.value = false;
  }
};

const startPlayerSetup = function () {
  if (!config.value?.enabled || !playerSetupLabel.value) return;
  eventbus.emit("setupFlowDialog", {
    kind: "player",
    playerId: config.value.player_id,
  });
};

const onSubmit = async function (values: Record<string, ConfigValueType>) {
  values["enabled"] = config.value!.enabled;
  loading.value = true;
  try {
    await api.savePlayerConfig(props.playerId!, values);
    goBack(router, { name: "playersettings" });
  } catch {
    // Error toast is already shown by the API layer (handleResultMessage).
    // We just prevent navigation so the user can correct values.
    editConfig.value?.saveFailed();
  } finally {
    loading.value = false;
  }
};

const onImmediateApply = async function (
  values: Record<string, ConfigValueType>,
) {
  // Immediately apply a config value change to the backend
  // and refresh the local config with the server response
  loading.value = true;
  api
    .savePlayerConfig(props.playerId!, values)
    .then((updatedConfig) => {
      // update local config values with the server response
      for (const [key, entry] of Object.entries(updatedConfig.values)) {
        config.value!.values[key] = entry;
      }
    })
    .finally(() => {
      loading.value = false;
    });
};

const { onAction } = useConfigAction({
  config,
  loading,
  invokeAction: (action) =>
    api.invokePlayerConfigAction(config.value!.player_id, action),
  saveValues: (values) => api.savePlayerConfig(props.playerId!, values),
});

async function loadConfig(playerId: string) {
  const requestId = ++configLoadRequestId;
  try {
    const updatedConfig = await api.getPlayerConfig(playerId);
    if (requestId === configLoadRequestId && props.playerId === playerId) {
      config.value = updatedConfig;
    }
  } catch (err) {
    if (requestId === configLoadRequestId && props.playerId === playerId) {
      toast.error(String(err));
    }
  }
}

async function refreshPlayerConfig(playerId: string) {
  if (config.value?.player_id !== playerId) return;
  const requestId = ++configRefreshRequestId;
  try {
    const updatedConfig = await api.getPlayerConfig(playerId);
    if (
      requestId === configRefreshRequestId &&
      props.playerId === playerId &&
      config.value?.player_id === playerId
    ) {
      applyPlayerConfig(updatedConfig);
    }
  } catch (err) {
    if (
      requestId === configRefreshRequestId &&
      props.playerId === playerId &&
      config.value?.player_id === playerId
    ) {
      toast.error(String(err));
    }
  }
}

function applyPlayerConfig(updatedConfig: PlayerConfig) {
  if (!config.value) return;
  config.value = {
    ...updatedConfig,
    values: mergeConfigEntries(config.value.values, updatedConfig.values),
  };
}

function isCurrentPlayer(playerId: string) {
  return props.playerId === playerId && config.value?.player_id === playerId;
}

function resetPlayerState(playerId?: string) {
  if (config.value?.player_id === playerId) return;
  config.value = undefined;
  showAdvancedSettings.value = false;
  enabling.value = false;
  enableRequestId++;
}
</script>

<style scoped>
.edit-player {
  padding: 16px;
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

.protocol-chip--unavailable {
  opacity: 0.4;
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
  .header-meta {
    flex-direction: column;
    gap: 8px;
  }
}
</style>
