<template>
  <DetailHero
    :item="item"
    :backdrop="backdrop"
    :blur-backdrop="!wideArt"
    :height="400"
    :phone-height="360"
    @edit-rows="emit('edit-rows')"
  >
    <template #toolbar-append>
      <DetailHeroFavorite v-if="item" :item="item" />
    </template>

    <template v-if="item" #main>
      <div
        class="flex w-full min-w-0 items-end gap-6 @max-3xl/detail-hero:flex-col @max-3xl/detail-hero:items-stretch @max-3xl/detail-hero:gap-3"
      >
        <div
          class="detail-hero-cover size-[200px] flex-none overflow-hidden rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.5)] @max-3xl/detail-hero:size-[132px]"
        >
          <MediaItemThumb :item="item" :rounded="false" />
        </div>
        <div class="flex min-w-0 flex-1 flex-col gap-2.5 pb-1">
          <h1
            class="m-0 line-clamp-2 text-[44px] font-medium leading-[1.2] tracking-[-1.1px] [text-shadow:0_2px_12px_rgba(0,0,0,0.5)] @max-3xl/detail-hero:text-[30px] @max-3xl/detail-hero:tracking-[-0.7px]"
          >
            {{ item.name }}
            <span v-if="item.version" class="text-white/70">
              ({{ item.version }})
            </span>
          </h1>
          <div
            class="flex flex-col gap-1 text-[15px] text-white/85 [text-shadow:0_1px_6px_rgba(0,0,0,0.5)] @max-3xl/detail-hero:text-sm"
          >
            <div
              v-for="credit in credits"
              :key="credit.label"
              class="flex min-w-0 items-center gap-2"
              :title="$t(credit.label)"
            >
              <component
                :is="credit.icon"
                :size="16"
                class="flex-none"
                aria-hidden="true"
              />
              <span class="sr-only">{{ $t(credit.label) }}:</span>
              <span class="min-w-0 truncate">
                <template v-for="(person, index) in credit.people" :key="index">
                  <span v-if="index > 0"> / </span>
                  <span v-if="typeof person === 'string'">{{ person }}</span>
                  <button
                    v-else
                    type="button"
                    class="inline cursor-pointer border-0 bg-transparent p-0 align-baseline text-inherit [font:inherit] hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    @click="gotoArtist(person)"
                  >
                    {{ person.name }}
                  </button>
                </template>
              </span>
            </div>
            <div v-if="item.duration > 0" class="flex items-center gap-2">
              <Timer :size="16" class="flex-none" aria-hidden="true" />
              {{ formatDuration(item.duration) }}
            </div>
          </div>

          <div class="flex min-w-0 flex-wrap items-center gap-2">
            <DetailHeroPlayButton :item="item" />
            <DetailHeroPlayedState v-if="playedState" :item="item" />
            <span
              v-if="!item.fully_played && position > 0"
              class="text-sm text-white/85"
            >
              {{ formatDuration(position) }}
            </span>
          </div>
          <Progress
            v-if="progress !== undefined"
            :model-value="progress"
            :aria-label="
              $t(item.fully_played ? 'item_fully_played' : 'item_in_progress')
            "
            class="h-1 max-w-80 bg-white/20"
          />
        </div>
      </div>
    </template>

    <template v-if="item" #aside>
      <DetailHeroGenres :item="item" />
      <DetailHeroProviders :item="item" />
    </template>
  </DetailHero>
</template>

<script setup lang="ts">
import DetailHero from "@/components/details/DetailHero.vue";
import DetailHeroFavorite from "@/components/details/DetailHeroFavorite.vue";
import DetailHeroGenres from "@/components/details/DetailHeroGenres.vue";
import DetailHeroPlayButton from "@/components/details/DetailHeroPlayButton.vue";
import DetailHeroPlayedState from "@/components/details/DetailHeroPlayedState.vue";
import DetailHeroProviders from "@/components/details/DetailHeroProviders.vue";
import MediaItemThumb from "@/components/MediaItemThumb.vue";
import { Progress } from "@/components/ui/progress";
import { getPlayedState } from "@/helpers/played_state";
import { formatDuration, getImageThumbForItem } from "@/helpers/utils";
import {
  ImageType,
  type Artist,
  type Audiobook,
} from "@/plugins/api/interfaces";
import { Mic, PenLine, Timer } from "@lucide/vue";
import { computed } from "vue";
import { useRouter } from "vue-router";

export interface Props {
  item?: Audiobook;
}
const props = defineProps<Props>();
const emit = defineEmits<{ (e: "edit-rows"): void }>();

const router = useRouter();

// a provider's artist is a link, a plain name stays text
const credits = computed(() =>
  [
    { label: "authors", icon: PenLine, people: props.item?.authors ?? [] },
    { label: "narrators", icon: Mic, people: props.item?.narrators ?? [] },
  ].filter((credit) => credit.people.length),
);
const wideArt = computed(
  () =>
    getImageThumbForItem(props.item, ImageType.FANART) ||
    getImageThumbForItem(props.item, ImageType.LANDSCAPE),
);
const backdrop = computed(
  () => wideArt.value || getImageThumbForItem(props.item, ImageType.THUMB),
);
const playedState = computed(() =>
  props.item ? getPlayedState(props.item) : undefined,
);
const position = computed(() =>
  Math.max(0, (props.item?.resume_position_ms ?? 0) / 1000),
);
const gotoArtist = function (artist: Artist) {
  router.push({
    name: "artist",
    params: { itemId: artist.item_id, provider: artist.provider },
  });
};
const progress = computed(() => {
  const item = props.item;
  if (!item || !(item.duration > 0)) return undefined;
  if (item.fully_played) return 100;
  if (!position.value) return undefined;
  return Math.min(100, (position.value / item.duration) * 100);
});
</script>
