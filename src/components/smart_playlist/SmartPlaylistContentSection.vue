<template>
  <AccordionItem value="content">
    <AccordionTrigger>
      <span class="flex items-center gap-2">
        {{ $t("smart_playlist.section_content") }}
        <span
          v-if="rules.artist_ids.length || rules.album_ids.length"
          class="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0"
        ></span>
      </span>
    </AccordionTrigger>
    <AccordionContent>
      <div class="flex flex-col gap-4 px-1">
        <SmartPlaylistTagSelect
          v-model="selectedArtistItems"
          v-model:search-query="artistSearch"
          :label="$t('artists')"
          :add-label="$t('artists')"
          :results="
            filterByExcludedIds(
              artistResults,
              rules.excluded_artist_ids,
              rules.artist_ids,
            )
          "
          :is-searching="isArtistSearching"
          :disabled="!!selectedSeedTrack || !!selectedSeedArtist"
          :show-seed-override="!!(selectedSeedTrack || selectedSeedArtist)"
          :min-search-length="2"
          @toggle="toggleArtistById"
        />

        <SmartPlaylistTagSelect
          v-model="selectedExcludedArtistItems"
          v-model:search-query="excludedArtistSearch"
          :label="$t('smart_playlist.excluded_artists')"
          :add-label="$t('artists')"
          :results="
            filterByExcludedIds(
              excludedArtistResults,
              rules.artist_ids,
              rules.excluded_artist_ids,
            )
          "
          :is-searching="isExcludedArtistSearching"
          :disabled="!!selectedSeedTrack || !!selectedSeedArtist"
          :show-seed-override="!!(selectedSeedTrack || selectedSeedArtist)"
          :min-search-length="2"
          @toggle="toggleExcludedArtistById"
        />

        <SmartPlaylistTagSelect
          v-model="selectedAlbumItems"
          v-model:search-query="albumSearch"
          :label="$t('albums')"
          :add-label="$t('albums')"
          :results="
            filterByExcludedIds(
              albumResults,
              rules.excluded_album_ids,
              rules.album_ids,
            )
          "
          :is-searching="isAlbumSearching"
          :disabled="!!selectedSeedTrack || !!selectedSeedArtist"
          :show-seed-override="!!(selectedSeedTrack || selectedSeedArtist)"
          :min-search-length="2"
          @toggle="toggleAlbumById"
        />

        <SmartPlaylistTagSelect
          v-model="selectedExcludedAlbumItems"
          v-model:search-query="excludedAlbumSearch"
          :label="$t('smart_playlist.excluded_albums')"
          :add-label="$t('albums')"
          :results="
            filterByExcludedIds(
              excludedAlbumResults,
              rules.album_ids,
              rules.excluded_album_ids,
            )
          "
          :is-searching="isExcludedAlbumSearching"
          :disabled="!!selectedSeedTrack || !!selectedSeedArtist"
          :show-seed-override="!!(selectedSeedTrack || selectedSeedArtist)"
          :min-search-length="2"
          @toggle="toggleExcludedAlbumById"
        />
      </div>
    </AccordionContent>
  </AccordionItem>
</template>

<script setup lang="ts">
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { SmartPlaylistRulesFormContext } from "@/composables/useSmartPlaylistRulesForm";
import SmartPlaylistTagSelect from "@/components/smart_playlist/SmartPlaylistTagSelect.vue";

function filterByExcludedIds<T extends { item_id: string }>(
  results: T[],
  ...excludeIdArrays: (number[] | undefined)[]
): T[] {
  const allExcluded = excludeIdArrays.flatMap((ids) => ids ?? []);
  if (!allExcluded.length) return results;
  return results.filter(
    (item) => !allExcluded.includes(parseInt(item.item_id)),
  );
}

const props = defineProps<{ form: SmartPlaylistRulesFormContext }>();

const {
  rules,
  selectedArtistItems,
  selectedAlbumItems,
  selectedExcludedArtistItems,
  selectedExcludedAlbumItems,
  selectedSeedTrack,
  selectedSeedArtist,
  artistSearch,
  artistResults,
  isArtistSearching,
  albumSearch,
  albumResults,
  isAlbumSearching,
  excludedArtistSearch,
  excludedArtistResults,
  isExcludedArtistSearching,
  excludedAlbumSearch,
  excludedAlbumResults,
  isExcludedAlbumSearching,
  toggleArtistById,
  toggleAlbumById,
  toggleExcludedArtistById,
  toggleExcludedAlbumById,
} = props.form;
</script>
