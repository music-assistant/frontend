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
        class="flex w-full min-w-0 items-end gap-6 max-md:flex-col max-md:items-stretch max-md:gap-3"
      >
        <div
          class="detail-hero-cover size-[200px] flex-none overflow-hidden rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.5)] max-md:size-[132px]"
        >
          <MediaItemThumb :item="item" :size="coverSize" :rounded="false" />
        </div>
        <div class="flex min-w-0 flex-1 flex-col gap-2.5 pb-1">
          <h1
            class="m-0 line-clamp-2 text-[44px] font-medium leading-[1.2] tracking-[-1.1px] [text-shadow:0_2px_12px_rgba(0,0,0,0.5)] max-md:text-[30px] max-md:tracking-[-0.7px]"
          >
            {{ item.name }}
            <span v-if="item.version" class="text-white/70">
              ({{ item.version }})
            </span>
          </h1>
          <div
            class="flex flex-col gap-1 text-[15px] text-white/85 [text-shadow:0_1px_6px_rgba(0,0,0,0.5)] max-md:text-sm"
          >
            <div
              v-if="authors.length"
              class="flex min-w-0 items-center gap-2"
              :title="$t('authors')"
            >
              <PenLine :size="16" class="flex-none" aria-hidden="true" />
              <span class="sr-only">{{ $t("authors") }}:</span>
              <span class="min-w-0 truncate">{{ authors.join(" / ") }}</span>
            </div>
            <div
              v-if="narrators.length"
              class="flex min-w-0 items-center gap-2"
              :title="$t('narrators')"
            >
              <Mic :size="16" class="flex-none" aria-hidden="true" />
              <span class="sr-only">{{ $t("narrators") }}:</span>
              <span class="min-w-0 truncate">{{ narrators.join(" / ") }}</span>
            </div>
            <div v-if="item.duration > 0" class="flex items-center gap-2">
              <Timer :size="16" class="flex-none" aria-hidden="true" />
              {{ formatDuration(item.duration) }}
            </div>
          </div>

          <div class="flex min-w-0 flex-wrap items-center gap-2">
            <DetailHeroPlayButton :item="item" />
            <span
              v-if="item.fully_played"
              role="img"
              :title="$t('item_fully_played')"
              :aria-label="$t('item_fully_played')"
              class="inline-flex size-9 items-center justify-center"
            >
              <Check :size="20" aria-hidden="true" />
            </span>
            <span
              v-else-if="position > 0"
              class="inline-flex items-center gap-2 text-sm text-white/85"
              :title="$t('item_in_progress')"
            >
              <ClockFading :size="20" aria-hidden="true" />
              <span class="sr-only">{{ $t("item_in_progress") }}:</span>
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
import DetailHeroProviders from "@/components/details/DetailHeroProviders.vue";
import MediaItemThumb from "@/components/MediaItemThumb.vue";
import { Progress } from "@/components/ui/progress";
import {
  formatDuration,
  getAuthorsNarratorsArray,
  getImageThumbForItem,
} from "@/helpers/utils";
import { ImageType, type Audiobook } from "@/plugins/api/interfaces";
import { isPhoneSizedScreen } from "@/plugins/breakpoint";
import { Check, ClockFading, Mic, PenLine, Timer } from "@lucide/vue";
import { computed } from "vue";

export interface Props {
  item?: Audiobook;
}
const props = defineProps<Props>();
const emit = defineEmits<{ (e: "edit-rows"): void }>();

const coverSize = computed(() => (isPhoneSizedScreen() ? 132 : 200));
const authors = computed(() =>
  getAuthorsNarratorsArray(props.item?.authors ?? []),
);
const narrators = computed(() =>
  getAuthorsNarratorsArray(props.item?.narrators ?? []),
);
const wideArt = computed(
  () =>
    getImageThumbForItem(props.item, ImageType.FANART) ||
    getImageThumbForItem(props.item, ImageType.LANDSCAPE),
);
const backdrop = computed(
  () => wideArt.value || getImageThumbForItem(props.item, ImageType.THUMB),
);
const position = computed(() =>
  Math.max(0, (props.item?.resume_position_ms ?? 0) / 1000),
);
const progress = computed(() => {
  const item = props.item;
  if (!item || !(item.duration > 0)) return undefined;
  if (item.fully_played) return 100;
  if (!position.value) return undefined;
  return Math.min(100, (position.value / item.duration) * 100);
});
</script>
