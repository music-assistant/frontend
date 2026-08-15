<template>
  <div
    v-hold="onHold"
    class="chart-item ma-tap"
    role="button"
    tabindex="0"
    @click="handleClick"
    @keydown.enter.self="handleClick"
    @keydown.space.self.prevent="handleClick"
    @contextmenu.prevent="onMenu"
    @touchstart.passive="holdFired = false"
  >
    <div class="chart-item__position">{{ position }}</div>
    <div class="chart-item__art" :style="artStyle">
      <img
        v-if="art.image"
        class="chart-item__img"
        loading="lazy"
        :src="art.image"
        :alt="item.name"
      />
    </div>
    <div class="chart-item__info">
      <div class="chart-item__name">{{ item.name }}</div>
      <div class="chart-item__meta">
        <span v-if="artistName" class="chart-item__artist">{{
          artistName
        }}</span>
        <span class="chart-item__plays">{{ formattedPlays }}</span>
      </div>
    </div>
    <span class="chart-item__play" @click.stop="handlePlay">
      <Play
        :size="18"
        fill="currentColor"
        :stroke-width="0"
        class="chart-item__play-icon"
      />
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { itemArtwork } from "@/components/discover/editorialArtwork";
import type { MediaItemTypeOrItemMapping } from "@/plugins/api/interfaces";
import { MediaType } from "@/plugins/api/interfaces";
import { useI18n } from "vue-i18n";
import {
  handleMediaItemClick,
  handlePlayBtnClick,
  handleMenuBtnClick,
} from "@/helpers/media_item_actions";
import { Play } from "@lucide/vue";

const props = defineProps<{
  item: MediaItemTypeOrItemMapping;
  position: number;
  playCount: number;
}>();

const { t } = useI18n();

const art = computed(() => itemArtwork(props.item, 200));

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
    return `${(count / 1000).toFixed(1)}k ${t("plays")}`;
  }
  return `${count} ${t("plays")}`;
});

const holdFired = ref(false);

function handleClick(e: MouseEvent | KeyboardEvent) {
  if (holdFired.value) {
    holdFired.value = false;
    return;
  }
  const x = "clientX" in e ? e.clientX : 0;
  const y = "clientY" in e ? e.clientY : 0;
  handleMediaItemClick(props.item, x, y);
}

function handlePlay(e: MouseEvent) {
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

<style scoped>
.chart-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  width: 280px;
  flex-shrink: 0;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.chart-item:hover {
  background: rgba(var(--v-theme-on-surface), 0.08);
}

.chart-item__position {
  font-size: 18px;
  font-weight: 700;
  color: rgb(var(--v-theme-on-background));
  opacity: 0.6;
  width: 28px;
  text-align: right;
  flex-shrink: 0;
}

.chart-item__art {
  position: relative;
  width: 56px;
  height: 56px;
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
}

.chart-item__img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 1;
}

.chart-item__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.chart-item__play {
  position: absolute;
  right: 8px;
  bottom: 8px;
  width: 32px;
  height: 32px;
  border-radius: 999px;
  background: rgb(var(--v-theme-primary));
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  pointer-events: none;
  transform: translateY(6px);
  transition:
    opacity 0.18s,
    transform 0.18s;
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.35);
  z-index: 4;
}

.chart-item__play-icon {
  margin-left: 1px;
  fill: currentColor;
  stroke: none;
}

.chart-item:hover .chart-item__play {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

@media (hover: none) {
  .chart-item__play {
    display: none;
  }
}

.chart-item__name {
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--v-theme-on-background));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chart-item__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  overflow: hidden;
}

.chart-item__artist {
  color: rgb(var(--v-theme-on-background));
  opacity: 0.6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 1;
}

.chart-item__plays {
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 12px;
  background: rgba(var(--v-theme-primary), 0.15);
  color: rgb(var(--v-theme-primary));
  white-space: nowrap;
  flex-shrink: 0;
}
</style>
