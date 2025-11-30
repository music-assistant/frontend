<script setup lang="ts">
import InfoHeader from "@/components/InfoHeader.vue";
import ItemsListing from "@/components/ItemsListing.vue";
import WidgetRow from "@/components/WidgetRow.vue";
import Toolbar from "@/components/Toolbar.vue";
import Container from "@/components/Container.vue";
import ListItem from "@/components/ListItem.vue";
import { api } from "@/plugins/api";
import { eventbus } from "@/plugins/eventbus";
import {
  EventMessage,
  EventType,
  MediaType,
  Track,
  Album,
  Artist,
  Playlist,
  Podcast,
  Audiobook,
  Genre,
} from "@/plugins/api/interfaces";
import { useGenresStore } from "@/stores/genres";
import { store } from "@/plugins/store";
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  reactive,
  watch,
} from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const genresStore = useGenresStore();

const genreId = computed(() => route.params.id as string);

const previewItems = reactive({
  tracks: [] as Track[],
  albums: [] as Album[],
  artists: [] as Artist[],
  playlists: [] as Playlist[],
  podcasts: [] as Podcast[],
  audiobooks: [] as Audiobook[],
});

const loadPreviewData = async () => {
  // fetch preview items for all categories
  // TODO: add limit to these calls if supported by backend, otherwise we fetch all
  const [tracks, albums, artists, playlists, podcasts, audiobooks] =
    await Promise.all([
      api.getGenreTracks(genreId.value, "library"),
      api.getGenreAlbums(genreId.value, "library"),
      api.getGenreArtists(genreId.value, "library"),
      api.getGenrePlaylists(genreId.value, "library"),
      api.getGenrePodcasts(genreId.value, "library"),
      api.getGenreAudiobooks(genreId.value, "library"),
    ]);
  previewItems.tracks = tracks.slice(0, 20);
  previewItems.albums = albums.slice(0, 20);
  previewItems.artists = artists.slice(0, 20);
  previewItems.playlists = playlists.slice(0, 20);
  previewItems.podcasts = podcasts.slice(0, 20);
  previewItems.audiobooks = audiobooks.slice(0, 20);
};

onMounted(async () => {
  await genresStore.loadGenre(genreId.value);
  loadPreviewData();
  const unsub = api.subscribe(
    EventType.MEDIA_ITEM_UPDATED,
    (evt: EventMessage) => {
      if (evt.object_id == genresStore.currentGenre.value?.uri) {
        genresStore.loadGenre(genreId.value);
        loadPreviewData();
      }
    },
  );
  onBeforeUnmount(unsub);
});

watch(
  () => genreId.value,
  () => {
    genresStore.loadGenre(genreId.value);
    loadPreviewData();
  },
);

const splitAlias = async (alias: string) => {
  if (!genresStore.currentGenre.value) return;
  await genresStore.splitGenre(
    parseInt(genresStore.currentGenre.value.item_id),
    alias,
  );
  eventbus.emit("refreshItems", "genres");
  if (store.prevState?.path === "librarygenres") {
    store.prevState = undefined;
  }
};

const removeAlias = async (alias: string) => {
  if (!genresStore.currentGenre.value) return;
  const genreId = parseInt(genresStore.currentGenre.value.item_id);
  await genresStore.removeAlias(genreId, alias);
};

const showAddAliasDialog = ref(false);
const newAlias = ref<(string | Genre)[]>([]);
const searchInput = ref("");

const items = computed(() => {
  const all = [...genresStore.genres.value, ...genresStore.searchResults.value];
  // Filter out the current genre
  const currentId = genresStore.currentGenre.value?.item_id;
  const filtered = all.filter((g) => g.item_id !== currentId);

  // Deduplicate
  const unique = new Map();
  for (const g of filtered) {
    unique.set(g.item_id, g);
  }
  return Array.from(unique.values());
});

watch(searchInput, (val) => {
  if (val && val.length > 1) {
    genresStore.searchGenres(val);
  }
});

