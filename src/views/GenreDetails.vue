<template>
  <section>
    <InfoHeader :item="itemDetails" :active-provider="provider" />

    <div v-if="loadingRows" class="rows-loading">
      <v-progress-linear color="accent" height="4" indeterminate rounded />
    </div>

    <div class="overview-container">
      <div v-for="row in displayRows" :key="row.title" class="overview-row">
        <WidgetRow
          :widget-row="row"
          :show-provider-on-cover="true"
          :show-action-icon="true"
        />
      </div>
    </div>

    <GenreAliasManager
      v-if="itemDetails && isAdmin"
      :genre="itemDetails"
      :existing-genre-names="existingGenreNames"
      @reload="loadItemDetails"
    />
  </section>
</template>

<script setup lang="ts">
import GenreAliasManager from "@/components/genre/GenreAliasManager.vue";
import InfoHeader from "@/components/InfoHeader.vue";
import WidgetRow from "@/components/WidgetRow.vue";
import { genreMediaTypeIconMap, folderIdToRoute } from "@/helpers/genre";
import { getGenreDisplayName } from "@/helpers/utils";
import { api } from "@/plugins/api";
import {
  EventMessage,
  EventType,
  Genre,
  MediaItemTypeOrItemMapping,
  MediaType,
  MediaItemType,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type Component,
} from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

export interface Props {
  itemId: string;
  provider: string;
}
const props = defineProps<Props>();
const itemDetails = ref<Genre>();
const loading = ref(false);
const loadingRows = ref(false);
const overviewRows = ref<
  Array<{
    title: string;
    items: MediaItemTypeOrItemMapping[];
    icon?: string | Component;
    action?: () => void;
  }>
>([]);
const existingGenreNames = ref<Set<string>>(new Set());

const { t, te } = useI18n();
const router = useRouter();

const isAdmin = computed(() => authManager.isAdmin());

const displayRows = computed(() =>
  overviewRows.value.filter((row) => row.items?.length),
);

const loadItemDetails = async () => {
  loading.value = true;
  itemDetails.value = await api.getGenre(props.itemId, props.provider);
  const allGenres = await api.getLibraryGenres();
  existingGenreNames.value = new Set(
    allGenres.map((g) => g.name.toLowerCase()),
  );
  loading.value = false;
};

const loadOverviewRows = async () => {
  if (!itemDetails.value) return;
  loadingRows.value = true;

  try {
    const recommendationFolders = await api.getGenreOverviewRows(
      itemDetails.value.item_id,
      itemDetails.value.provider,
    );

    if (recommendationFolders && recommendationFolders.length > 0) {
      overviewRows.value = recommendationFolders.map((folder) => {
        return {
          title: getGenreDisplayName(
            folder.name || "",
            folder.translation_key,
            t,
            te,
          ),
          items: folder.items || [],
          icon: genreMediaTypeIconMap[folder.media_type],
          action: () => {
            if (!itemDetails.value) return;
            const routeName = folderIdToRoute[folder.item_id];
            if (routeName) {
              router.push({
                name: routeName,
                query: { genre_ids: itemDetails.value.item_id },
              });
            }
          },
        };
      });
    } else {
      overviewRows.value = [];
    }
  } catch (error) {
    console.error("Failed to load genre overview:", error);
    overviewRows.value = [];
  }

  // Fallback: if no overview rows returned, try loading radio base tracks
  if (overviewRows.value.length === 0) {
    try {
      const tracks = await api.getGenreRadioBaseTracks(
        itemDetails.value.item_id,
        itemDetails.value.provider,
      );
      overviewRows.value = [
        {
          title: t("tracks"),
          items: tracks,
          icon: genreMediaTypeIconMap[MediaType.TRACK],
        },
      ];
    } catch (error) {
      console.error("Failed to load genre radio base tracks:", error);
      overviewRows.value = [];
    }
  }

  loadingRows.value = false;
};

watch(
  () => props.itemId,
  (val) => {
    if (val) loadItemDetails();
  },
  { immediate: true },
);

watch(
  () => itemDetails.value?.uri,
  () => {
    loadOverviewRows();
  },
);

onMounted(() => {
  const unsub = api.subscribe(
    EventType.MEDIA_ITEM_UPDATED,
    (evt: EventMessage) => {
      const updatedItem = evt.data as MediaItemType;
      if (itemDetails.value?.uri == updatedItem.uri) {
        itemDetails.value = updatedItem as Genre;
      }
    },
  );
  onBeforeUnmount(unsub);
});
</script>

<style scoped>
.rows-loading {
  margin: 20px 0;
}

.overview-row {
  margin-top: 10px;
}

.overview-container {
  padding: 0 16px 16px 16px;
}
</style>
