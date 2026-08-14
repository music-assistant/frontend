<template>
  <section class="p-4">
    <div v-if="config" class="mb-4 flex flex-wrap items-center gap-3">
      <AdvancedSettingsToggle
        v-if="showAdvancedToggle"
        v-model:show-advanced-settings="showAdvancedSettings"
        test-id="player-advanced-settings"
      />
      <Button
        data-testid="player-reset-defaults"
        variant="ghost"
        size="sm"
        class="ml-auto"
        :disabled="!config.enabled"
        @click="resetToDefaults"
      >
        <RotateCcw class="size-4" />
        {{ $t("settings.reset_to_defaults") }}
      </Button>
    </div>

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
      :model-value="loading"
      scrim="true"
      persistent
      style="display: flex; align-items: center; justify-content: center"
    >
      <v-progress-circular indeterminate size="64" color="primary" />
    </v-overlay>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/plugins/api";
import {
  ConfigEntryType,
  ConfigValueType,
  EventType,
  PlayerConfig,
  PlayerFeature,
  PlayerType,
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
import { useConfigAction } from "@/composables/useConfigAction";
import { $t } from "@/plugins/i18n";
import { RotateCcw } from "@lucide/vue";
import AdvancedSettingsToggle from "./AdvancedSettingsToggle.vue";
import EditConfig from "./EditConfig.vue";
// global refs
const router = useRouter();
const config = ref<PlayerConfig>();
const editConfig = ref<InstanceType<typeof EditConfig>>();
const loading = ref(false);
const showAdvancedSettings = ref(false);
let configLoadRequestId = 0;
let configRefreshRequestId = 0;

// props
const props = defineProps<{
  playerId?: string;
}>();

const unsubProvidersUpdated = api.subscribe(EventType.PROVIDERS_UPDATED, () => {
  if (props.playerId) void refreshPlayerConfig(props.playerId);
});
onBeforeUnmount(unsubProvidersUpdated);

// computed properties
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

function resetPlayerState(playerId?: string) {
  if (config.value?.player_id === playerId) return;
  config.value = undefined;
  showAdvancedSettings.value = false;
}
</script>
