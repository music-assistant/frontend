<template>
  <section
    class="artist-top-tracks"
    :class="{ 'artist-top-tracks--with-latest': showLatestRelease }"
  >
    <div v-if="showLatestRelease" class="artist-top-tracks__latest">
      <h2 class="artist-top-tracks__title">{{ $t("latest_release") }}</h2>
      <EditorialMediaCard
        :item="latestRelease!"
        :parent-item="artist"
        fluid
        :is-available="itemIsAvailable(latestRelease!)"
      >
        <template #art-overlay>
          <span class="artist-top-tracks__art-scrim"></span>
          <span v-if="latestReleaseYear" class="artist-top-tracks__year">{{
            latestReleaseYear
          }}</span>
        </template>
        <template #subtitle>{{ latestReleaseSubtitle }}</template>
      </EditorialMediaCard>
    </div>

    <div class="artist-top-tracks__main">
      <div class="artist-top-tracks__head">
        <div
          v-hold="onHold"
          class="artist-top-tracks__titles"
          @touchstart.passive="onTouchStart"
          @click.capture="swallowClickAfterHold"
        >
          <h2 class="artist-top-tracks__title">{{ $t("artist_toptracks") }}</h2>
          <span v-if="sourceLabel" class="artist-top-tracks__source">
            <ProviderIcon
              v-if="sourceDomain"
              :domain="sourceDomain"
              :size="12"
            />
            {{ sourceLabel }}
          </span>
        </div>
        <RouterLink
          v-if="libraryTrackCount"
          :to="allTracksRoute"
          class="artist-top-tracks__more"
        >
          {{ $t("n_in_library", { count: libraryTrackCount }) }}
        </RouterLink>
      </div>

      <div class="artist-top-tracks__grid">
        <template v-if="shownTracks">
          <div
            v-for="(track, index) in shownTracks"
            :key="track.uri"
            v-hold="(e: Event) => onTrackHold(e, track)"
            class="artist-top-tracks__track"
            :class="{
              'artist-top-tracks__track--playing': isNowPlaying(track),
            }"
            role="button"
            tabindex="0"
            @click="(e: MouseEvent) => onTrackClick(e, track)"
            @keydown.enter.self="(e: KeyboardEvent) => onTrackClick(e, track)"
            @keydown.space.self.prevent="
              (e: KeyboardEvent) => onTrackClick(e, track)
            "
            @contextmenu.prevent="(e: MouseEvent) => onTrackMenu(e, track)"
            @touchstart.passive="onTrackTouchStart"
          >
            <span class="artist-top-tracks__index">
              <Play
                v-if="isNowPlaying(track)"
                :size="15"
                fill="currentColor"
                :stroke-width="0"
              />
              <template v-else>{{ index + 1 }}</template>
            </span>
            <span class="artist-top-tracks__art">
              <MediaItemThumb :item="track" :size="40" />
            </span>
            <span class="artist-top-tracks__text">
              <span class="artist-top-tracks__name">{{ track.name }}</span>
              <span class="artist-top-tracks__album">{{
                albumLine(track)
              }}</span>
            </span>
            <span v-if="track.duration" class="artist-top-tracks__duration">{{
              formatDuration(track.duration)
            }}</span>
            <button
              type="button"
              class="artist-top-tracks__menu"
              :aria-label="`${$t('more_options')}: ${track.name}`"
              @click.stop="(e: MouseEvent) => onTrackMenu(e, track)"
            >
              <EllipsisVertical :size="16" />
            </button>
          </div>
        </template>
        <template v-else>
          <div
            v-for="index in skeletonCount"
            :key="index"
            class="artist-top-tracks__track"
            aria-hidden="true"
          >
            <Skeleton class="artist-top-tracks__art" />
            <Skeleton class="artist-top-tracks__skeleton-text" />
          </div>
        </template>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import EditorialMediaCard from "@/components/discover/EditorialMediaCard.vue";
