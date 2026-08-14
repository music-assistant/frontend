<template>
  <div class="chart-item" @click="handleClick">
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
        <template v-if="artistName">{{ artistName }} • </template>
        <span class="chart-item__plays">{{ formattedPlays }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { itemArtwork } from "@/components/discover/editorialArtwork";
import type { MediaItemTypeOrItemMapping } from "@/plugins/api/interfaces";
import { MediaType } from "@/plugins/api/interfaces";
import { api } from "@/plugins/api";
import { useI18n } from "vue-i18n";

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

function handleClick() {
  api.playMedia(props.item);
}
</script>

<style scoped>
.chart-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 280px;
  flex-shrink: 0;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.chart-item:hover {
  background: rgba(var(--v-theme-surface-variant), 0.5);
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

.chart-item__name {
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--v-theme-on-background));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chart-item__meta {
  font-size: 12px;
  color: rgb(var(--v-theme-on-surface-variant));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chart-item__plays {
  font-weight: 500;
}
</style>
