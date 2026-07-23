<template>
  <div
    v-hold="onHold"
    class="ed-card ma-tap"
    role="button"
    tabindex="0"
    :class="{
      'ed-card--unavailable': !isAvailable,
      'ed-card--fluid': fluid,
      'ed-card--disabled': disabled,
    }"
    @click="onClick"
    @keydown.enter.self="onClick"
    @keydown.space.self.prevent="onClick"
    @contextmenu.prevent="onMenu"
    @touchstart.passive="holdFired = false"
  >
    <div class="ed-card__art" :style="{ background: art.gradient }">
      <img
        v-if="art.image"
        class="ed-card__img"
        :class="{ 'ed-card__img--genre': isGenre }"
        loading="lazy"
        :src="art.image"
        :alt="item.name"
      />
      <span v-else-if="art.initials" class="ed-card__initials">{{
        art.initials
      }}</span>
      <ProviderIcon
        v-if="providerDomain"
        class="ed-card__provider"
        :domain="providerDomain"
        :size="20"
      />
      <NowPlayingBadge
        v-if="isPlaying"
        :show-badge="false"
        icon-style="position: absolute; right: 6px; bottom: 6px; z-index: 2"
      />
      <div
        v-if="showCheckboxes"
        class="ed-card__select"
        :class="{ 'ed-card__select--on': isSelected }"
      >
        <v-icon
          size="30"
          :icon="
            isSelected
              ? 'mdi-check-circle'
              : 'mdi-checkbox-blank-circle-outline'
          "
        />
      </div>
    </div>
    <div class="ed-card__meta">
      <div
        class="ed-card__title"
        :class="{ 'ed-card__title--playing': isPlaying }"
      >
        {{ displayName }}
      </div>
      <div class="ed-card__sub">
        <slot name="subtitle">{{ subtitle }}</slot>
      </div>
      <span v-if="showPlay" class="ed-card__play" @click.stop="onPlay">
        <Play
          :size="18"
          fill="currentColor"
          :stroke-width="0"
          class="ed-card__play-icon"
        />
      </span>
    </div>

    <slot name="actions"></slot>
  </div>
</template>

<script setup lang="ts">
import { itemArtwork } from "@/components/discover/editorialArtwork";
import NowPlayingBadge from "@/components/NowPlayingBadge.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import {
  getArtistsString,
  getBrowseFolderName,
  handleMediaItemClick,
  handleMenuBtnClick,
  handlePlayBtnClick,
} from "@/helpers/utils";
import { getListItemProviderIconDomain } from "@/plugins/api/helpers";
import {
  type Album,
  type BrowseFolder,
  type ItemMapping,
  type MediaItemType,
  MediaType,
  type Track,
} from "@/plugins/api/interfaces";
import { Play } from "@lucide/vue";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";

interface Props {
  item: MediaItemType | ItemMapping;
  showProviderOnCover?: boolean;
  isAvailable?: boolean;
  fluid?: boolean;
  isSelected?: boolean;
  showCheckboxes?: boolean;
  isPlaying?: boolean;
  disablePlayButton?: boolean;
  disabled?: boolean;
  parentItem?: MediaItemType;
  sortBy?: string;
}
const props = withDefaults(defineProps<Props>(), {
  showProviderOnCover: false,
  isAvailable: true,
  fluid: false,
  isSelected: false,
  showCheckboxes: false,
  isPlaying: false,
  disablePlayButton: false,
  disabled: false,
  parentItem: undefined,
  sortBy: undefined,
});

const emit = defineEmits<{
  (e: "select", item: MediaItemType | ItemMapping, selected: boolean): void;
}>();

const { t } = useI18n();

const art = computed(() => itemArtwork(props.item, 320));

const isGenre = computed(() => props.item.media_type === MediaType.GENRE);

const isPlayable = computed(() => props.item.is_playable !== false);
const showPlay = computed(
  () => isPlayable.value && props.isAvailable && !props.showCheckboxes,
);

// Provider badge on the cover — always for playlists (to show the source),
// otherwise only when the consumer opts in via showProviderOnCover.
const providerDomain = computed<string | undefined>(() => {
  const it = props.item;
  if (!("provider_mappings" in it)) return undefined;
  if (!props.showProviderOnCover && it.media_type !== MediaType.PLAYLIST) {
    return undefined;
  }
  return getListItemProviderIconDomain(it);
});

