<template>
  <div
    v-hold="onHold"
    class="chart-card ma-tap"
    role="button"
    tabindex="0"
    :class="{
      'chart-card--unavailable': !isAvailable,
    }"
    @click="onClick"
    @keydown.enter.self="onClick"
    @keydown.space.self.prevent="onClick"
    @contextmenu.prevent="onMenu"
    @touchstart.passive="holdFired = false"
  >
    <div class="chart-card__position">
      <span class="chart-card__rank">{{ position }}</span>
    </div>
    <div class="chart-card__art" :style="getStyle">
      <img
        v-if="art.image"
        class="chart-card__img"
        loading="lazy"
        :src="art.image"
        :alt="item.name"
      />
      <span v-else-if="art.initials" class="chart-card__initials">{{
        art.initials
      }}</span>
      <ProviderIcon
        v-if="providerDomain"
        class="chart-card__provider"
        :domain="providerDomain"
        :size="16"
      />
    </div>
    <div class="chart-card__meta">
      <div class="chart-card__title">
        {{ displayName }}
      </div>
      <div class="chart-card__sub">{{ subtitle }}</div>
      <div class="chart-card__stats">
        <Play :size="12" class="chart-card__stats-icon" />
        <span>{{ formatPlayCount(playCount) }}</span>
      </div>
    </div>
    <Button
      v-if="showPlay"
      variant="ghost"
      size="icon-sm"
      class="chart-card__play"
      @click.stop="onPlay"
    >
      <Play :size="16" fill="currentColor" :stroke-width="0" />
    </Button>
  </div>
</template>

<script setup lang="ts">
import ProviderIcon from "@/components/ProviderIcon.vue";
import { Button } from "@/components/ui/button";
import { itemArtwork } from "@/components/discover/editorialArtwork";
import {
  handleMediaItemClick,
  handleMenuBtnClick,
} from "@/helpers/media_item_actions";
import { api } from "@/plugins/api";
import { getBreakpointValue } from "@/plugins/breakpoint";
import {
  MediaType,
  type ItemMapping,
  type MediaItemType,
} from "@/plugins/api/interfaces";
import { Play } from "@lucide/vue";
import { computed, ref } from "vue";

interface Props {
  item: MediaItemType | ItemMapping;
  position: number;
  playCount: number;
}

const props = defineProps<Props>();
const holdFired = ref(false);

const isAvailable = computed(() => {
  return "available" in props.item ? props.item.available : true;
});

const providerDomain = computed(() => {
  if (
    "provider_mappings" in props.item &&
    props.item.provider_mappings?.length
  ) {
    return props.item.provider_mappings[0]?.provider_domain;
  }
  return props.item.provider !== "library" ? props.item.provider : undefined;
});

const art = computed(() => itemArtwork(props.item, 200));

const getStyle = computed(() => ({ background: art.value.gradient }));

const displayName = computed(() => props.item.name);

const subtitle = computed(() => {
  if (props.item.media_type === MediaType.TRACK && "artists" in props.item) {
    return props.item.artists?.map((a) => a.name).join(", ") || "";
  }
  if (props.item.media_type === MediaType.ALBUM && "artists" in props.item) {
    return props.item.artists?.map((a) => a.name).join(", ") || "";
  }
  return "";
});

const showPlay = computed(() => {
  return (
    props.item.is_playable &&
    getBreakpointValue("bp6") &&
    props.item.media_type !== MediaType.ARTIST
  );
});

const formatPlayCount = (count: number): string => {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return count.toString();
};

const onClick = (e: MouseEvent | KeyboardEvent) => {
  if (holdFired.value) {
    holdFired.value = false;
    return;
  }
  const x = "clientX" in e ? e.clientX : 0;
  const y = "clientY" in e ? e.clientY : 0;
  handleMediaItemClick(props.item, x, y);
};

const onPlay = () => {
  api.playMedia(props.item.uri);
};

const onMenu = (e: MouseEvent) => {
  handleMenuBtnClick(props.item, e.clientX, e.clientY);
};

const onHold = (e: TouchEvent) => {
  holdFired.value = true;
  const touch = e.touches?.[0];
  handleMenuBtnClick(props.item, touch?.clientX ?? 0, touch?.clientY ?? 0);
};
</script>

<style scoped>
.chart-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
  min-height: 72px;
}

.chart-card:hover {
  background-color: rgba(var(--v-theme-surface), 0.5);
}

.chart-card:hover .chart-card__play {
  opacity: 1;
}

.chart-card--unavailable {
  opacity: 0.5;
}

.chart-card__position {
  flex-shrink: 0;
  width: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chart-card__rank {
  font-size: 18px;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
}

.chart-card__art {
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  border-radius: 6px;
  background-size: cover;
  background-position: center;
  position: relative;
  overflow: hidden;
  background-color: rgba(var(--v-theme-surface), 0.8);
}

.chart-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.chart-card__initials {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
}

.chart-card__provider {
  position: absolute;
  bottom: 4px;
  right: 4px;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.4));
}

.chart-card__meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.chart-card__title {
  font-weight: 500;
  font-size: 14px;
  line-height: 1.3;
  color: rgb(var(--v-theme-on-surface));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chart-card__sub {
  font-size: 13px;
  color: rgb(var(--v-theme-on-surface-variant));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chart-card__stats {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: rgb(var(--v-theme-on-surface-variant));
  margin-top: 2px;
}

.chart-card__stats-icon {
  opacity: 0.7;
}

.chart-card__play {
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.2s;
}
</style>
