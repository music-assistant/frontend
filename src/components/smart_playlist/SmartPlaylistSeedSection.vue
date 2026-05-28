<template>
  <div class="flex flex-col gap-3">
    <Label
      :class="
        invalid ? 'text-sm font-medium text-destructive' : 'text-sm font-medium'
      "
    >
      {{ $t("smart_playlist.seed_heading") }}
    </Label>
    <SmartPlaylistSeedPicker
      :kind="seedKind"
      :selected-item="selectedItem"
      :search-query="searchQuery"
      :results="results"
      :is-searching="isSearching"
      :has-provider="hasProvider"
      :subtitle="subtitle"
      :invalid="invalid && !selectedItem"
      @update:kind="onChangeKind"
      @update:search-query="onSearchUpdate"
      @select="onSelect"
      @clear="onClear"
    >
      <template #item-sub="{ item }">
        <span
          v-if="seedKind === 'track'"
          class="truncate text-xs text-muted-foreground"
        >
          {{ ((item as Track).artists as Artist[])?.[0]?.name ?? "" }}
        </span>
      </template>
    </SmartPlaylistSeedPicker>
  </div>
</template>

<script setup lang="ts">
import { Label } from "@/components/ui/label";
import type { useSmartPlaylistSeedItems } from "@/composables/useSmartPlaylistSeedItems";
import type { Artist, Track } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { computed, toRef } from "vue";
import SmartPlaylistSeedPicker from "./SmartPlaylistSeedPicker.vue";

interface SearchItem {
  item_id: string;
  name: string;
}

const props = defineProps<{
  seedItems: ReturnType<typeof useSmartPlaylistSeedItems>;
  invalid?: boolean;
}>();

const seed = toRef(props, "seedItems");
const seedKindRef = computed(() => seed.value.seedKind);
const seedTrackSearchRef = computed(() => seed.value.seedTrackSearch);
const seedArtistSearchRef = computed(() => seed.value.seedArtistSearch);

const seedKind = computed(() => seedKindRef.value.value);

const selectedItem = computed<SearchItem | null>(() => {
  if (seedKind.value === "track") {
    const t = seed.value.selectedSeedTrack.value;
    return t ? { item_id: t.item_id, name: t.name } : null;
  }
  const a = seed.value.selectedSeedArtist.value;
  return a ? { item_id: a.item_id, name: a.name } : null;
});

const subtitle = computed(() => {
  if (seedKind.value === "track") {
    const t = seed.value.selectedSeedTrack.value;
    return t ? ((t.artists as Artist[])?.[0]?.name ?? "") : "";
  }
  return "";
});

const searchQuery = computed(() =>
  seedKind.value === "track"
    ? seedTrackSearchRef.value.value
    : seedArtistSearchRef.value.value,
);

const results = computed<SearchItem[]>(() =>
  seedKind.value === "track"
    ? seed.value.seedTrackResults.value
    : seed.value.seedArtistResults.value,
);

const isSearching = computed(() =>
  seedKind.value === "track"
    ? seed.value.isSeedTrackSearching.value
    : seed.value.isSeedArtistSearching.value,
);

const hasProvider = computed(() =>
  seedKind.value === "track"
    ? seed.value.hasTrackProvider.value
    : seed.value.hasArtistProvider.value,
);

function onChangeKind(kind: "track" | "artist") {
  seedKindRef.value.value = kind;
  if (kind === "track") {
    seed.value.clearSeedArtist();
  } else {
    seed.value.clearSeedTrack();
  }
}

function onSearchUpdate(q: string) {
  if (seedKind.value === "track") {
    seedTrackSearchRef.value.value = q;
  } else {
    seedArtistSearchRef.value.value = q;
  }
}

function onSelect(item: SearchItem) {
  if (seedKind.value === "track") {
    seed.value.selectSeedTrack(item as Track);
  } else {
    seed.value.selectSeedArtist(item as Artist);
  }
}

function onClear() {
  if (seedKind.value === "track") {
    seed.value.clearSeedTrack();
  } else {
    seed.value.clearSeedArtist();
  }
}
</script>
