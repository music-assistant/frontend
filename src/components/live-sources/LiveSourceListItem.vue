<template>
  <!-- the look of a row of the other listings, with an icon for art -->
  <Item
    v-hold="onHold"
    role="button"
    tabindex="0"
    class="group min-h-16 cursor-pointer flex-nowrap gap-0 rounded border-0 p-[7px] pe-0 hover:bg-foreground/[0.04]"
    @click.capture="swallowClickAfterHold"
    @click="onClick"
    @keydown.enter.self="emit('start')"
    @keydown.space.self.prevent="emit('start')"
    @contextmenu.prevent="(evt: MouseEvent) => emit('menu', evt)"
    @touchstart.passive="onTouchStart"
  >
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
    <ItemContent class="min-w-0 gap-0 pe-2.5">
      <ItemTitle
        class="block w-full truncate leading-5"
        :class="{ 'is-playing': isPlaying }"
      >
        {{ source.name }}
      </ItemTitle>
      <ItemDescription
        v-if="ownerName"
        class="block truncate leading-5 text-muted-foreground"
      >
        {{ ownerName }}
      </ItemDescription>
    </ItemContent>
    <ItemActions class="gap-0">
      <NowPlayingBadge
        v-if="isPlaying"
        :show-badge="getBreakpointValue('bp7')"
      />
      <Button
        v-if="isTouch"
        variant="ghost"
        size="icon-sm"
        :aria-label="`${$t('play')} ${source.name}`"
        @click.stop="emit('start')"
      >
        <span
          class="inline-flex size-[22px] items-center justify-center rounded-full bg-primary text-white"
        >
          <Play :size="11" fill="currentColor" :stroke-width="0" />
        </span>
      </Button>
      <Button
        variant="ghost-icon"
        class="size-12 rounded-full opacity-60 hover:opacity-100"
        :aria-label="`${$t('more_options')}: ${source.name}`"
        @click.stop="(evt: MouseEvent) => emit('menu', evt)"
      >
        <EllipsisVertical class="size-6" />
      </Button>
    </ItemActions>
  </Item>
</template>

<script setup lang="ts">
import NowPlayingBadge from "@/components/NowPlayingBadge.vue";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";
import { useHoldToOpenMenu } from "@/composables/useHoldToOpenMenu";
import type { PlayerSource } from "@/plugins/api/interfaces";
import { getBreakpointValue } from "@/plugins/breakpoint";
import { EllipsisVertical, Play } from "@lucide/vue";
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

const { onHold, onTouchStart, swallowClickAfterHold } = useHoldToOpenMenu(
  (evt: Event) => emit("menu", evt),
);

// a long-press on the edge of the row makes the row itself the target of the
// click, where the capture phase can not stop it
const onClick = (evt: Event) => {
  if (!evt.defaultPrevented) emit("start");
};
</script>
