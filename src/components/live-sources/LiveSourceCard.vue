<template>
  <!-- the look of a cover card of the other listings, with an icon for art -->
  <div
    v-hold="onHold"
    role="button"
    tabindex="0"
    class="ma-tap relative cursor-pointer rounded-lg p-2 transition-colors hover:bg-[rgba(var(--v-theme-on-surface),0.08)] max-[500px]:p-1"
    @click="onClick"
    @keydown.enter.self="emit('start')"
    @keydown.space.self.prevent="emit('start')"
    @contextmenu.prevent="(evt: MouseEvent) => emit('menu', evt)"
    @touchstart.passive="holdFired = false"
  >
    <div
      class="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.25)]"
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
    <div class="mt-2.5 flex items-start gap-1 max-[500px]:mt-1">
      <div class="min-w-0 flex-1">
        <div
          class="truncate text-sm font-semibold"
          :class="{ 'text-primary': isPlaying }"
        >
          {{ source.name }}
        </div>
        <div
          v-if="ownerName"
          class="mt-0.5 truncate text-xs text-muted-foreground"
        >
          {{ ownerName }}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        class="-me-1 shrink-0"
        :aria-label="`${$t('more_options')}: ${source.name}`"
        @click.stop="(evt: MouseEvent) => emit('menu', evt)"
      >
        <EllipsisVertical />
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { bannerBackground } from "@/components/discover/editorialArtwork";
import NowPlayingBadge from "@/components/NowPlayingBadge.vue";
import { Button } from "@/components/ui/button";
import type { PlayerSource } from "@/plugins/api/interfaces";
import { EllipsisVertical } from "@lucide/vue";
import { ref, type Component } from "vue";

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

// set while a long-press opened the menu, so the click that follows the
// finger-lift does not also start the source
const holdFired = ref(false);

const onClick = () => {
  if (holdFired.value) {
    holdFired.value = false;
    return;
  }
  emit("start");
};

const onHold = (evt: TouchEvent) => {
  holdFired.value = true;
  emit("menu", evt);
};
</script>