import MediaItemThumb from "@/components/MediaItemThumb.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getEventPosition,
  useHoldToOpenMenu,
} from "@/composables/useHoldToOpenMenu";
import {
  handleMediaItemClick,
  handleMenuBtnClick,
} from "@/helpers/media_item_actions";
import { formatDuration } from "@/helpers/utils";
import { itemIsAvailable } from "@/plugins/api/helpers";
import {
  AlbumType,
  PlaybackState,
  type Album,
  type Artist,
  type ItemMapping,
  type Track,
} from "@/plugins/api/interfaces";
import { isPhoneSizedScreen } from "@/plugins/breakpoint";
import { $t, canonicalizeLocale, i18n } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { EllipsisVertical, Play } from "@lucide/vue";
import { computed } from "vue";
import { RouterLink, type RouteLocationRaw } from "vue-router";

export interface Props {
  artist: Artist;
  // undefined while the row is still loading
  tracks?: Track[];
  // provider name when a single provider feeds the row, nothing when aggregated
  sourceLabel?: string;
  // provider domain behind `sourceLabel`, for its icon
  sourceDomain?: string;
  libraryTrackCount?: number;
  latestRelease?: Album;
}
const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "edit-rows"): void;
}>();

const DESKTOP_TRACKS = 9;
const PHONE_TRACKS = 5;

const isPhone = computed(() => isPhoneSizedScreen());

const shownTracks = computed(() =>
  props.tracks?.slice(0, isPhone.value ? PHONE_TRACKS : DESKTOP_TRACKS),
);

const skeletonCount = computed(() =>
  isPhone.value ? PHONE_TRACKS : DESKTOP_TRACKS,
);

// the latest release sits beside the track grid, which the phone layout has no
// room for
const showLatestRelease = computed(
  () => !isPhone.value && !!props.latestRelease,
);

const latestReleaseYear = computed(() => releaseYear(props.latestRelease));

const latestReleaseSubtitle = computed(() => {
  const release = props.latestRelease;
  if (!release) return "";
  const parts: string[] = [];
  if (release.album_type !== AlbumType.UNKNOWN) {
    parts.push($t(`album_type.${release.album_type}`));
  }
  const released = releaseDate(release);
  if (released) {
    parts.push(
      released.toLocaleDateString(
        canonicalizeLocale(i18n.global.locale.value),
        {
          year: "numeric",
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        },
      ),
    );
  } else if (release.year) {
    parts.push(String(release.year));
  }
  return parts.join(" · ");
});

const allTracksRoute = computed<RouteLocationRaw>(() => ({
  name: "artistlisting",
  params: {
    provider: props.artist.provider,
    itemId: props.artist.item_id,
    listing: "tracks",
  },
}));

const { onHold, onTouchStart, swallowClickAfterHold } = useHoldToOpenMenu(() =>
  emit("edit-rows"),
);

const {
  onHold: onTrackHold,
  onTouchStart: onTrackTouchStart,
  swallowClickAfterHold: swallowClickAfterTrackHold,
} = useHoldToOpenMenu<[Track]>((evt, track) => onTrackMenu(evt, track));

const isNowPlaying = function (track: Track): boolean {
  if (store.activePlayer?.playback_state != PlaybackState.PLAYING) return false;
  const current = store.curQueueItem?.media_item;
  return !!current && current.item_id === track.item_id;
};

const albumLine = function (track: Track): string {
  if (!track.album) return "";
  const year = releaseYear(track.album);
  return year ? `${track.album.name} · ${year}` : track.album.name;
};

const onTrackClick = function (
  event: MouseEvent | KeyboardEvent,
  track: Track,
) {
  if (swallowClickAfterTrackHold(event)) return;
  const x = "clientX" in event ? event.clientX : 0;
  const y = "clientY" in event ? event.clientY : 0;
  handleMediaItemClick(track, x, y, props.artist);
};

const onTrackMenu = function (event: Event, track: Track) {
  const { x, y } = getEventPosition(event);
  handleMenuBtnClick(track, x, y, props.artist, true);
};

/** The release year of an album or its slim mapping, when it carries one. */
function releaseYear(album?: Album | ItemMapping | null): number | undefined {
  if (!album || !("year" in album)) return undefined;
  return album.year || undefined;
}

