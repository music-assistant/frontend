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

        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-1">
            <Label>{{ $t("smart_playlist.seed_track") }}</Label>
            <Tooltip>
              <TooltipTrigger as-child>
                <span class="cursor-help inline-flex">
                  <HelpCircle class="h-3.5 w-3.5 text-muted-foreground" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" class="max-w-[220px] z-[10001]">
                {{ $t("smart_playlist.seed_track_tooltip") }}
              </TooltipContent>
            </Tooltip>
          </div>
          <TagsInput
            :model-value="selectedSeedTrack ? [selectedSeedTrack.item_id] : []"
            @update:model-value="() => clearSeedTrack()"
          >
            <TagsInputItem
              v-if="selectedSeedTrack"
              :value="selectedSeedTrack.item_id"
            >
              <span class="py-0.5 px-2 text-sm truncate max-w-[180px] block">{{
                selectedSeedTrack.name
              }}</span>
              <TagsInputItemDelete />
            </TagsInputItem>
            <Popover v-if="!selectedSeedTrack">
              <PopoverTrigger as-child>
                <Button
                  variant="outline"
                  size="sm"
                  :disabled="
                    _similarTrackProviderIds.length === 0 ||
                    !!selectedSeedArtist
                  "
                  class="h-7 gap-1 border-dashed text-xs"
                >
                  <PlusCircle class="h-3 w-3" />
                  {{ $t("smart_playlist.seed_track_pick") }}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" class="w-[260px] p-2">
                <Input
                  v-model="seedTrackSearch"
                  :placeholder="$t('search')"
                  class="mb-2 h-7 text-sm"
                  @keydown.stop
                />
                <div class="max-h-48 overflow-y-auto flex flex-col">
                  <div v-if="isSeedSearching" class="flex justify-center py-2">
                    <Loader2
                      class="h-4 w-4 animate-spin text-muted-foreground"
                    />
                  </div>
                  <div
                    v-for="track in seedTrackResults"
                    :key="track.item_id"
                    class="flex flex-col py-0.5 px-1 cursor-pointer text-sm hover:bg-accent rounded-sm"
                    @click.stop="selectSeedTrack(track)"
                  >
                    <span class="truncate font-medium">{{ track.name }}</span>
                    <span class="truncate text-xs text-muted-foreground">
                      {{ track.artists[0]?.name }}
                    </span>
                  </div>
                  <p
                    v-if="seedTrackSearch.length < 2"
                    class="text-xs text-muted-foreground py-1 px-1"
                  >
                    {{ $t("search") }}...
                  </p>
                  <p
                    v-else-if="seedTrackResults.length === 0"
                    class="text-xs text-muted-foreground py-1 px-1"
                  >
                    {{ $t("no_results") }}
                  </p>
                </div>
              </PopoverContent>
            </Popover>
          </TagsInput>
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-1">
            <Label>{{ $t("smart_playlist.seed_artist") }}</Label>
            <Tooltip>
              <TooltipTrigger as-child>
                <span class="cursor-help inline-flex">
                  <HelpCircle class="h-3.5 w-3.5 text-muted-foreground" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" class="max-w-[220px] z-[10001]">
                {{ $t("smart_playlist.seed_artist_tooltip") }}
              </TooltipContent>
            </Tooltip>
          </div>
          <TagsInput
            :model-value="
              selectedSeedArtist ? [selectedSeedArtist.item_id] : []
            "
            @update:model-value="() => clearSeedArtist()"
          >
            <TagsInputItem
              v-if="selectedSeedArtist"
              :value="selectedSeedArtist.item_id"
              class="max-w-[240px]"
            >
              <span class="py-0.5 pl-2 text-sm">{{
                selectedSeedArtist.name
              }}</span>
              <TagsInputItemDelete />
            </TagsInputItem>
            <Popover v-if="!selectedSeedArtist">
              <PopoverTrigger as-child>
                <Button
                  variant="outline"
                  size="sm"
                  :disabled="
                    _similarArtistProviderIds.length === 0 ||
                    !!selectedSeedTrack
                  "
                  class="h-7 gap-1 border-dashed text-xs"
                >
                  <PlusCircle class="h-3 w-3" />
                  {{ $t("smart_playlist.seed_artist_pick") }}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" class="w-[260px] p-2">
                <Input
                  v-model="seedArtistSearch"
                  :placeholder="$t('search')"
                  class="mb-2 h-7 text-sm"
                  @keydown.stop
                />
                <div class="max-h-48 overflow-y-auto flex flex-col">
                  <div
                    v-if="isSeedArtistSearching"
                    class="flex justify-center py-2"
                  >
                    <Loader2
                      class="h-4 w-4 animate-spin text-muted-foreground"
                    />
                  </div>
                  <div
                    v-for="artist in seedArtistResults"
                    :key="artist.item_id"
                    class="flex flex-col py-0.5 px-1 cursor-pointer text-sm hover:bg-accent rounded-sm"
                    @click.stop="selectSeedArtist(artist)"
                  >
                    <span class="truncate font-medium">{{ artist.name }}</span>
                  </div>
                  <p
                    v-if="seedArtistSearch.length < 2"
                    class="text-xs text-muted-foreground py-1 px-1"
                  >
                    {{ $t("search") }}...
                  </p>
                  <p
                    v-else-if="seedArtistResults.length === 0"
                    class="text-xs text-muted-foreground py-1 px-1"
                  >
                    {{ $t("no_results") }}
                  </p>
                </div>
              </PopoverContent>
            </Popover>
          </TagsInput>
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
        </div>
      </div>
    </AccordionContent>
  </AccordionItem>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { HelpCircle, Loader2, PlusCircle } from "lucide-vue-next";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  TagsInput,
  TagsInputItem,
  TagsInputItemDelete,
} from "@/components/ui/tags-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SmartPlaylistRulesFormContext } from "@/composables/useSmartPlaylistRulesForm";
import SmartPlaylistTagSelect from "@/components/smart_playlist/SmartPlaylistTagSelect.vue";

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
