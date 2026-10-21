<template>
  <DetailHero
    :item="item"
    :backdrop="backdrop"
    blur-backdrop
    :height="400"
    :phone-height="360"
    :editable-rows="false"
  >
    <template v-if="item" #main>
      <div
        class="flex w-full min-w-0 items-end gap-6 max-md:flex-col max-md:items-stretch max-md:gap-3"
      >
        <div class="detail-hero-cover flex-none">
          <MediaCollectionThumb
            :item="item"
            :size="`${coverSize}px`"
            :thumb-offset="coverSize * STACK_OFFSET_RATIO"
          />
        </div>

        <div class="flex min-w-0 flex-1 flex-col gap-2.5 pb-1">
          <h1
            class="m-0 line-clamp-2 text-[44px] leading-[1.2] font-medium tracking-[-1.1px] [text-shadow:0_2px_12px_rgba(0,0,0,0.5)] max-md:text-[30px] max-md:tracking-[-0.7px]"
          >
            {{ item.name }}
          </h1>

          <div
            class="flex flex-col gap-1 text-[15px] text-white/85 [text-shadow:0_1px_6px_rgba(0,0,0,0.5)] max-md:text-sm"
          >
            <div
              v-if="authors.length"
              class="flex min-w-0 items-center gap-2"
              :title="$t('authors')"
            >
              <PenLine :size="16" class="flex-none" />
              <span class="min-w-0 truncate">{{ authors.join(" / ") }}</span>
            </div>
            <div
              v-if="narrators.length"
              class="flex min-w-0 items-center gap-2"
              :title="$t('narrators')"
            >
              <Mic :size="16" class="flex-none" />
              <span class="min-w-0 truncate">{{ narrators.join(" / ") }}</span>
            </div>
            <DetailHeroFacts :icon="BookAudio" :facts="facts" />
          </div>

          <div class="flex min-w-0 items-center gap-2 max-md:gap-2.5">
            <DetailHeroPlayButton :item="item" />
            <DetailHeroPlayedState :item="item" />
          </div>
        </div>
      </div>
    </template>
  </DetailHero>
</template>

<script setup lang="ts">
import DetailHero from "@/components/details/DetailHero.vue";
import DetailHeroFacts from "@/components/details/DetailHeroFacts.vue";
import DetailHeroPlayButton from "@/components/details/DetailHeroPlayButton.vue";
import DetailHeroPlayedState from "@/components/details/DetailHeroPlayedState.vue";
import MediaCollectionThumb from "@/components/MediaCollectionThumb.vue";
import { formatTotalDuration } from "@/helpers/duration";
import {
  getAudiobookCollectionArtists,
  getImageThumbForItem,
} from "@/helpers/utils";
import {
  ImageType,
  type Audiobook,
  type MediaCollection,
} from "@/plugins/api/interfaces";
import { isPhoneSizedScreen } from "@/plugins/breakpoint";
import { $t } from "@/plugins/i18n";
import { BookAudio, Mic, PenLine } from "@lucide/vue";
import { computed } from "vue";

export interface Props {
  item?: MediaCollection<Audiobook>;
}
const props = defineProps<Props>();

// keeps the stacked covers inside the cover's square at any size
const STACK_OFFSET_RATIO = 0.095;

const coverSize = computed(() => (isPhoneSizedScreen() ? 132 : 200));

// a collection has no artwork of its own, so the first book cover is blurred
// behind the hero
const backdrop = computed(() => {
  const book = props.item?.items.find((item) =>
    getImageThumbForItem(item, ImageType.THUMB),
  );
  return getImageThumbForItem(book, ImageType.THUMB);
});

const authors = computed(() =>
  props.item
    ? getAudiobookCollectionArtists(props.item, (book) => book.authors)
    : [],
);

const narrators = computed(() =>
  props.item
    ? getAudiobookCollectionArtists(props.item, (book) => book.narrators)
    : [],
);

// "Collection · 5 audiobooks · 42 h 10 min", without whatever is unknown
const facts = computed(() => {
  const parts = [$t("collection")];
  const books = props.item?.items ?? [];
  if (books.length) {
    parts.push(
      $t("n_audiobooks", books.length, { named: { count: books.length } }),
    );
  }
  const duration = books.reduce(
    (total, book) => total + (book.duration || 0),
    0,
  );
  if (duration) parts.push(formatTotalDuration(duration));
  return parts;
});
</script>
