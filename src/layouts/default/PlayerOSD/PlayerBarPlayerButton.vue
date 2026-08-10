<template>
  <Button
    id="player-select-button"
    variant="ghost"
    :class="[
      navigation
        ? 'player-control-button mobile-navigation-item min-w-0 flex-1 rounded-none px-1'
        : 'player-control-button player-bar-action player-bar-player-button h-20 w-24 min-w-0 rounded-none px-1',
    ]"
    :data-active="store.showPlayersMenu"
    :data-suppress-hover="suppressHover"
    :aria-label="$t('tooltip.select_player')"
    :aria-pressed="store.showPlayersMenu"
    @click="togglePlayersMenu"
    @pointerleave="suppressHover = false"
  >
    <span
      :class="navigation ? 'mobile-navigation-icon' : 'player-bar-action-icon'"
    >
      <PlayerIcon
        :icon="store.activePlayer?.icon"
        :size="32"
        :stroke-width="1.4"
        class="size-8"
      />
    </span>
    <span
      :class="
        navigation ? 'mobile-navigation-label' : 'player-bar-action-label'
      "
    >
      {{ store.activePlayer?.name || $t("no_player") }}
    </span>
  </Button>
</template>

<script setup lang="ts">
import PlayerIcon from "@/components/PlayerIcon.vue";
import { Button } from "@/components/ui/button";
import { store } from "@/plugins/store";
import { ref } from "vue";

const suppressHover = ref(false);

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
