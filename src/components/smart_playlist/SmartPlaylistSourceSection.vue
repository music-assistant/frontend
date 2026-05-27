<template>
  <AccordionItem value="source">
    <AccordionTrigger>
      <span class="flex items-center gap-2">
        {{ $t("smart_playlist.section_source") }}
        <span
          v-if="rules.genre_ids.length || !!selectedSeedTrack"
          class="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0"
        ></span>
      </span>
    </AccordionTrigger>
    <AccordionContent>
      <div class="flex flex-col gap-4 px-1">
        <SmartPlaylistTagSelect
          v-model="genreItems"
          v-model:search-query="genreSearch"
          :label="$t('genres')"
          :add-label="$t('genres')"
          :results="filteredGenres"
          @toggle="(id) => toggleGenreById(id)"
        />

        <SmartPlaylistTagSelect
          v-model="excludedGenreItems"
          v-model:search-query="excludedGenreSearch"
          :label="$t('smart_playlist.excluded_genres')"
          :add-label="$t('genres')"
          :results="filteredExcludedGenres"
          @toggle="(id) => toggleExcludedGenreById(id)"
        />

        <SmartPlaylistSeedPicker
          :label="$t('smart_playlist.seed_track')"
          :tooltip="$t('smart_playlist.seed_track_tooltip')"
          :pick-label="$t('smart_playlist.seed_track_pick')"
          :disabled="
            _similarTrackProviderIds.length === 0 || !!selectedSeedArtist
          "
          :selected-item="selectedSeedTrack"
          :search-query="seedTrackSearch"
          :results="seedTrackResults"
          :is-searching="isSeedSearching"
          @update:search-query="seedTrackSearch = $event"
          @select="selectSeedTrack($event as Track)"
          @clear="clearSeedTrack()"
        >
          <template #item-sub="{ item }">
            <span class="truncate text-xs text-muted-foreground">
              {{ (item as Track).artists[0]?.name }}
            </span>
          </template>
        </SmartPlaylistSeedPicker>

        <SmartPlaylistSeedPicker
          :label="$t('smart_playlist.seed_artist')"
          :tooltip="$t('smart_playlist.seed_artist_tooltip')"
          :pick-label="$t('smart_playlist.seed_artist_pick')"
          :disabled="
            _similarArtistProviderIds.length === 0 || !!selectedSeedTrack
          "
          :selected-item="selectedSeedArtist"
          :search-query="seedArtistSearch"
          :results="seedArtistResults"
          :is-searching="isSeedArtistSearching"
          @update:search-query="seedArtistSearch = $event"
          @select="selectSeedArtist($event as Artist)"
          @clear="clearSeedArtist()"
        >
          <template #after-tags>
            <div v-if="selectedSeedArtist" class="flex items-center gap-2 pt-1">
              <Checkbox
                id="seed-artist-library-only"
                :checked="rules.seed_artist_library_only"
                @update:checked="rules.seed_artist_library_only = $event"
              />
              <label
                for="seed-artist-library-only"
                class="text-xs text-muted-foreground cursor-pointer select-none"
              >
                {{ $t("smart_playlist.seed_artist_library_only") }}
              </label>
            </div>
          </template>
        </SmartPlaylistSeedPicker>
      </div>
    </AccordionContent>
  </AccordionItem>
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import type { Artist, Track } from "@/plugins/api/interfaces";
import type { SmartPlaylistRulesFormContext } from "@/composables/useSmartPlaylistRulesForm";
import SmartPlaylistTagSelect from "@/components/smart_playlist/SmartPlaylistTagSelect.vue";
import SmartPlaylistSeedPicker from "@/components/smart_playlist/SmartPlaylistSeedPicker.vue";

const props = defineProps<{ form: SmartPlaylistRulesFormContext }>();

const {
  rules,
  genreSearch,
  excludedGenreSearch,
  filteredGenres,
  filteredExcludedGenres,
  genreName,
  toggleGenreById,
  toggleExcludedGenreById,
  selectedSeedTrack,
  selectedSeedArtist,
  clearSeedTrack,
  clearSeedArtist,
  _similarTrackProviderIds,
  _similarArtistProviderIds,
  seedTrackSearch,
  seedTrackResults,
  isSeedSearching,
  selectSeedTrack,
  seedArtistSearch,
  seedArtistResults,
  isSeedArtistSearching,
  selectSeedArtist,
} = props.form;

const genreItems = computed({
  get: () => rules.genre_ids.map((id) => ({ id, name: genreName(id) })),
  set: (items: { id: number; name: string }[]) => {
    rules.genre_ids = items.map((i) => i.id);
  },
});

const excludedGenreItems = computed({
  get: () =>
    (rules.excluded_genre_ids ?? []).map((id) => ({ id, name: genreName(id) })),
  set: (items: { id: number; name: string }[]) => {
    rules.excluded_genre_ids = items.map((i) => i.id);
  },
});
</script>
