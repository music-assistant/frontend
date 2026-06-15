<template>
  <button
    v-hold="onHold"
    type="button"
    class="ed-hero ma-tap"
    :class="{ 'ed-hero--large': large }"
    @click="onClick"
    @contextmenu.prevent="onMenu"
    @touchstart.passive="holdFired = false"
  >
    <div class="ed-hero__bg" :style="{ background: art.gradient }">
      <img
        v-if="art.image"
        class="ed-hero__img"
        loading="lazy"
        :src="art.image"
        :alt="item.name"
      />
    </div>
    <div class="ed-hero__scrim"></div>
    <div class="ed-hero__content">
      <div class="ed-hero__tag">
        <Sparkles :size="12" />
        <span>{{ tag }}</span>
      </div>
      <div class="ed-hero__body">
        <div class="ed-hero__kind">{{ kind }}</div>
        <div class="ed-hero__title">{{ item.name }}</div>
        <div v-if="subtitle" class="ed-hero__subtitle">{{ subtitle }}</div>
      </div>
    </div>
    <span class="ed-hero__play" @click.stop="onPlay">
      <Play
        :size="18"
        fill="currentColor"
        :stroke-width="0"
        class="ed-hero__play-icon"
      />
    </span>
  </button>
</template>

<script setup lang="ts">
import { itemArtwork } from "@/components/discover/editorialArtwork";
import {
  getArtistsString,
  handleMediaItemClick,
  handleMenuBtnClick,
  handlePlayBtnClick,
} from "@/helpers/utils";
import {
  type Album,
  type ItemMapping,
  type MediaItemType,
  type Track,
} from "@/plugins/api/interfaces";
import { Play, Sparkles } from "lucide-vue-next";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";

interface Props {
  item: MediaItemType | ItemMapping;
  tag?: string;
  large?: boolean;
}
const props = defineProps<Props>();
const { t } = useI18n();

const art = computed(() =>
  itemArtwork(props.item, props.large ? 640 : 320, true),
);
const kind = computed(() => t(props.item.media_type));
const tag = computed(() => props.tag || t("recently_played"));

const subtitle = computed(() => {
  const it = props.item as Partial<Album & Track & { owner?: string }>;
  if (it.artists?.length) return getArtistsString(it.artists, 1);
  if (it.owner) return it.owner;
  return undefined;
});

// Set while a long-press opened the context menu, so the click that fires on
// finger-lift does not also navigate. Reset on the next touchstart.
const holdFired = ref(false);

const onClick = (e: MouseEvent) => {
  if (holdFired.value) {
    holdFired.value = false;
    return;
  }
  handleMediaItemClick(props.item, e.clientX, e.clientY);
};
const onPlay = (e: MouseEvent) =>
  handlePlayBtnClick(props.item, e.clientX, e.clientY);
const onMenu = (e: MouseEvent) =>
  handleMenuBtnClick(props.item, e.clientX, e.clientY);
// Long-press on touch devices: open the same context menu as right-click.
const onHold = (e: TouchEvent) => {
  holdFired.value = true;
  const touch = e.touches?.[0];
  handleMenuBtnClick(props.item, touch?.clientX ?? 0, touch?.clientY ?? 0);
};
</script>

<style scoped>
.ed-hero {
  position: relative;
  overflow: hidden;
  border-radius: 8px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  cursor: pointer;
  text-align: left;
  padding: 0;
  background: transparent;
  color: #fff;
  min-height: 133px;
  transition: transform 0.18s ease;
}
.ed-hero--large {
  min-height: 280px;
}
.ed-hero:hover {
  transform: translateY(-2px);
}
.ma-tap:active {
  transform: scale(0.985);
}
.ed-hero__bg,
.ed-hero__img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.ed-hero__img {
  object-fit: cover;
}
.ed-hero__scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(0, 0, 0, 0.05) 0%,
    rgba(0, 0, 0, 0.4) 60%,
    rgba(0, 0, 0, 0.75) 100%
  );
}
.ed-hero__content {
  position: relative;
  z-index: 1;
  height: 100%;
  padding: 16px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.ed-hero--large .ed-hero__content {
  padding: 22px;
}
.ed-hero__tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  opacity: 0.95;
}
.ed-hero__kind {
  font-size: 11px;
  opacity: 0.9;
  margin-bottom: 4px;
  font-weight: 500;
}
.ed-hero__title {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.5px;
  line-height: 1.1;
  margin-bottom: 4px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.ed-hero--large .ed-hero__title {
  font-size: 28px;
}
.ed-hero__subtitle {
  font-size: 12px;
  opacity: 0.85;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ed-hero__play {
  position: absolute;
  bottom: 12px;
  right: 12px;
  width: 40px;
  height: 40px;
  border-radius: 999px;
  background: rgb(var(--v-theme-primary));
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  pointer-events: none;
  transform: translateY(8px);
  transition:
    opacity 0.18s,
    transform 0.18s;
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.35);
  z-index: 2;
}
.ed-hero__play-icon {
  margin-left: 2px;
  fill: currentColor;
  stroke: none;
}
.ed-hero:hover .ed-hero__play {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}
/* Touch devices: no hover-revealed play button — tap goes straight to the
   content and long-press opens the context menu instead. */
@media (hover: none) {
  .ed-hero__play {
    display: none;
  }
}
</style>
