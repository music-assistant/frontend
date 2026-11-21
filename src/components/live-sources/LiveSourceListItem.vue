<template>
  <ListItem
    link
    show-menu-btn
    :menu-button-label="`${$t('more_options')}: ${source.name}`"
    @click="emit('start')"
    @menu="(evt: Event) => emit('menu', evt)"
  >
    <template #prepend>
      <div
        class="flex size-[50px] shrink-0 items-center justify-center rounded bg-muted text-muted-foreground"
      >
        <component :is="icon" class="size-[45%]" aria-hidden="true" />
      </div>
    </template>
    <template #title>
      <span class="v-list-item-title" :class="{ 'is-playing': isPlaying }">
        {{ source.name }}
      </span>
    </template>
    <template v-if="ownerName" #subtitle>
      <div>{{ ownerName }}</div>
    </template>
    <template #append>
      <NowPlayingBadge
        v-if="isPlaying"
        :show-badge="getBreakpointValue('bp7')"
      />
    </template>
  </ListItem>
</template>

<script setup lang="ts">
import ListItem from "@/components/ListItem.vue";
import NowPlayingBadge from "@/components/NowPlayingBadge.vue";
import type { PlayerSource } from "@/plugins/api/interfaces";
import { getBreakpointValue } from "@/plugins/breakpoint";
import type { Component } from "vue";

defineProps<{
  source: PlayerSource;
  icon: Component;
  // the player it belongs to, shown below its name
  ownerName?: string;
  isPlaying: boolean;
}>();

const emit = defineEmits<{
  start: [];
  menu: [evt: Event];
}>();
</script>
