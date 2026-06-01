<template>
  <button
    class="ed-card ma-tap"
    :class="{ 'ed-card--unavailable': !isAvailable }"
    @click="onClick"
    @contextmenu.prevent="onMenu"
  >
    <div class="ed-card__art" :style="{ background: art.gradient }">
      <img
        v-if="art.image"
        class="ed-card__img"
        loading="lazy"
        :src="art.image"
        :alt="item.name"
      />
      <ProviderIcon
        v-if="providerDomain"
        class="ed-card__provider"
        :domain="providerDomain"
        :size="20"
      />
    </div>
    <div class="ed-card__meta">
      <div class="ed-card__title">{{ displayName }}</div>
      <div class="ed-card__sub">{{ subtitle }}</div>
    </div>
    <span v-if="isPlayable" class="ed-card__play" @click.stop="onPlay">
      <Play
        :size="18"
        fill="currentColor"
        :stroke-width="0"
        class="ed-card__play-icon"
      />
    </span>
  </button>
</template>

<script setup lang="ts">
import { itemArtwork } from "@/components/discover/editorialArtwork";
import ProviderIcon from "@/components/ProviderIcon.vue";
import {
  getArtistsString,
  getGenreDisplayName,
  handleMediaItemClick,
  handleMenuBtnClick,
  handlePlayBtnClick,
} from "@/helpers/utils";
import {
  type Album,
  type ItemMapping,
  type MediaItemType,
  MediaType,
  type Track,
} from "@/plugins/api/interfaces";
import { Play } from "lucide-vue-next";
import { computed } from "vue";
import { useI18n } from "vue-i18n";

interface Props {
  item: MediaItemType | ItemMapping;
  showProviderOnCover?: boolean;
  isAvailable?: boolean;
}
const props = withDefaults(defineProps<Props>(), {
  showProviderOnCover: false,
  isAvailable: true,
});
const { t, te } = useI18n();

const art = computed(() => itemArtwork(props.item, 320));

const isPlayable = computed(() => props.item.is_playable !== false);

// Provider badge on the cover — always for playlists (to show the source),
// otherwise only when the consumer opts in via showProviderOnCover.
const providerDomain = computed<string | undefined>(() => {
  const it = props.item;
  if (!("provider_mappings" in it)) return undefined;
  if (!props.showProviderOnCover && it.media_type !== MediaType.PLAYLIST) {
    return undefined;
  }
  return it.media_type === MediaType.PLAYLIST
    ? it.provider_mappings[0]?.provider_domain
    : it.provider;
});

const displayName = computed(() => {
  if (props.item.media_type === MediaType.GENRE) {
    return getGenreDisplayName(
      props.item.name,
      props.item.translation_key,
      t,
      te,
    );
  }
  return props.item.name;
});

const subtitle = computed(() => {
  const it = props.item as Partial<
    Album &
      Track & {
        authors?: string[];
        publisher?: string;
        owner?: string;
      }
  >;
  if (it.artists?.length) return getArtistsString(it.artists, 1);
  if (it.authors?.length) return it.authors.join(" / ");
  if (it.publisher) return it.publisher;
  if (it.owner) return it.owner;
  return t(props.item.media_type);
});

const onClick = (e: MouseEvent) =>
  handleMediaItemClick(props.item, e.clientX, e.clientY);
const onPlay = (e: MouseEvent) =>
  handlePlayBtnClick(props.item, e.clientX, e.clientY);
const onMenu = (e: MouseEvent) =>
  handleMenuBtnClick(props.item, e.clientX, e.clientY);
</script>

<style scoped>
.ed-card {
  --ed-card-pad: 8px;
  --ed-art-size: var(--ed-tile-art, 168px);
  position: relative;
  flex: 0 0 auto;
  width: calc(var(--ed-art-size) + 2 * var(--ed-card-pad));
  box-sizing: border-box;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: none;
  padding: var(--ed-card-pad);
  border-radius: var(--ed-card-pad);
  color: rgb(var(--v-theme-on-background));
  scroll-snap-align: start;
  transition: background 0.15s ease;
}
.ed-card:hover {
  background: rgba(var(--v-theme-on-surface), 0.08);
}
.ed-card--unavailable {
  opacity: 0.3;
}
.ed-card__art {
  position: relative;
  width: var(--ed-art-size);
  height: var(--ed-art-size);
  border-radius: var(--ed-card-pad);
  overflow: hidden;
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.25),
    inset 0 0 0 1px rgba(255, 255, 255, 0.04);
}
.ed-card__provider {
  position: absolute;
  top: 6px;
  left: 6px;
  z-index: 2;
}
.ed-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.ed-card__play {
  position: absolute;
  bottom: 10px;
  right: 8px;
  width: 38px;
  height: 38px;
  border-radius: 999px;
  background: rgb(var(--v-theme-primary));
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transform: translateY(8px);
  transition:
    opacity 0.18s,
    transform 0.18s;
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.35);
}
.ed-card__play-icon {
  margin-left: 2px;
  /* guarantee a solid white triangle regardless of lucide's default fill */
  fill: currentColor;
  stroke: none;
}
.ed-card:hover .ed-card__play {
  opacity: 1;
  transform: translateY(0);
}
.ma-tap:active {
  transform: scale(0.97);
}
.ed-card__meta {
  width: var(--ed-art-size);
  margin-top: 10px;
}
.ed-card__title {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ed-card__sub {
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}
</style>
