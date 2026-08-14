<template>
  <div
    v-if="links.length"
    class="bg-card overflow-hidden rounded-xl border shadow-sm"
  >
    <RouterLink
      v-for="link in links"
      :key="link.key"
      :to="link.to"
      :data-testid="`player-settings-link-${link.key}`"
      class="hover:bg-accent/50 focus-visible:ring-ring flex items-center gap-4 border-b px-4 py-4 no-underline transition-colors last:border-b-0 focus-visible:ring-2 focus-visible:outline-none"
    >
      <component :is="link.icon" class="text-primary size-5 shrink-0" />
      <div class="min-w-0 flex-1">
        <div class="text-foreground text-sm font-medium">{{ link.label }}</div>
        <div class="text-muted-foreground truncate text-sm">
          {{ link.description }}
        </div>
      </div>
      <span v-if="link.state" class="text-muted-foreground text-sm">
        {{ link.state }}
      </span>
      <ChevronRight class="text-muted-foreground size-4 shrink-0" />
    </RouterLink>
  </div>
</template>

<script setup lang="ts">
import { getPlayerSettingsSections } from "@/helpers/player_settings_actions";
import { api } from "@/plugins/api";
import { DSPConfig, EventType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import {
  AudioLines,
  ChevronRight,
  ListMusic,
  SlidersHorizontal,
} from "@lucide/vue";
import type { Component } from "vue";
import { computed, markRaw, onBeforeUnmount, ref } from "vue";
import { RouterLink } from "vue-router";

/**
 * The settings screens that belong to a player but live on their own page: each row
 * says what is behind it and navigates there.
 */
const props = defineProps<{
  playerId: string;
}>();

interface SettingsLink {
  key: string;
  to: string;
  icon: Component;
  label: string;
  description: string;
  state?: string;
}

// global refs
const dspEnabled = ref(false);

const loadDspEnabled = async () => {
  try {
    dspEnabled.value = (await api.getDSPConfig(props.playerId)).enabled;
  } catch (error) {
    console.error("Error fetching DSP config:", error);
  }
};
void loadDspEnabled();

const unsubDspUpdated = api.subscribe(
  EventType.PLAYER_DSP_CONFIG_UPDATED,
  (evt: { data: DSPConfig }) => {
    dspEnabled.value = evt.data.enabled;
  },
  props.playerId,
);
onBeforeUnmount(unsubDspUpdated);

// computed properties
const links = computed(() => {
  const sections = getPlayerSettingsSections(props.playerId);
  const items: SettingsLink[] = [];
  if (sections.queue) {
    items.push({
      key: "queue",
      // a queue is identified by the player id of the player owning it
      to: `/settings/editqueue/${props.playerId}`,
      icon: markRaw(ListMusic),
      label: $t("settings.queue_settings"),
      description: $t("settings.queue_settings_description"),
    });
  }
  if (sections.dsp) {
    items.push({
      key: "dsp",
      to: `/settings/editplayer/${props.playerId}/dsp`,
      icon: markRaw(AudioLines),
      label: $t("settings.category.dsp"),
      description: $t("settings.dsp_description"),
      state: dspEnabled.value ? $t("on") : $t("off"),
    });
  }
  if (sections.options) {
    items.push({
      key: "options",
      to: `/settings/editplayer/${props.playerId}/options`,
      icon: markRaw(SlidersHorizontal),
      label: $t("settings.category.options"),
      description: $t("settings.player_options_description"),
    });
  }
  return items;
});
</script>