const displayName = computed(() => {
  const it = props.item;
  if (it.media_type === MediaType.FOLDER) {
    return getBrowseFolderName(it as BrowseFolder);
  }
  let name = it.name;
  if ("version" in it && it.version) name += ` - ${it.version}`;
  return name;
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

// Set while a long-press opened the context menu, so the click that fires on
// finger-lift does not also navigate. Reset on the next touchstart.
const holdFired = ref(false);

const onClick = (e: MouseEvent | KeyboardEvent) => {
  if (props.disabled) return;
  if (holdFired.value) {
    holdFired.value = false;
    return;
  }
  if (props.showCheckboxes) {
    emit("select", props.item, !props.isSelected);
    return;
  }
  const x = "clientX" in e ? e.clientX : 0;
  const y = "clientY" in e ? e.clientY : 0;
  handleMediaItemClick(props.item, x, y, props.parentItem);
};
// Long-press on touch devices: open the same context menu as right-click.
const onHold = (e: TouchEvent) => {
  if (props.disabled || props.showCheckboxes) return;
  holdFired.value = true;
  const touch = e.touches?.[0];
  handleMenuBtnClick(
    props.item,
    touch?.clientX ?? 0,
    touch?.clientY ?? 0,
    props.parentItem,
    true,
    props.sortBy,
  );
};
const onPlay = (e: MouseEvent) => {
  if (props.showCheckboxes || props.disablePlayButton) return;
  handlePlayBtnClick(
    props.item,
    e.clientX,
    e.clientY,
    props.parentItem,
    undefined,
    props.sortBy,
  );
};
const onMenu = (e: MouseEvent) => {
  if (props.showCheckboxes) return;
  handleMenuBtnClick(
    props.item,
    e.clientX,
    e.clientY,
    props.parentItem,
    true,
    props.sortBy,
  );
};
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
.ed-card--fluid {
  width: 100%;
}
.ed-card--fluid .ed-card__art {
  width: 100%;
  height: auto;
  aspect-ratio: 1 / 1;
}
.ed-card--fluid .ed-card__meta {
  width: 100%;
}
.ed-card:hover {
  background: rgba(var(--v-theme-on-surface), 0.08);
}
.ed-card--unavailable {
  opacity: 0.3;
}
.ed-card--disabled {
  pointer-events: none;
}
.ed-card__art {
  position: relative;
  container-type: inline-size;
  width: var(--ed-art-size);
  height: var(--ed-art-size);
  border-radius: var(--ed-card-pad);
  overflow: hidden;
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.25),
    inset 0 0 0 1px rgba(255, 255, 255, 0.04);
}
.ed-card__initials {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34cqw;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: rgba(255, 255, 255, 0.92);
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  user-select: none;
}
.ed-card__provider {
  position: absolute;
  top: 6px;
  left: 6px;
  z-index: 2;
  margin: 0 !important;
}
.ed-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
/* Genre icons render in white over the banner background (same treatment as
   the "Browse by genre" tiles on the home screen). */
.ed-card__img--genre {
  object-fit: contain;
  padding: 18%;
  filter: brightness(0) invert(1);
}
.ed-card__select {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  padding: 8px;
  z-index: 3;
  color: #fff;
  transition: background 0.15s ease;
}
.ed-card__select--on {
  background: rgba(0, 0, 0, 0.45);
}
/* subtle grey ring on the outside so the white unselected circle stays visible on light thumbs */
.ed-card__select:not(.ed-card__select--on) .v-icon {
  position: relative;
}
.ed-card__select:not(.ed-card__select--on) .v-icon::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  width: 83%;
  height: 83%;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  box-shadow: 0 0 0 2px rgba(192, 192, 192, 0.85);
  pointer-events: none;
}
.ed-card__play {
  position: absolute;
  bottom: 2px;
  right: 0;
  width: 38px;
  height: 38px;
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
  z-index: 4;
}
.ed-card__play-icon {
  margin-left: 2px;
  /* guarantee a solid white triangle regardless of lucide's default fill */
  fill: currentColor;
  stroke: none;
}
.ed-card:hover .ed-card__play {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}
/* Touch devices: no hover-revealed play button — tap goes straight to the
   content and long-press opens the context menu instead. */
@media (hover: none) {
  .ed-card__play {
    display: none;
  }
}
.ma-tap:active {
  transform: scale(0.97);
}
.ed-card__meta {
  position: relative;
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
.ed-card__title--playing {
  color: rgb(var(--v-theme-primary));
}
.ed-card__sub {
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}

@media (max-width: 500px) {
  .ed-card {
    --ed-card-pad: 4px;
  }
  .ed-card__meta {
    margin-top: 4px;
  }
  .ed-card__sub {
    margin-top: 0;
  }
}
</style>
