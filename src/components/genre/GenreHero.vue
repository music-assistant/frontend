<template>
  <DetailHero
    :item="item"
    :backdrop="backdrop"
    :editable-rows="editableRows"
    @edit-rows="emit('edit-rows')"
  >
    <template #toolbar-append>
      <DetailHeroFavorite v-if="item" :item="item" />
      <slot name="toolbar-append"></slot>
    </template>

    <template v-if="item" #main>
      <h1
        class="m-0 max-w-full leading-[1.2] font-medium [overflow-wrap:anywhere] [text-shadow:0_2px_12px_rgba(0,0,0,0.5)]"
        :class="isPhone ? 'text-[34px]' : 'text-[48px]'"
      >
        {{ item.name }}
      </h1>
      <div
        class="flex min-w-0 flex-nowrap items-center self-stretch"
        :class="isPhone ? 'gap-2.5' : 'gap-2'"
      >
        <DetailHeroPlayButton :item="item" />
        <DetailHeroButton
          v-if="canManageGenre"
          :icon="Merge"
          :label="$t('merge_into')"
          @click="mergeGenre"
        />
        <DetailHeroButton
          v-if="canManageGenre"
          :icon="Trash2"
          :label="$t('delete_genre')"
          @click="deleteGenre"
        />
        <DetailHeroSourceBadge :item="item" />
      </div>
    </template>
  </DetailHero>
</template>

<script setup lang="ts">
import DetailHero from "@/components/details/DetailHero.vue";
import DetailHeroButton from "@/components/details/DetailHeroButton.vue";
import DetailHeroFavorite from "@/components/details/DetailHeroFavorite.vue";
import DetailHeroPlayButton from "@/components/details/DetailHeroPlayButton.vue";
import DetailHeroSourceBadge from "@/components/details/DetailHeroSourceBadge.vue";
import { getImageThumbForItem } from "@/helpers/utils";
import { ImageType, Scope, type Genre } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { isPhoneSizedScreen } from "@/plugins/breakpoint";
import { eventbus } from "@/plugins/eventbus";
import { Merge, Trash2 } from "@lucide/vue";
import { computed } from "vue";

export interface Props {
  item?: Genre;
  editableRows?: boolean;
}
const props = withDefaults(defineProps<Props>(), {
  item: undefined,
  editableRows: false,
});

const emit = defineEmits<{
  (e: "edit-rows"): void;
}>();

// matches the hero's own phone layout, which a width breakpoint alone misses
const isPhone = computed(() => isPhoneSizedScreen());

const canManageGenre = computed(
  () =>
    props.item?.provider === "library" &&
    authManager.hasScope(Scope.LIBRARY_MANAGE),
);

const backdrop = computed(() => {
  if (!props.item) return undefined;
  return (
    getImageThumbForItem(props.item, ImageType.FANART) ||
    getImageThumbForItem(props.item, ImageType.LANDSCAPE) ||
    getImageThumbForItem(props.item, ImageType.THUMB)
  );
});

const mergeGenre = () => {
  const genre = props.item;
  if (!genre || !canManageGenre.value) return;
  eventbus.emit("mergeGenreDialog", {
    genreIds: [genre.item_id],
    genreNames: [genre.name],
    genreContentTypes: [genre.content_type],
  });
};

const deleteGenre = () => {
  const genre = props.item;
  if (!genre || !canManageGenre.value) return;
  eventbus.emit("deleteGenreDialog", {
    genreIds: [genre.item_id],
    navigateBack: true,
  });
};
</script>
