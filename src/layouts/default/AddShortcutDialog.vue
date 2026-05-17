<!--
  Global dialog for adding a sidebar shortcut.
  Opened via eventbus 'addShortcut'. Shows all library items not yet pinned.
-->
<template>
  <Sheet v-model:open="show">
    <SheetContent side="bottom" class="h-[85vh] flex flex-col p-0">
      <SheetHeader class="flex-row items-center gap-3 border-b px-4 py-3">
        <Pin class="size-5 shrink-0 opacity-80" />
        <SheetTitle>{{ $t("add_shortcut") }}</SheetTitle>
      </SheetHeader>
      <SheetDescription class="sr-only">
        {{ $t("add_shortcut") }}
      </SheetDescription>

      <!-- Search bar -->
      <div class="flex items-center gap-2 border-b px-4 py-2">
        <Search class="size-4 shrink-0 opacity-50" />
        <input
          v-model="searchQuery"
          type="search"
          :placeholder="$t('search')"
          class="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          autofocus
        />
      </div>

      <!-- Media type filter chips -->
      <div class="flex flex-wrap gap-1.5 border-b px-4 py-2">
        <button
          v-for="type in FILTER_TYPES"
          :key="type ?? 'all'"
          type="button"
          :class="[
            'rounded-full border px-3 py-0.5 text-xs font-medium transition-colors',
            selectedType === type
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-transparent hover:bg-accent',
          ]"
          @click="selectedType = type"
        >
          {{ type ? $t(type + "s") : $t("searchtype_all") }}
        </button>
      </div>

      <ScrollArea class="h-full max-h-full overflow-hidden flex-1">
        <div class="pt-2 pb-8">
          <button
            v-for="item of availableItems"
            :key="item.uri"
            type="button"
            class="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent"
            @click="pinAndClose(item)"
          >
            <div class="shrink-0">
              <MediaItemThumb :item="item" :size="50" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-medium">
                {{ item.name }}
              </div>
              <div class="truncate text-xs text-muted-foreground">
                {{ $t(item.media_type) }}
              </div>
            </div>
            <provider-icon
              v-if="'provider_mappings' in item && item.provider_mappings"
              :domain="item.provider_mappings[0].provider_domain"
              :size="20"
              class="shrink-0"
            />
          </button>
        </div>
      </ScrollArea>
    </SheetContent>
  </Sheet>
</template>

<script setup lang="ts">
import MediaItemThumb from "@/components/MediaItemThumb.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import api from "@/plugins/api";
import {
  isShortcutPinned,
  pinShortcutStandalone,
  type ShortcutItem,
} from "@/composables/useShortcuts";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { MediaType } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { Pin, Search } from "lucide-vue-next";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

const FILTER_TYPES = [
  null,
  MediaType.PLAYLIST,
  MediaType.ARTIST,
  MediaType.ALBUM,
  MediaType.TRACK,
  MediaType.RADIO,
  MediaType.PODCAST,
  MediaType.AUDIOBOOK,
] as const;
type FilterType = (typeof FILTER_TYPES)[number];

const show = ref(false);
const allItems = ref<ShortcutItem[]>([]);
const searchQuery = ref("");
const selectedType = ref<FilterType>(null);

watch(show, (open) => {
  store.dialogActive = open;
  if (open) {
    searchQuery.value = "";
    selectedType.value = null;
  }
});

const availableItems = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  return allItems.value
    .filter((item) => !isShortcutPinned(item.uri))
    .filter(
      (item) => !selectedType.value || item.media_type === selectedType.value,
    )
    .filter((item) => !query || item.name.toLowerCase().includes(query));
});

const fetchItems = async () => {
  const [playlists, artists, albums, tracks, radios, podcasts, audiobooks] =
    await Promise.all([
      api.getLibraryPlaylists(),
      api.getLibraryArtists(),
      api.getLibraryAlbums(),
      api.getLibraryTracks(),
      api.getLibraryRadios(),
      api.getLibraryPodcasts(),
      api.getLibraryAudiobooks(),
    ]);
  // Sort all items by name
  allItems.value = [
    ...playlists,
    ...artists,
    ...albums,
    ...tracks,
    ...radios,
    ...podcasts,
    ...audiobooks,
  ].sort((a, b) => a.name.localeCompare(b.name));
};

const pinAndClose = async (item: ShortcutItem) => {
  show.value = false;
  await pinShortcutStandalone(item);
};

onMounted(() => {
  eventbus.on("addShortcut", () => {
    fetchItems();
    show.value = true;
  });
  onBeforeUnmount(() => {
    eventbus.off("addShortcut");
  });
});
</script>
