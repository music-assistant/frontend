<template>
  <!-- the look of a cover card of the other listings, with an icon for art -->
  <div
    v-hold="onHold"
    role="button"
    tabindex="0"
    class="group ma-tap relative cursor-pointer rounded-lg p-2 transition-colors hover:bg-foreground/[0.08] max-[500px]:p-1"
    @click.capture="swallowClickAfterHold"
    @click="onClick"
    @keydown.enter.self="emit('start')"
    @keydown.space.self.prevent="emit('start')"
    @contextmenu.prevent="(evt: MouseEvent) => emit('menu', evt)"
    @touchstart.passive="onTouchStart"
  >
    <div
      data-card-art
      class="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.25),inset_0_0_0_1px_rgba(255,255,255,0.04)]"
      :style="{ background: bannerBackground }"
    >
      <component
        :is="icon"
        class="size-[40%] text-white/55 drop-shadow-[0_2px_8px_rgba(0,0,0,0.25)]"
        aria-hidden="true"
      />
      <NowPlayingBadge
        v-if="isPlaying"
        :show-badge="false"
        icon-style="position: absolute; right: 6px; bottom: 6px; z-index: 2"
      />
    </div>
    <div class="relative mt-2.5 max-[500px]:mt-1">
      <div
        class="truncate text-sm font-semibold"
        :class="{ 'text-primary': isPlaying }"
      >
        {{ source.name }}
      </div>
      <div
        class="mt-0.5 min-h-4 truncate text-xs text-muted-foreground max-[500px]:mt-0"
      >
        {{ ownerName }}
      </div>
      <!-- touch screens start a source with a tap on the card -->
      <span
        class="pointer-events-none absolute right-0 bottom-0.5 z-[4] inline-flex size-[38px] translate-y-2 items-center justify-center rounded-full bg-primary text-white opacity-0 shadow-[0_6px_14px_rgba(0,0,0,0.35)] transition-[opacity,transform] duration-200 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 [@media(hover:none)]:hidden"
        @click.stop="emit('start')"
      >
        <Play :size="18" fill="currentColor" :stroke-width="0" />
      </span>
    </div>
    <div v-if="showActions" class="mt-2 flex h-8 items-center" @click.stop>
      <Button
        variant="ghost"
        size="icon-sm"
        class="ms-auto rounded-full text-muted-foreground"
        :aria-label="`${$t('more_options')}: ${source.name}`"
        @click.stop="(evt: MouseEvent) => emit('menu', evt)"
      >
        <EllipsisVertical class="size-5" />
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { bannerBackground } from "@/components/discover/editorialArtwork";
import NowPlayingBadge from "@/components/NowPlayingBadge.vue";
import { Button } from "@/components/ui/button";
import type { PlayerSource } from "@/plugins/api/interfaces";
import { useHoldToOpenMenu } from "@/composables/useHoldToOpenMenu";
import { EllipsisVertical, Play } from "@lucide/vue";
import type { Component } from "vue";

defineProps<{
  source: PlayerSource;
  icon: Component;
  // the player it belongs to, shown below its name
  ownerName?: string;
  isPlaying: boolean;
  // the action row below the card, as the cards of the other listings have
  showActions: boolean;
}>();

const emit = defineEmits<{
  start: [];
  menu: [evt: Event];
}>();

const { onHold, onTouchStart, swallowClickAfterHold } = useHoldToOpenMenu(
  (evt: Event) => emit("menu", evt),
);

// a long-press on the edge of the card makes the card itself the target of the
// click, where the capture phase can not stop it
const onClick = (evt: Event) => {
  if (!evt.defaultPrevented) emit("start");
};
</script>
