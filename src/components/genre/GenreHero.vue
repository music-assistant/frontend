<template>
  <DetailHero
    class="genre-hero"
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
      <h1 class="genre-hero__name">{{ item.name }}</h1>
      <div class="genre-hero__actions">
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
        <ItemSourceBadge
          class="size-9 rounded-md border border-white/25 bg-black/40"
          :item="item"
          :size="20"
        />
      </div>
    </template>
  </DetailHero>
</template>

<script setup lang="ts">
import DetailHero from "@/components/details/DetailHero.vue";
import DetailHeroButton from "@/components/details/DetailHeroButton.vue";
import DetailHeroFavorite from "@/components/details/DetailHeroFavorite.vue";
import DetailHeroPlayButton from "@/components/details/DetailHeroPlayButton.vue";
import ItemSourceBadge from "@/components/ItemSourceBadge.vue";
import { getImageThumbForItem } from "@/helpers/utils";
import { ImageType, Scope, type Genre } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { eventbus } from "@/plugins/eventbus";
import { Merge, Trash2 } from "@lucide/vue";
import { computed, type Component } from "vue";

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

<style scoped>
.genre-hero__name {
  max-width: 100%;
  margin: 0;
  font-size: 48px;
  font-weight: 500;
  line-height: 1.2;
  overflow-wrap: anywhere;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);
}

.genre-hero__actions {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 8px;
  align-self: stretch;
  min-width: 0;
}

.genre-hero.detail-hero--phone .genre-hero__name {
  font-size: 34px;
}

.genre-hero.detail-hero--phone .genre-hero__actions {
  gap: 10px;
}
</style>
