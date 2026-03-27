<template>
  <Button variant="icon" @click="openPlayersMenu">
    <component
      :is="
        resolveIconHelper(
          store.activePlayer?.group_members.length
            ? 'mdi-speaker-multiple'
            : 'mdi-speaker',
        )
      "
      :size="24"
      :style="{ color: color || undefined }"
    />
  </Button>
</template>

<script setup lang="ts">
import Button from "@/components/Button.vue";
import { resolveIcon as resolveIconHelper } from "@/helpers/iconMapping";
import { store } from "@/plugins/store";

export interface Props {
  color?: string;
}
defineProps<Props>();

function openPlayersMenu() {
  store.showPlayersMenu = !store.showPlayersMenu;
}
</script>
