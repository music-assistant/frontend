<template>
  <Button
    id="player-select-button"
    variant="ghost"
    :class="[
      navigation
        ? 'player-control-button mobile-navigation-item min-w-0 flex-1 px-1'
        : 'player-control-button player-bar-action player-bar-player-button h-20 w-24 min-w-0 rounded-none px-1',
    ]"
    :data-active="store.showPlayersMenu"
    :data-suppress-hover="suppressHover"
    :aria-label="playerSelectLabel"
    :aria-expanded="store.showPlayersMenu"
    aria-haspopup="dialog"
    @click="togglePlayersMenu"
    @pointerleave="suppressHover = false"
  >
    <span
      :class="navigation ? 'mobile-navigation-icon' : 'player-bar-action-icon'"
    >
      <PlayerIcon
        :icon="store.activePlayer?.icon"
        :size="28"
        :stroke-width="1.4"
        class="size-7"
      />
    </span>
    <span
      :class="
        navigation ? 'mobile-navigation-label' : 'player-bar-action-label'
      "
    >
      {{ playerName }}
    </span>
  </Button>
</template>

<script setup lang="ts">
import PlayerIcon from "@/components/PlayerIcon.vue";
import { Button } from "@/components/ui/button";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { computed, ref } from "vue";

const suppressHover = ref(false);
const playerName = computed(() => store.activePlayer?.name || $t("no_player"));
const playerSelectLabel = computed(
  () => `${$t("tooltip.select_player")}: ${playerName.value}`,
);

withDefaults(
  defineProps<{
    navigation?: boolean;
  }>(),
  {
    navigation: false,
  },
);

function togglePlayersMenu() {
  suppressHover.value = store.showPlayersMenu;
  store.showPlayersMenu = !store.showPlayersMenu;
}
</script>
