<template>
  <!-- active player -->
  <Button
    variant="icon"
    :ripple="false"
    icon
    @click="store.showPlayersMenu = true"
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
import { store } from "@/plugins/store";
import Button from "@/components/mods/Button.vue";

// properties
export interface Props {
  color?: string;
}
defineProps<Props>();
</script>

<style>
.no_transform {
  text-transform: none;
}
</style>