watch(showAddAliasDialog, (val) => {
  if (val) {
    newAlias.value = [];
    searchInput.value = "";
    if (genresStore.genres.value.length === 0) {
      genresStore.loadGenres();
    }
  }
});

const addAlias = async () => {
  if (!newAlias.value.length || !genresStore.currentGenre.value) return;
  const currentGenreId = parseInt(genresStore.currentGenre.value.item_id);

  const aliasesToAdd: string[] = [];
  const genresToMerge: number[] = [];

  for (const item of newAlias.value) {
    if (typeof item === "string") {
      aliasesToAdd.push(item);
    } else if (typeof item === "object" && "item_id" in item) {
      genresToMerge.push(parseInt(item.item_id));
    }
  }

  // Process aliases
  for (const alias of aliasesToAdd) {
    await genresStore.addAlias(currentGenreId, alias);
  }

  // Process merges
  if (genresToMerge.length > 0) {
    await genresStore.mergeGenres(genresToMerge, currentGenreId);
  }

  newAlias.value = [];
  showAddAliasDialog.value = false;
};

const aliasesExpanded = ref(false);
const toggleAliasesExpand = () => {
  aliasesExpanded.value = !aliasesExpanded.value;
};

const aliasToolbarMenuItems = computed(() => {
  return [
    {
      label: "genres.add_linked_genre",
      icon: "mdi-plus",
      action: () => {
        showAddAliasDialog.value = true;
      },
    },
    {
      label: "tooltip.collapse_expand",
      icon: aliasesExpanded.value ? "mdi-chevron-up" : "mdi-chevron-down",
      action: toggleAliasesExpand,
    },
  ];
});

const breadcrumbItems = computed(() => {
  return [
    {
      title: t("genres"),
      disabled: false,
      to: { name: "genres" },
    },
    {
      title: genresStore.currentGenre.value?.name || "",
      disabled: true,
    },
  ];
});
</script>

