<template>
  <div
    v-hold="onHold"
    class="group relative flex w-[280px] shrink-0 items-center rounded-lg transition-colors duration-150 hover:bg-[rgba(var(--v-theme-on-surface),0.08)] ma-tap"
    @contextmenu.prevent="onMenu"
    @touchstart.passive="holdFired = false"
  >
    <button
      type="button"
      class="flex w-full min-w-0 items-center gap-3 rounded-lg border-0 bg-transparent p-2 text-left text-inherit [font:inherit] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      @click="handleClick"
    >
      <span
        class="w-7 shrink-0 text-right text-lg font-bold text-[rgb(var(--v-theme-on-background))] opacity-60"
        >{{ position }}</span
      >
      <span
        class="relative size-14 shrink-0 overflow-hidden rounded"
        :style="artStyle"
      >
        <img
          v-if="art.image"
          class="absolute inset-0 z-[1] size-full object-cover"
          loading="lazy"
          :src="art.image"
          :alt="item.name"
        />
      </span>
      <span class="flex min-w-0 flex-1 flex-col gap-1">
        <span
          class="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium text-[rgb(var(--v-theme-on-background))]"
          >{{ item.name }}</span
        >
        <span class="flex items-center gap-1.5 overflow-hidden text-xs">
          <span
            v-if="artistName"
            class="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[rgb(var(--v-theme-on-background))] opacity-60"
            >{{ artistName }}</span
          >
          <span
            class="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xl bg-[rgba(var(--v-theme-primary),0.15)] px-2 py-0.5 text-[11px] tabular-nums text-[rgb(var(--v-theme-primary))]"
          >
            <Play :size="12" />
            <span>{{ formattedPlays }}</span>
          </span>
        </span>
      </span>
    </button>
    <button
      type="button"
      class="absolute right-2 bottom-2 z-[4] inline-flex size-8 translate-y-1.5 items-center justify-center rounded-full border-0 bg-primary p-0 text-white opacity-0 shadow-lg transition-all group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 focus-visible:pointer-events-auto focus-visible:translate-y-0 focus-visible:opacity-100 disabled:cursor-not-allowed disabled:opacity-40 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:translate-y-0 [@media(hover:none)]:opacity-100"
      :aria-label="$t('play')"
      :disabled="!isAvailable"
      @click.stop="handlePlay"
    >
      <Play
        :size="18"
        fill="currentColor"
        :stroke-width="0"
        class="ml-px fill-current stroke-none"
      />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { itemArtwork } from "@/components/discover/editorialArtwork";
import { itemIsAvailable } from "@/plugins/api/helpers";
import type { MediaItemTypeOrItemMapping } from "@/plugins/api/interfaces";
import { MediaType } from "@/plugins/api/interfaces";
import {
  handleMediaItemClick,
  handlePlayBtnClick,
  handleMenuBtnClick,
} from "@/helpers/media_item_actions";
import { Play } from "@lucide/vue";
import { $t } from "@/plugins/i18n";

const props = defineProps<{
  item: MediaItemTypeOrItemMapping;
  position: number;
  playCount: number;
}>();

const art = computed(() => itemArtwork(props.item, 200));
const isAvailable = computed(() => itemIsAvailable(props.item));

const artStyle = computed(() => ({
  background: art.value.gradient,
}));

const artistName = computed(() => {
  if (
    props.item.media_type === MediaType.TRACK &&
    "artists" in props.item &&
    props.item.artists &&
    props.item.artists.length > 0
  ) {
    return props.item.artists[0].name;
  }
  return undefined;
});

const formattedPlays = computed(() => {
  const count = props.playCount;
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return `${count}`;
});

const holdFired = ref(false);

function handleClick(e: MouseEvent) {
  if (holdFired.value) {
    holdFired.value = false;
    return;
  }
  const x = "clientX" in e ? e.clientX : 0;
  const y = "clientY" in e ? e.clientY : 0;
  handleMediaItemClick(props.item, x, y);
}

function handlePlay(e: MouseEvent) {
  if (!isAvailable.value) return;
  handlePlayBtnClick(props.item, e.clientX, e.clientY);
}

function onHold(e: TouchEvent) {
  holdFired.value = true;
  const touch = e.touches?.[0];
  handleMenuBtnClick(props.item, touch?.clientX ?? 0, touch?.clientY ?? 0);
}

function onMenu(e: MouseEvent) {
  handleMenuBtnClick(props.item, e.clientX, e.clientY);
}
</script>
