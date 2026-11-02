<template>
  <DetailHero
    :item="item"
    :backdrop="backdrop"
    :blur-backdrop="blurBackdrop"
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
            class="m-0 line-clamp-2 text-[44px] leading-[1.2] font-medium tracking-[-1.1px] [text-shadow:0_2px_12px_rgba(0,0,0,0.5)] max-md:text-[30px] max-md:tracking-[-0.7px]"
          >
            {{ item.name }}
          </h1>
          <div class="flex min-w-0 items-center gap-2 max-md:gap-2.5">
            <DetailHeroPlayButton :item="item" />
            <DetailHeroSourceBadge :item="item" library-only />
          </div>
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
import DetailHeroSourceBadge from "@/components/details/DetailHeroSourceBadge.vue";
import MediaItemThumb from "@/components/MediaItemThumb.vue";
import { getImageThumbForItem } from "@/helpers/utils";
import { ImageType, type Radio } from "@/plugins/api/interfaces";
import { isPhoneSizedScreen } from "@/plugins/breakpoint";
import { computed } from "vue";

export interface Props {
  item?: Radio;
}
const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "edit-rows"): void;
}>();

const isPhone = computed(() => isPhoneSizedScreen());
const coverSize = computed(() => (isPhone.value ? 132 : 200));
const backdrop = computed(() => {
  if (!props.item) return undefined;
  return (
    getImageThumbForItem(props.item, ImageType.FANART) ||
    getImageThumbForItem(props.item, ImageType.LANDSCAPE) ||
    getImageThumbForItem(props.item, ImageType.THUMB)
  );
});
const blurBackdrop = computed(
  () =>
    !!props.item &&
    !getImageThumbForItem(props.item, ImageType.FANART) &&
    !getImageThumbForItem(props.item, ImageType.LANDSCAPE),
);
</script>