<template>
  <div
    v-if="genresStore.currentGenre.value"
    class="genre-detail"
    style="height: 100%; overflow-y: auto"
  >
    <InfoHeader :item="genresStore.currentGenre.value">
      <template #title>
        <v-breadcrumbs :items="breadcrumbItems" class="pa-0" />
      </template>
    </InfoHeader>

    <div class="genre-detail__content">
      <!-- Overview with WidgetRows -->
      <div class="pa-4">
        <WidgetRow
          v-if="previewItems.tracks.length"
          :widget-row="{
            title: $t('tracks'),
            icon: 'mdi-file-music',
            items: previewItems.tracks,
          }"
          :show-provider-on-cover="true"
        >
          <template #header-append>
            <v-btn
              variant="text"
              icon="mdi-music-note"
              @click="
                router.push({
                  name: 'tracks',
                  query: {
                    genre_id: genreId,
                    genre_name: genresStore.currentGenre.value?.name,
                  },
                })
              "
            />
          </template>
        </WidgetRow>
        <WidgetRow
          v-if="previewItems.artists.length"
          :widget-row="{
            title: $t('artists'),
            icon: 'mdi-account-music',
            items: previewItems.artists,
          }"
          :show-provider-on-cover="true"
        >
          <template #header-append>
            <v-btn
              variant="text"
              icon="mdi-account-outline"
              @click="
                router.push({
                  name: 'artists',
                  query: {
                    genre_id: genreId,
                    genre_name: genresStore.currentGenre.value?.name,
                  },
                })
              "
            />
          </template>
        </WidgetRow>
        <WidgetRow
          v-if="previewItems.albums.length"
          :widget-row="{
            title: $t('albums'),
            icon: 'mdi-album',
            items: previewItems.albums,
          }"
          :show-provider-on-cover="true"
        >
          <template #header-append>
            <v-btn
              variant="text"
              icon="mdi-album"
              @click="
                router.push({
                  name: 'albums',
                  query: {
                    genre_id: genreId,
                    genre_name: genresStore.currentGenre.value?.name,
                  },
                })
              "
            />
          </template>
        </WidgetRow>
        <WidgetRow
          v-if="previewItems.playlists.length"
          :widget-row="{
            title: $t('playlists'),
            icon: 'mdi-playlist-music',
            items: previewItems.playlists,
          }"
          :show-provider-on-cover="true"
        >
          <template #header-append>
            <v-btn
              variant="text"
              icon="mdi-playlist-play"
              @click="
                router.push({
                  name: 'playlists',
                  query: {
                    genre_id: genreId,
                    genre_name: genresStore.currentGenre.value?.name,
                  },
                })
              "
            />
          </template>
        </WidgetRow>
        <WidgetRow
          v-if="previewItems.podcasts.length"
          :widget-row="{
            title: $t('podcasts'),
            icon: 'mdi-podcast',
            items: previewItems.podcasts,
          }"
          :show-provider-on-cover="true"
        >
          <template #header-append>
            <v-btn
              variant="text"
              icon="mdi-podcast"
              @click="
                router.push({
                  name: 'podcasts',
                  query: {
                    genre_id: genreId,
                    genre_name: genresStore.currentGenre.value?.name,
                  },
                })
              "
            />
          </template>
        </WidgetRow>
        <WidgetRow
          v-if="previewItems.audiobooks.length"
          :widget-row="{
            title: $t('audiobooks'),
            icon: 'mdi-book-play-outline',
            items: previewItems.audiobooks,
          }"
          :show-provider-on-cover="true"
        >
          <template #header-append>
            <v-btn
              variant="text"
              icon="mdi-book-play-outline"
              @click="
                router.push({
                  name: 'audiobooks',
                  query: {
                    genre_id: genreId,
                    genre_name: genresStore.currentGenre.value?.name,
                  },
                })
              "
            />
          </template>
        </WidgetRow>
      </div>
    </div>

    <section style="margin-bottom: 10px">
      <Toolbar
        :title="$t('genres.linked_genres')"
        :menu-items="aliasToolbarMenuItems"
        @title-clicked="toggleAliasesExpand"
      />
      <v-divider />
      <Container v-if="aliasesExpanded">
        <v-list>
          <ListItem
            v-for="alias in genresStore.currentGenre.value.aliases"
            :key="alias"
          >
            <template #prepend>
              <v-icon icon="mdi-label" />
            </template>
            <template #title>
              {{ alias }}
            </template>
            <template #append>
              <div class="d-flex align-center ga-2">
                <v-btn
                  icon="mdi-call-split"
                  :title="$t('genres.split_linked_genre')"
                  @click="splitAlias(alias)"
                />
                <v-btn
                  icon="mdi-delete"
                  :title="$t('genres.remove_linked_genre')"
                  @click="removeAlias(alias)"
                />
              </div>
            </template>
          </ListItem>
        </v-list>
      </Container>
    </section>

    <v-dialog v-model="showAddAliasDialog" max-width="400">
      <v-card>
        <v-card-title>{{ $t("genres.create_or_link_genres") }}</v-card-title>
        <v-card-text>
          <v-combobox
            v-model="newAlias"
            v-model:search="searchInput"
            :items="items"
            :loading="genresStore.loading.value"
            item-title="name"
            item-value="item_id"
            :label="$t('genres.linked_genre_name')"
            return-object
            multiple
            chips
            closable-chips
            hide-selected
            clearable
            :placeholder="$t('genres.search_genres_or_type_new')"
            autofocus
            @keyup.enter="addAlias"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            color="grey"
            variant="text"
            @click="showAddAliasDialog = false"
            >{{ $t("cancel") }}</v-btn
          >
          <v-btn color="primary" @click="addAlias">{{
            $t("genres.add_linked_genre")
          }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
  <div
    v-else-if="genresStore.loading.value"
    class="d-flex justify-center align-center"
    style="height: 100%"
  >
    <v-progress-circular indeterminate color="primary" />
  </div>
</template>
