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
import Button from "@/components/Button.vue";
import { store } from "@/plugins/store";

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
