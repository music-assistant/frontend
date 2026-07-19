<template>
  <Button
    variant="icon"
    :ripple="false"
    icon
    :aria-label="$t('tooltip.select_player')"
    @click="openPlayersMenu"
  >
    <v-icon
      :color="color ? color : ''"
      :size="24"
      :icon="
        store.activePlayer?.group_members.length
          ? 'mdi-speaker-multiple'
          : 'mdi-speaker'
      "
    />
  </Button>
</template>

<script setup lang="ts">
import Button from "@/components/Button.vue";
import { store } from "@/plugins/store";

export interface Props {
  color?: string;
}
defineProps<Props>();

function openPlayersMenu() {
  store.showPlayersMenu = !store.showPlayersMenu;
}
</script>
