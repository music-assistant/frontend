<template>
  <Button variant="icon" @click="openPlayersMenu">
    <span
      class="mdi"
      :class="
        store.activePlayer?.group_members.length
          ? 'mdi-speaker-multiple'
          : 'mdi-speaker'
      "
      :style="{ fontSize: '24px', color: color || undefined }"
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
