<template>
  <!-- the look of a row of the other listings, with an icon for art -->
  <ListItem
    link
    show-menu-btn
    class="group"
    :menu-button-label="`${$t('more_options')}: ${source.name}`"
    @click="emit('start')"
    @menu="(evt: Event) => emit('menu', evt)"
  >
    <template #prepend>
      <div class="listitem-media-thumb shrink-0 overflow-hidden rounded">
        <div
          class="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground transition-[filter] duration-150 [@media(hover:hover)]:group-hover:blur-[4px] [@media(hover:hover)]:group-hover:brightness-[0.35]"
        >
          <component :is="icon" class="size-[45%]" aria-hidden="true" />
        </div>
        <!-- a touch screen has its play button on the right instead -->
        <span
          class="pointer-events-none absolute inset-0 m-auto inline-flex size-8 items-center justify-center rounded-full bg-primary text-white opacity-0 transition-opacity duration-200 [@media(hover:hover)]:group-hover:opacity-100"
          aria-hidden="true"
        >
          <Play :size="16" fill="currentColor" :stroke-width="0" />
        </span>
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
      <Button
        v-if="isTouch"
        variant="ghost"
        size="icon-sm"
        class="-me-2.5"
        :aria-label="`${$t('play')} ${source.name}`"
        @click.stop="emit('start')"
      >
        <span
          class="inline-flex size-[22px] items-center justify-center rounded-full bg-primary text-white"
        >
          <Play :size="11" fill="currentColor" :stroke-width="0" />
        </span>
      </Button>
    </template>
  </ListItem>
</template>

<script setup lang="ts">
import ListItem from "@/components/ListItem.vue";
import NowPlayingBadge from "@/components/NowPlayingBadge.vue";
import { Button } from "@/components/ui/button";
import type { PlayerSource } from "@/plugins/api/interfaces";
import { getBreakpointValue } from "@/plugins/breakpoint";
import { Play } from "@lucide/vue";
import { useMediaQuery } from "@vueuse/core";
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

// touch devices can't hover, so they get a play button of their own
const isTouch = useMediaQuery("(hover: none)");
</script>
