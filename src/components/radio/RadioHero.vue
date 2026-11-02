<template>
  <DetailHero
    class="radio-hero"
    :class="{ 'radio-hero--phone': isPhone }"
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
      <div class="radio-hero__main">
        <div class="radio-hero__cover detail-hero-cover">
          <MediaItemThumb :item="item" :size="coverSize" :rounded="false" />
        </div>

        <div class="radio-hero__text">
          <h1 class="radio-hero__name">{{ item.name }}</h1>
          <div class="radio-hero__actions">
            <DetailHeroPlayButton :item="item" />
            <DetailHeroSourceBadge :item="item" library-only />
          </div>
        </div>
      </div>
    </template>
  </DetailHero>
</template>

<script setup lang="ts">
import DetailHero from "@/components/details/DetailHero.vue";
import DetailHeroFavorite from "@/components/details/DetailHeroFavorite.vue";
import DetailHeroPlayButton from "@/components/details/DetailHeroPlayButton.vue";
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

<style scoped>
.radio-hero__main {
  display: flex;
  align-items: flex-end;
  gap: 24px;
  width: 100%;
  min-width: 0;
}
.radio-hero__cover {
  width: 200px;
  height: 200px;
  flex: none;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
}
.radio-hero__text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  padding-bottom: 4px;
}
.radio-hero__name {
  margin: 0;
  font-size: 44px;
  font-weight: 500;
  letter-spacing: -1.1px;
  line-height: 1.2;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.radio-hero__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

@media (max-width: 768px) {
  .radio-hero__main {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  .radio-hero__cover {
    width: 132px;
    height: 132px;
  }
  .radio-hero__name {
    font-size: 30px;
    letter-spacing: -0.7px;
  }
  .radio-hero__actions {
    gap: 10px;
  }
}
</style>
