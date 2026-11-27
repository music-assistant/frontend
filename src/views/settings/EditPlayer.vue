<template>
  <section class="edit-player">
    <PlayerSettingsHeader
      v-if="config"
      :config="config"
      :player="player"
      :setup-label="playerSetupLabel"
      @rename="renamePlayer"
      @open-menu="openPlayerMenu"
      @setup="startPlayerSetup"
    />

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
        <span>{{ setupReason ?? $t("settings.player_needs_setup") }}</span>
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
        <span>{{ setupReason ?? $t("settings.player_not_available") }}</span>
      </div>
    </v-alert>

    <PlayerSettingsLinks
      v-if="config"
      :player-id="config.player_id"
      :has-outputs="configPages.has('outputs')"
      :has-controls="configPages.has('controls')"
      class="mb-4"
    />

    <!-- the outputs of a group show on this page -->
    <edit-config
      v-if="config"
      ref="editConfig"
      :disabled="!config?.enabled"
      :config-entries="config_entries"
      :output-protocols="player?.output_protocols || []"
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
import { computed, markRaw, ref } from "vue";
import { useRouter } from "vue-router";
import { api } from "@/plugins/api";
import {
  ConfigEntryType,
  ConfigValueType,
  PlayerFeature,
  PlayerType,
} from "@/plugins/api/interfaces";
import { ConfigEntryUI, isInjected } from "@/helpers/config_entry_ui";
import { goBack } from "@/helpers/navigation";
import {
  getPlayerConfigPage,
  getPlayerSetupLabel,
  type PlayerConfigPage,
} from "@/helpers/player_config";
import { getPlayerSettingsMenuItems } from "@/helpers/player_settings_actions";
import { getPlayerSetupReason } from "@/helpers/players";
import { useMultiChannelCandidates } from "@/composables/settings/players/useMultiChannelCandidates";
import { usePlayerConfig } from "@/composables/settings/players/usePlayerConfig";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { RotateCcw } from "@lucide/vue";
import EditConfig from "./EditConfig.vue";
import PlayerSettingsHeader from "./PlayerSettingsHeader.vue";
import PlayerSettingsLinks from "./PlayerSettingsLinks.vue";

// global refs
const router = useRouter();
const editConfig = ref<InstanceType<typeof EditConfig>>();

// props
const props = defineProps<{
  playerId?: string;
}>();

const {
  config,
  player,
  loading,
  enabling,
  enablePlayer,
  reloadConfig,
  save,
  onImmediateApply,
  onAction,
} = usePlayerConfig(() => props.playerId, editConfig);

// computed properties
const { layouts: multiChannelLayouts } = useMultiChannelCandidates(player);

const playerSetupLabel = computed(() =>
  config.value?.enabled ? getPlayerSetupLabel(player.value) : undefined,
);

const setupReason = computed(() => getPlayerSetupReason(player.value));

// the outputs (but for those of a group) and the player controls have pages of their own
const config_entries = computed(() => {
  if (!config.value) return [];
  const player = api.players[config.value.player_id];
  if (!player) return [];

  const entries: ConfigEntryUI[] = Object.values(config.value.values).filter(
    (entry) => getPlayerConfigPage(entry, player) === "player",
  );

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

// the pages that show an entry of the config, so no row leads to an empty page
const configPages = computed(() => {
  const pages = new Set<PlayerConfigPage>();
  if (!config.value || !player.value) return pages;
  for (const entry of Object.values(config.value.values)) {
    if (!entry.hidden) pages.add(getPlayerConfigPage(entry, player.value));
  }
  return pages;
});

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
    // the player went into the one that stays, which now holds its settings
    onMerged: (targetPlayerId) => {
      editConfig.value?.discardChanges();
      router.replace(`/settings/editplayer/${targetPlayerId}`);
    },
    multiChannelLayouts: multiChannelLayouts.value,
    // the server numbers the speakers anew, so the form starts over from what is stored
    onSpeakersChanged: reloadConfig,
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

const startPlayerSetup = function () {
  if (!config.value?.enabled || !playerSetupLabel.value) return;
  eventbus.emit("setupFlowDialog", {
    kind: "player",
    playerId: config.value.player_id,
  });
};

const onSubmit = async function (values: Record<string, ConfigValueType>) {
  values["enabled"] = config.value!.enabled;
  if (await save(values)) goBack(router, { name: "playersettings" });
};
</script>

<style scoped>
.edit-player {
  padding: 16px;
}

.disabled-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
</style>
