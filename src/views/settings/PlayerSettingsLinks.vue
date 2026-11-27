<template>
  <SettingsLinkRows :rows="links" test-id-prefix="player-settings" />
</template>

<script setup lang="ts">
import SettingsLinkRows, {
  type SettingsRow,
} from "@/components/settings/SettingsLinkRows.vue";
import { getPlayerSettingsSections } from "@/helpers/player_settings_actions";
import { api } from "@/plugins/api";
import { DSPConfig, EventType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import {
  AudioLines,
  Cast,
  CirclePlay,
  SlidersHorizontal,
  Volume2,
} from "@lucide/vue";
import { computed, markRaw, onBeforeUnmount, ref, watch } from "vue";

/**
 * The settings screens that belong to a player but live on their own page: each row
 * says what is behind it and navigates there.
 */
const props = defineProps<{
  playerId: string;
  /** The output settings have an entry to show on their page. */
  hasOutputs: boolean;
  /** The player controls have an entry to show on their page. */
  hasControls: boolean;
}>();

// global refs
const dspEnabled = ref(false);

const sections = computed(() => getPlayerSettingsSections(props.playerId));

const unsubDspUpdated = api.subscribe(
  EventType.PLAYER_DSP_CONFIG_UPDATED,
  (evt: { data: DSPConfig }) => {
    dspEnabled.value = evt.data.enabled;
  },
  props.playerId,
);
onBeforeUnmount(unsubDspUpdated);

// watchers

// players without a DSP row have nothing to ask the server for, and a group
// player is registered a moment after the page opens, so wait for the row
watch(
  () => sections.value.dsp,
  (showsDsp) => {
    if (showsDsp) void loadDspEnabled();
  },
  { immediate: true },
);

// computed properties
const links = computed(() => {
  const items: SettingsRow[] = [];
  if (sections.value.queue) {
    items.push({
      key: "queue",
      // a queue is identified by the player id of the player owning it
      to: `/settings/editqueue/${props.playerId}`,
      icon: markRaw(CirclePlay),
      label: $t("settings.playback.title"),
      description: $t("settings.queue_settings_description"),
    });
  }
  if (sections.value.dsp) {
    items.push({
      key: "dsp",
      to: `/settings/editplayer/${props.playerId}/dsp`,
      icon: markRaw(AudioLines),
      label: $t("settings.category.dsp"),
      description: $t("settings.dsp_description"),
      state: dspEnabled.value ? $t("on") : $t("off"),
    });
  }
  if (sections.value.options) {
    items.push({
      key: "options",
      to: `/settings/editplayer/${props.playerId}/options`,
      icon: markRaw(SlidersHorizontal),
      label: $t("settings.category.options"),
      description: $t("settings.player_options_description"),
    });
  }
  if (props.hasOutputs) {
    items.push({
      key: "outputs",
      to: `/settings/editplayer/${props.playerId}/outputs`,
      icon: markRaw(Cast),
      label: $t("settings.category.protocol_settings"),
      description: $t("settings.output_protocols_description"),
    });
  }
  if (props.hasControls) {
    items.push({
      key: "controls",
      to: `/settings/editplayer/${props.playerId}/controls`,
      icon: markRaw(Volume2),
      label: $t("settings.category.player_controls"),
      description: $t("settings.player_controls_description"),
    });
  }
  return items;
});

async function loadDspEnabled() {
  try {
    dspEnabled.value = (await api.getDSPConfig(props.playerId)).enabled;
  } catch (error) {
    console.error("Error fetching DSP config:", error);
  }
}
</script>
