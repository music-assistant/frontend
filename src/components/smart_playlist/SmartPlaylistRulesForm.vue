<!--
  Shared rules form used by both CreateSmartPlaylistDialog and EditSmartPlaylistDialog.
  Manages all filter state internally and exposes getFinalRules() for the parent to call on save.
-->
<template>
  <div class="flex flex-col gap-4">
    <!-- Rule logic -->
    <div class="flex flex-col gap-2">
      <div class="flex items-center gap-1">
        <Label>{{ $t("smart_playlist.logic") }}</Label>
        <Popover>
          <PopoverTrigger as-child>
            <button type="button" class="cursor-help">
              <HelpCircle class="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent class="max-w-[220px] text-sm p-3">
            {{ $t("smart_playlist.logic_tooltip") }}
          </PopoverContent>
        </Popover>
      </div>
      <RadioGroup v-model="rules.logic" class="flex flex-row gap-6">
        <div class="flex items-center gap-2">
          <RadioGroupItem id="srf-logic-and" value="AND" />
          <Label for="srf-logic-and">{{
            $t("smart_playlist.logic_and")
          }}</Label>
        </div>
        <div class="flex items-center gap-2">
          <RadioGroupItem id="srf-logic-or" value="OR" />
          <Label for="srf-logic-or">{{ $t("smart_playlist.logic_or") }}</Label>
        </div>
      </RadioGroup>
    </div>

    <!-- Genre filter -->
    <div class="flex flex-col gap-2">
      <Label>{{ $t("genres") }}</Label>
      <TagsInput v-model="genreModelValue">
        <TagsInputItem
          v-for="gid in rules.genre_ids"
          :key="gid"
          :value="String(gid)"
        >
          <span class="py-0.5 px-2 text-sm">{{ genreName(gid) }}</span>
          <TagsInputItemDelete />
        </TagsInputItem>
        <Popover>
          <PopoverTrigger as-child>
            <Button
              variant="outline"
              size="sm"
              class="h-7 gap-1 border-dashed text-xs"
            >
              <PlusCircle class="h-3 w-3" />
              {{ $t("genres") }}
            </Button>
          </PopoverTrigger>
          <PopoverContent class="w-[200px] p-2">
            <Input
              v-model="genreSearch"
              :placeholder="$t('search')"
              class="mb-2 h-7 text-sm"
              @keydown.stop
            />
            <div class="max-h-36 overflow-y-auto flex flex-col">
              <div
                v-for="genre in filteredGenres"
                :key="genre.item_id"
                class="flex items-center gap-2 py-0.5 cursor-pointer text-sm"
                @click.stop="toggleGenreById(parseInt(genre.item_id))"
              >
                <Checkbox
                  :checked="rules.genre_ids.includes(parseInt(genre.item_id))"
                  class="h-4 w-4 pointer-events-none"
                />
                <span class="truncate">{{ genre.name }}</span>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </TagsInput>
    </div>

    <!-- Seed track (search picker) -->
    <div class="flex flex-col gap-2">
      <div class="flex items-center gap-1">
        <Label>{{ $t("smart_playlist.seed_track") }}</Label>
        <Popover>
          <PopoverTrigger as-child>
            <button type="button" class="cursor-help">
              <HelpCircle class="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent class="max-w-[220px] text-sm p-3">
            {{ $t("smart_playlist.seed_track_tooltip") }}
          </PopoverContent>
        </Popover>
      </div>
      <TagsInput
        :model-value="selectedSeedTrack ? [selectedSeedTrack.item_id] : []"
        @update:model-value="() => clearSeedTrack()"
      >
        <TagsInputItem
          v-if="selectedSeedTrack"
          :value="selectedSeedTrack.item_id"
          class="max-w-[240px]"
        >
          <span class="py-0.5 pl-2 text-sm">
            {{ selectedSeedTrack.name }}
            <span class="text-muted-foreground text-xs ml-0.5">
              – {{ (selectedSeedTrack.artists as Artist[])[0]?.name }}
            </span>
          </span>
          <TagsInputItemDelete />
        </TagsInputItem>
        <Popover v-if="!selectedSeedTrack">
          <PopoverTrigger as-child>
            <Button
              variant="outline"
              size="sm"
              class="h-7 gap-1 border-dashed text-xs"
            >
              <PlusCircle class="h-3 w-3" />
              {{ $t("smart_playlist.seed_track_pick") }}
            </Button>
          </PopoverTrigger>
          <PopoverContent class="w-[260px] p-2">
            <Input
              v-model="seedTrackSearch"
              :placeholder="$t('search')"
              class="mb-2 h-7 text-sm"
              @keydown.stop
            />
            <div class="max-h-48 overflow-y-auto flex flex-col">
              <div v-if="isSeedSearching" class="flex justify-center py-2">
                <Loader2 class="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
              <div
                v-for="track in seedTrackResults"
                :key="track.item_id"
                class="flex flex-col py-0.5 px-1 cursor-pointer text-sm hover:bg-accent rounded-sm"
                @click.stop="selectSeedTrack(track)"
              >
                <span class="truncate font-medium">{{ track.name }}</span>
                <span class="truncate text-xs text-muted-foreground">
                  {{ (track.artists as Artist[])[0]?.name }}
                </span>
              </div>
              <p
                v-if="seedTrackSearch.length < 2"
                class="text-xs text-muted-foreground py-1 px-1"
              >
                {{ $t("search") }}…
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

    <!-- Artist filter -->
    <div class="flex flex-col gap-2">
      <Label>{{ $t("artists") }}</Label>
      <TagsInput v-model="artistModelValue">
        <TagsInputItem
          v-for="a in selectedArtistItems"
          :key="a.id"
          :value="String(a.id)"
        >
          <span class="py-0.5 px-2 text-sm">{{ a.name }}</span>
          <TagsInputItemDelete />
        </TagsInputItem>
        <Popover :open="selectedSeedTrack ? false : undefined">
          <PopoverTrigger as-child>
            <Button
              variant="outline"
              size="sm"
              :disabled="!!selectedSeedTrack"
              class="h-7 gap-1 border-dashed text-xs"
            >
              <PlusCircle class="h-3 w-3" />
              {{ $t("artists") }}
            </Button>
          </PopoverTrigger>
          <PopoverContent class="w-[200px] p-2">
            <Input
              v-model="artistSearch"
              :placeholder="$t('search')"
              class="mb-2 h-7 text-sm"
              @keydown.stop
            />
            <div class="max-h-36 overflow-y-auto flex flex-col">
              <div v-if="isArtistSearching" class="flex justify-center py-2">
                <Loader2 class="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
              <div
                v-for="artist in artistResults"
                :key="artist.item_id"
                class="flex items-center gap-2 py-0.5 cursor-pointer text-sm"
                @click.stop="
                  toggleArtistById(parseInt(artist.item_id), artist.name)
                "
              >
                <Checkbox
                  :checked="rules.artist_ids.includes(parseInt(artist.item_id))"
                  class="h-4 w-4 pointer-events-none"
                />
                <span class="truncate">{{ artist.name }}</span>
              </div>
              <p
                v-if="artistSearch.length < 2"
                class="text-xs text-muted-foreground py-1"
              >
                {{ $t("search") }}…
              </p>
            </div>
          </PopoverContent>
        </Popover>
      </TagsInput>
      <p v-if="selectedSeedTrack" class="text-xs text-muted-foreground">
        {{ $t("smart_playlist.seed_overrides_filter") }}
      </p>
    </div>

    <!-- Album filter -->
    <div class="flex flex-col gap-2">
      <Label>{{ $t("albums") }}</Label>
      <TagsInput v-model="albumModelValue">
        <TagsInputItem
          v-for="a in selectedAlbumItems"
          :key="a.id"
          :value="String(a.id)"
        >
          <span class="py-0.5 px-2 text-sm">{{ a.name }}</span>
          <TagsInputItemDelete />
        </TagsInputItem>
        <Popover :open="selectedSeedTrack ? false : undefined">
          <PopoverTrigger as-child>
            <Button
              variant="outline"
              size="sm"
              :disabled="!!selectedSeedTrack"
              class="h-7 gap-1 border-dashed text-xs"
            >
              <PlusCircle class="h-3 w-3" />
              {{ $t("albums") }}
            </Button>
          </PopoverTrigger>
          <PopoverContent class="w-[200px] p-2">
            <Input
              v-model="albumSearch"
              :placeholder="$t('search')"
              class="mb-2 h-7 text-sm"
              @keydown.stop
            />
            <div class="max-h-36 overflow-y-auto flex flex-col">
              <div v-if="isAlbumSearching" class="flex justify-center py-2">
                <Loader2 class="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
              <div
                v-for="album in albumResults"
                :key="album.item_id"
                class="flex items-center gap-2 py-0.5 cursor-pointer text-sm"
                @click.stop="
                  toggleAlbumById(parseInt(album.item_id), album.name)
                "
              >
                <Checkbox
                  :checked="rules.album_ids.includes(parseInt(album.item_id))"
                  class="h-4 w-4 pointer-events-none"
                />
                <span class="truncate">{{ album.name }}</span>
              </div>
              <p
                v-if="albumSearch.length < 2"
                class="text-xs text-muted-foreground py-1"
              >
                {{ $t("search") }}…
              </p>
            </div>
          </PopoverContent>
        </Popover>
      </TagsInput>
      <p v-if="selectedSeedTrack" class="text-xs text-muted-foreground">
        {{ $t("smart_playlist.seed_overrides_filter") }}
      </p>
    </div>

    <!-- Favorites only -->
    <div class="flex items-center justify-between">
      <Label for="srf-fav" class="cursor-pointer">
        {{ $t("smart_playlist.favorites_only") }}
      </Label>
      <Switch
        id="srf-fav"
        v-model="rules.favorites_only"
        @update:model-value="_updateTrackCount()"
      />
    </div>

    <!-- Min popularity -->
    <div class="flex flex-col gap-2">
      <div class="flex items-center gap-1">
        <Label>
          {{ $t("smart_playlist.min_popularity") }}
          <span
            v-if="rules.min_popularity !== undefined"
            class="ml-2 text-muted-foreground text-sm"
          >
            {{ rules.min_popularity }}%
          </span>
          <span v-else class="ml-2 text-muted-foreground text-sm">
            {{ $t("smart_playlist.any") }}
          </span>
        </Label>
        <Popover>
          <PopoverTrigger as-child>
            <button type="button" class="cursor-help">
              <HelpCircle class="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent class="max-w-[220px] text-sm p-3">
            {{ $t("smart_playlist.min_popularity_tooltip") }}
          </PopoverContent>
        </Popover>
      </div>
      <div class="flex items-center gap-3">
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          class="w-full"
          :value="rules.min_popularity ?? 0"
          @input="onPopularityInput"
        />
        <Button
          v-if="rules.min_popularity !== undefined"
          variant="ghost"
          size="sm"
          class="h-6 px-2 text-xs"
          @click="rules.min_popularity = undefined"
        >
          {{ $t("smart_playlist.clear") }}
        </Button>
      </div>
    </div>

    <!-- Year range -->
    <div class="flex flex-col gap-2">
      <Label>{{ $t("smart_playlist.year_range") }}</Label>
      <div class="flex items-center gap-2">
        <input
          id="srf-year-from"
          ref="yearFromEl"
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          :placeholder="$t('smart_playlist.year_from')"
          class="border-input w-28 h-8 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          @keydown.stop
          @blur="onYearFromInput"
          @keyup.enter="onYearFromInput"
        />
        <span class="text-muted-foreground text-sm">–</span>
        <input
          id="srf-year-to"
          ref="yearToEl"
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          :placeholder="$t('smart_playlist.year_to')"
          class="border-input w-28 h-8 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          @keydown.stop
          @blur="onYearToInput"
          @keyup.enter="onYearToInput"
        />
        <Button
          v-if="rules.year_from !== undefined || rules.year_to !== undefined"
          variant="ghost"
          size="sm"
          class="h-6 px-2 text-xs"
          @click="clearYear()"
        >
          {{ $t("smart_playlist.clear") }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";
import { useDebounceFn } from "@vueuse/core";
import { HelpCircle, Loader2, PlusCircle } from "lucide-vue-next";

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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";

import api from "@/plugins/api";
import type {
  Album,
  Artist,
  Genre,
  SmartPlaylistRules,
  Track,
} from "@/plugins/api/interfaces";
import {
  MediaType,
  ProviderFeature as ProviderFeatureEnum,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";

interface Props {
  initialRules?: SmartPlaylistRules | null;
  initialArtistItems?: { id: number; name: string }[];
  initialAlbumItems?: { id: number; name: string }[];
}

const props = withDefaults(defineProps<Props>(), {
  initialRules: null,
  initialArtistItems: () => [],
  initialAlbumItems: () => [],
});

const emit = defineEmits<{
  (e: "trackCountUpdate", count: number | null, counting: boolean): void;
}>();

const rules = reactive<SmartPlaylistRules>({
  genre_ids: [],
  artist_ids: [],
  album_ids: [],
  favorites_only: false,
  seed_track_uri: undefined,
  seed_track_name: undefined,
  min_popularity: undefined,
  logic: "AND",
  limit: 100,
  year_from: undefined,
  year_to: undefined,
});

const seedTrackUri = ref("");
const selectedSeedTrack = ref<Track | null>(null);
const seedTrackSearch = ref("");
const seedTrackResults = ref<Track[]>([]);
const yearFromEl = ref<HTMLInputElement | null>(null);
const yearToEl = ref<HTMLInputElement | null>(null);

const genres = ref<Genre[]>([]);
const genreSearch = ref("");
const filteredGenres = computed(() =>
  genreSearch.value
    ? genres.value.filter((g) =>
        g.name.toLowerCase().includes(genreSearch.value.toLowerCase()),
      )
    : genres.value,
);

const artistSearch = ref("");
const artistResults = ref<Artist[]>([]);
const isArtistSearching = ref(false);
const albumSearch = ref("");
const albumResults = ref<Album[]>([]);
const isAlbumSearching = ref(false);
const isSeedSearching = ref(false);
const selectedArtistItems = ref<{ id: number; name: string }[]>([]);
const selectedAlbumItems = ref<{ id: number; name: string }[]>([]);

const genreModelValue = computed({
  get: () => rules.genre_ids.map(String),
  set: (vals: string[]) => {
    rules.genre_ids = vals.map(Number);
  },
});

const artistModelValue = computed({
  get: () => selectedArtistItems.value.map((a) => String(a.id)),
  set: (vals: string[]) => {
    selectedArtistItems.value = selectedArtistItems.value.filter((a) =>
      vals.includes(String(a.id)),
    );
    rules.artist_ids = selectedArtistItems.value.map((a) => a.id);
  },
});

const albumModelValue = computed({
  get: () => selectedAlbumItems.value.map((a) => String(a.id)),
  set: (vals: string[]) => {
    selectedAlbumItems.value = selectedAlbumItems.value.filter((a) =>
      vals.includes(String(a.id)),
    );
    rules.album_ids = selectedAlbumItems.value.map((a) => a.id);
  },
});

watch(
  () => props.initialRules,
  async (initial) => {
    if (!initial) return;
    rules.genre_ids = [...initial.genre_ids];
    rules.artist_ids = [...initial.artist_ids];
    rules.album_ids = [...initial.album_ids];
    rules.favorites_only = initial.favorites_only;
    rules.seed_track_uri = initial.seed_track_uri;
    rules.seed_track_name = initial.seed_track_name;
    rules.min_popularity = initial.min_popularity;
    rules.logic = initial.logic;
    rules.limit = initial.limit;
    rules.year_from = initial.year_from;
    rules.year_to = initial.year_to;
    rules.genre_names = initial.genre_names ? { ...initial.genre_names } : undefined;
    rules.artist_names = initial.artist_names ? { ...initial.artist_names } : undefined;
    rules.album_names = initial.album_names ? { ...initial.album_names } : undefined;
    seedTrackUri.value = initial.seed_track_uri ?? "";
    selectedSeedTrack.value = null;
    if (initial.seed_track_uri) {
      try {
        const item = await api.getItemByUri(initial.seed_track_uri);
        if (item.media_type === MediaType.TRACK) {
          selectedSeedTrack.value = item as Track;
        }
      } catch {
        // URI not resolvable — leave selectedSeedTrack null
      }
    }
    await nextTick();
    if (yearFromEl.value)
      yearFromEl.value.value = initial.year_from
        ? String(initial.year_from)
        : "";
    if (yearToEl.value)
      yearToEl.value.value = initial.year_to ? String(initial.year_to) : "";
  },
  { immediate: true },
);

watch(
  () => props.initialArtistItems,
  (items) => {
    selectedArtistItems.value = [...items];
  },
  { immediate: true },
);

watch(
  () => props.initialAlbumItems,
  (items) => {
    selectedAlbumItems.value = [...items];
  },
  { immediate: true },
);

onMounted(async () => {
  genres.value = await api.getLibraryGenres({ hide_empty: false });
});

function genreName(id: number): string {
  return (
    genres.value.find((g) => parseInt(g.item_id) === id)?.name ??
    rules.genre_names?.[id] ??
    String(id)
  );
}

function toggleGenreById(id: number) {
  const idx = rules.genre_ids.indexOf(id);
  if (idx >= 0) {
    rules.genre_ids.splice(idx, 1);
  } else {
    rules.genre_ids.push(id);
  }
}

function toggleArtistById(id: number, name?: string) {
  const idx = rules.artist_ids.indexOf(id);
  if (idx >= 0) {
    rules.artist_ids.splice(idx, 1);
    selectedArtistItems.value = selectedArtistItems.value.filter(
      (a) => a.id !== id,
    );
  } else if (name !== undefined) {
    rules.artist_ids.push(id);
    selectedArtistItems.value.push({ id, name });
  }
}

function toggleAlbumById(id: number, name?: string) {
  const idx = rules.album_ids.indexOf(id);
  if (idx >= 0) {
    rules.album_ids.splice(idx, 1);
    selectedAlbumItems.value = selectedAlbumItems.value.filter(
      (a) => a.id !== id,
    );
  } else if (name !== undefined) {
    rules.album_ids.push(id);
    selectedAlbumItems.value.push({ id, name });
  }
}

const _updateTrackCount = useDebounceFn(async () => {
  emit("trackCountUpdate", null, true);
  try {
    const finalRules: SmartPlaylistRules = {
      ...rules,
      seed_track_uri: seedTrackUri.value || undefined,
    };
    const count = await api.countSmartPlaylistTracks(finalRules);
    emit("trackCountUpdate", count, false);
  } catch {
    emit("trackCountUpdate", null, false);
  }
}, 600);

watch(rules, () => {
  _updateTrackCount();
});

watch(seedTrackUri, () => {
  _updateTrackCount();
});

const _doArtistSearch = useDebounceFn(async (q: string) => {
  if (q.length >= 2) {
    isArtistSearching.value = true;
    try {
      const result = await api.getLibraryArtists(undefined, q, 20);
      if (artistSearch.value === q) artistResults.value = result;
    } finally {
      isArtistSearching.value = false;
    }
  } else {
    artistResults.value = [];
  }
}, 400);

watch(artistSearch, (q) => {
  if (q.length < 2) {
    artistResults.value = [];
    isArtistSearching.value = false;
  } else {
    isArtistSearching.value = true;
    _doArtistSearch(q);
  }
});

const _doAlbumSearch = useDebounceFn(async (q: string) => {
  if (q.length >= 2) {
    isAlbumSearching.value = true;
    try {
      const result = await api.getLibraryAlbums(undefined, q, 20);
      if (albumSearch.value === q) albumResults.value = result;
    } finally {
      isAlbumSearching.value = false;
    }
  } else {
    albumResults.value = [];
  }
}, 400);

watch(albumSearch, (q) => {
  if (q.length < 2) {
    albumResults.value = [];
    isAlbumSearching.value = false;
  } else {
    isAlbumSearching.value = true;
    _doAlbumSearch(q);
  }
});

const _similarTrackProviderIds = computed(() =>
  Object.values(api.providers)
    .filter((p) =>
      (p.supported_features as unknown as string[]).includes(
        ProviderFeatureEnum.SIMILAR_TRACKS,
      ),
    )
    .map((p) => p.instance_id),
);

const _doSeedSearch = useDebounceFn(async (q: string) => {
  const providerIds = _similarTrackProviderIds.value;
  if (q.length < 2 || providerIds.length === 0) {
    seedTrackResults.value = [];
    isSeedSearching.value = false;
    return;
  }
  try {
    const result = await api.search(q, [MediaType.TRACK], 20);
    if (seedTrackSearch.value !== q) return;
    seedTrackResults.value = result.tracks.filter((t) =>
      t.provider_mappings?.some((m) =>
        providerIds.includes(m.provider_instance),
      ),
    );
  } finally {
    if (seedTrackSearch.value === q) isSeedSearching.value = false;
  }
}, 400);

watch(seedTrackSearch, (q) => {
  if (q.length < 2) {
    seedTrackResults.value = [];
    isSeedSearching.value = false;
  } else {
    isSeedSearching.value = true;
    _doSeedSearch(q);
  }
});

function selectSeedTrack(track: Track) {
  selectedSeedTrack.value = track;
  const mapping = track.provider_mappings?.find((m) =>
    _similarTrackProviderIds.value.includes(m.provider_instance),
  );
  seedTrackUri.value = mapping
    ? `${mapping.provider_domain}://track/${mapping.item_id}`
    : `library://track/${track.item_id}`;
  rules.seed_track_name = `${track.name} – ${(track.artists as Artist[])[0]?.name ?? ""}`;
  seedTrackSearch.value = "";
  seedTrackResults.value = [];
}

function clearSeedTrack() {
  selectedSeedTrack.value = null;
  seedTrackUri.value = "";
  rules.seed_track_name = undefined;
  seedTrackSearch.value = "";
  seedTrackResults.value = [];
}

function onPopularityInput(e: Event) {
  const v = parseInt((e.target as HTMLInputElement).value, 10);
  rules.min_popularity = v === 0 ? undefined : v;
}

function onYearFromInput() {
  const v = yearFromEl.value?.value.trim() ?? "";
  const n = parseInt(v);
  rules.year_from = v && !isNaN(n) ? n : undefined;
}

function onYearToInput() {
  const v = yearToEl.value?.value.trim() ?? "";
  const n = parseInt(v);
  rules.year_to = v && !isNaN(n) ? n : undefined;
}

function clearYear() {
  rules.year_from = undefined;
  rules.year_to = undefined;
  if (yearFromEl.value) yearFromEl.value.value = "";
  if (yearToEl.value) yearToEl.value.value = "";
}

function getFinalRules(): SmartPlaylistRules {
  onYearFromInput();
  onYearToInput();
  const genreNamesMap: Record<number, string> = {};
  for (const id of rules.genre_ids) {
    const found = genres.value.find((g) => parseInt(g.item_id) === id);
    if (found) genreNamesMap[id] = found.name;
  }
  const artistNamesMap: Record<number, string> = {};
  for (const item of selectedArtistItems.value) {
    artistNamesMap[item.id] = item.name;
  }
  const albumNamesMap: Record<number, string> = {};
  for (const item of selectedAlbumItems.value) {
    albumNamesMap[item.id] = item.name;
  }
  return {
    ...rules,
    seed_track_uri: seedTrackUri.value || undefined,
    seed_track_name: selectedSeedTrack.value
      ? `${selectedSeedTrack.value.name} – ${(selectedSeedTrack.value.artists as Artist[])[0]?.name ?? ""}`
      : undefined,
    genre_names: genreNamesMap,
    artist_names: artistNamesMap,
    album_names: albumNamesMap,
  };
}

defineExpose({ getFinalRules });
</script>
