<template>
  <section class="p-4">
    <SettingsHeaderCard
      :icon="Volume2"
      :title="$t('settings.category.player_controls')"
      :description="playerName"
      :documentation-url="documentationUrl"
      :reset-disabled="!config?.enabled"
      @reset-to-defaults="resetToDefaults"
    />

    <edit-config
      v-if="config"
      ref="editConfig"
      :disabled="!config.enabled"
      :config-entries="configEntries"
      @submit="onSubmit"
      @action="onAction"
      @immediate-apply="onImmediateApply"
    />

    <!-- z-index clears the player bar (2001), which floats above page content -->
    <div
      v-if="loading"
      data-testid="loading-overlay"
      class="fixed inset-0 z-[2100] flex items-center justify-center bg-background/80"
    >
      <Spinner class="size-16" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { Spinner } from "@/components/ui/spinner";
import { usePlayerConfig } from "@/composables/settings/players/usePlayerConfig";
import {
  ConfigEntryUI,
  HASS_CONTROL_KEY_BY_PLAYER_KEY,
  HassControlPickerEntry,
  HassControlPlayerKey,
  UI_ENTRY_TYPE,
} from "@/helpers/config_entry_ui";
import { getHassProviderInstance } from "@/helpers/hass_controls";
import { goBack } from "@/helpers/navigation";
import { getPlayerConfigPage, getPlayerName } from "@/helpers/player_config";
import { getExternalLinkUrl } from "@/helpers/utils";
import { ConfigValueType } from "@/plugins/api/interfaces";
import { Volume2 } from "@lucide/vue";
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import EditConfig from "./EditConfig.vue";
import SettingsHeaderCard from "./SettingsHeaderCard.vue";

const CONTROLS_DOCS_URL =
  "https://music-assistant.io/settings/individual-player/#player-controls";

// global refs
const router = useRouter();
const editConfig = ref<InstanceType<typeof EditConfig>>();

// props
const props = defineProps<{
  playerId: string;
}>();

const { config, player, loading, save, onImmediateApply, onAction } =
  usePlayerConfig(() => props.playerId, editConfig, {
    // the player is gone, and with it the settings this page shows
    onRemoved: () => {
      editConfig.value?.discardChanges();
      router.replace({ name: "playersettings" });
    },
  });

// computed properties
const configEntries = computed(() => {
  if (!config.value || !player.value) return [];

  // offer the Home Assistant entity picker beneath each player control entry, but only
  // while there is a Home Assistant provider to register the picked entity with
  const hassInstance = getHassProviderInstance();
  const entries: ConfigEntryUI[] = [];
  for (const entry of Object.values(config.value.values)) {
    if (getPlayerConfigPage(entry, player.value) !== "controls") continue;
    entries.push(entry);
    const hassControlKey =
      HASS_CONTROL_KEY_BY_PLAYER_KEY[entry.key as HassControlPlayerKey];
    if (!hassInstance || !hassControlKey) continue;
    const pickerEntry: HassControlPickerEntry = {
      injected: true,
      key: `${entry.key}_${UI_ENTRY_TYPE.HASS_CONTROL_PICKER}`,
      type: UI_ENTRY_TYPE.HASS_CONTROL_PICKER,
      category: entry.category,
      category_label: entry.category_label,
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
  return entries;
});

const playerName = computed(() =>
  config.value ? getPlayerName(config.value) : undefined,
);

// the docs of a beta server live on the beta site
const documentationUrl = computed(() => getExternalLinkUrl(CONTROLS_DOCS_URL));

// methods
const resetToDefaults = function () {
  editConfig.value?.resetToDefaults();
};

const onSubmit = async function (values: Record<string, ConfigValueType>) {
  if (await save(values)) {
    goBack(router, {
      name: "editplayer",
      params: { playerId: props.playerId },
    });
  }
};
</script>