/** The album's parsed release date, when it has a valid one. */
function releaseDate(album: Album): Date | undefined {
  const released = album.metadata?.release_date;
  if (!released) return undefined;
  const parsed = new Date(released);
  return isNaN(parsed.getTime()) ? undefined : parsed;
}
</script>

<style scoped>
.artist-top-tracks {
  padding: 26px 28px 28px;
  display: grid;
  gap: 28px;
  align-items: start;
}
.artist-top-tracks--with-latest {
  grid-template-columns: 184px minmax(0, 1fr);
}
.artist-top-tracks__latest {
  width: 184px;
}
.artist-top-tracks__latest > .artist-top-tracks__title {
  margin-bottom: 14px;
}
/* the card fills the column instead of carrying the shelf's tile padding */
.artist-top-tracks__latest :deep(.ed-card) {
  padding: 0;
}
.artist-top-tracks__art-scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(0, 0, 0, 0.05) 0%,
    rgba(0, 0, 0, 0.35) 60%,
    rgba(0, 0, 0, 0.7) 100%
  );
}
.artist-top-tracks__year {
  position: absolute;
  left: 12px;
  bottom: 10px;
  font-size: 13px;
  font-weight: 500;
  color: #fff;
}
.artist-top-tracks__main {
  min-width: 0;
}
.artist-top-tracks__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 14px;
}
.artist-top-tracks__titles {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.artist-top-tracks__title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.4px;
  color: rgb(var(--v-theme-on-background));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.artist-top-tracks__more {
  flex: none;
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--v-theme-primary));
  text-decoration: none;
  white-space: nowrap;
}
.artist-top-tracks__more:hover,
.artist-top-tracks__more:focus-visible {
  text-decoration: underline;
}
.artist-top-tracks__source {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(var(--v-theme-on-surface), 0.12);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.artist-top-tracks__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-auto-rows: 56px;
  column-gap: 16px;
  min-height: 184px;
  align-content: center;
  margin-left: -8px;
}
.artist-top-tracks__track {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 56px;
  padding: 0 8px;
  border-radius: 8px;
  cursor: pointer;
  min-width: 0;
}
.artist-top-tracks__track:hover {
  background: rgba(var(--v-theme-on-surface), 0.05);
}
.artist-top-tracks__track--playing {
  background: rgba(var(--v-theme-on-surface), 0.08);
}
.artist-top-tracks__index {
  width: 18px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  font-variant-numeric: tabular-nums;
}
.artist-top-tracks__track--playing .artist-top-tracks__index {
  color: rgb(var(--v-theme-primary));
  justify-content: center;
}
.artist-top-tracks__art {
  width: 40px;
  height: 40px;
  flex: none;
  border-radius: 6px;
  overflow: hidden;
}
.artist-top-tracks__text {
  display: block;
  flex: 1;
  min-width: 0;
}
.artist-top-tracks__name {
  display: block;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.artist-top-tracks__track--playing .artist-top-tracks__name {
  color: rgb(var(--v-theme-primary));
}
.artist-top-tracks__album {
  display: block;
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.artist-top-tracks__duration {
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  font-variant-numeric: tabular-nums;
  flex: none;
}
.artist-top-tracks__menu {
  width: 22px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0;
  background: none;
  color: rgba(var(--v-theme-on-surface), 0.6);
  cursor: pointer;
}
.artist-top-tracks__skeleton-text {
  height: 16px;
  flex: 1;
}

@media (max-width: 768px) {
  .artist-top-tracks {
    padding: 22px 16px 20px;
    grid-template-columns: minmax(0, 1fr);
  }
  .artist-top-tracks__head {
    margin-bottom: 8px;
  }
  .artist-top-tracks__title {
    font-size: 19px;
  }
  .artist-top-tracks__grid {
    grid-template-columns: minmax(0, 1fr);
    min-height: 0;
    margin-left: 0;
  }
  .artist-top-tracks__track {
    padding: 0;
    border-radius: 0;
    border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  }
}
</style>
