<!--
  Global dialog to create a new smart playlist from a set of rules.
  Supports two modes: Dynamic (auto-refreshes, saves rules) and Fixed (one-time generation).
  Visibility is controlled via the centralized eventbus.
-->
<template>
  <Dialog :key="dialogKey" v-model:open="showDialog">
    <DialogContent class="sm:max-w-[520px]">
      <DialogHeader>
        <DialogTitle class="mb-2">
          {{ $t("smart_playlist.create") }}
        </DialogTitle>
        <DialogDescription>
          {{ $t("smart_playlist.desc") }}
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-4 py-2">
        <!-- Playlist name -->
        <div class="flex flex-col gap-2">
          <Label for="sp-name">{{ $t("new_playlist_name") }}</Label>
          <Input
            id="sp-name"
            ref="nameInput"
            v-model="playlistName"
            @keyup.enter="doSave"
          />
        </div>

        <!-- Mode: Dynamic / Fixed -->
        <div class="flex flex-col gap-2">
          <Label>{{ $t("smart_playlist.mode") }}</Label>
          <RadioGroup v-model="mode" class="flex flex-row gap-6">
            <div class="flex items-center gap-2">
              <RadioGroupItem id="mode-dynamic" value="dynamic" />
              <Label for="mode-dynamic">{{ $t("smart_playlist.dynamic") }}</Label>
            </div>
            <div class="flex items-center gap-2">
              <RadioGroupItem id="mode-fixed" value="fixed" />
              <Label for="mode-fixed">{{ $t("smart_playlist.fixed") }}</Label>
            </div>
          </RadioGroup>
        </div>

        <!-- Track count (fixed mode only) -->
        <div v-if="mode === 'fixed'" class="flex flex-col gap-2">
          <Label for="sp-count">{{ $t("smart_playlist.track_count") }}</Label>
          <NumberField
            id="sp-count"
            v-model="trackCount"
            :min="1"
            :max="2000"
            class="max-w-[160px]"
          >
            <NumberFieldContent>
              <NumberFieldDecrement />
              <NumberFieldInput />
              <NumberFieldIncrement />
            </NumberFieldContent>
          </NumberField>
        </div>

        <Separator />

        <!-- Genre filter -->
        <div class="flex flex-col gap-2">
          <Label>{{ $t("genres") }}</Label>
          <div class="flex flex-wrap gap-1 items-center">
            <Badge
              v-for="gid in rules.genre_ids"
              :key="gid"
              variant="secondary"
              class="gap-1 pr-1"
            >
              {{ genreName(gid) }}
              <button type="button" class="ml-1 hover:opacity-70" @click.stop="toggleGenreById(gid)">
                <X class="h-3 w-3" />
              </button>
            </Badge>
            <Popover>
              <PopoverTrigger as-child>
                <Button variant="outline" size="sm" class="h-7 gap-1 border-dashed text-xs">
                  <PlusCircle class="h-3 w-3" />
                  {{ $t("genres") }}
                </Button>
              </PopoverTrigger>
              <PopoverContent class="w-[200px] p-2">
                <Input v-model="genreSearch" :placeholder="$t('search')" class="mb-2 h-7 text-sm" />
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
          </div>
        </div>

        <!-- Artist filter -->
        <div class="flex flex-col gap-2">
          <Label>{{ $t("artists") }}</Label>
          <div class="flex flex-wrap gap-1 items-center">
            <Badge
              v-for="a in selectedArtistItems"
              :key="a.id"
              variant="secondary"
              class="gap-1 pr-1"
            >
              {{ a.name }}
              <button type="button" class="ml-1 hover:opacity-70" @click.stop="toggleArtistById(a.id)">
                <X class="h-3 w-3" />
              </button>
            </Badge>
            <Popover>
              <PopoverTrigger as-child>
                <Button variant="outline" size="sm" class="h-7 gap-1 border-dashed text-xs">
                  <PlusCircle class="h-3 w-3" />
                  {{ $t("artists") }}
                </Button>
              </PopoverTrigger>
              <PopoverContent class="w-[200px] p-2">
                <Input v-model="artistSearch" :placeholder="$t('search')" class="mb-2 h-7 text-sm" />
                <div class="max-h-36 overflow-y-auto flex flex-col">
                  <div
                    v-for="artist in artistResults"
                    :key="artist.item_id"
                    class="flex items-center gap-2 py-0.5 cursor-pointer text-sm"
                    @click.stop="toggleArtistById(parseInt(artist.item_id), artist.name)"
                  >
                    <Checkbox
                      :checked="rules.artist_ids.includes(parseInt(artist.item_id))"
                      class="h-4 w-4 pointer-events-none"
                    />
                    <span class="truncate">{{ artist.name }}</span>
                  </div>
                  <p v-if="artistSearch.length < 2" class="text-xs text-muted-foreground py-1">
                    {{ $t("search") }}…
                  </p>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <!-- Album filter -->
        <div class="flex flex-col gap-2">
          <Label>{{ $t("albums") }}</Label>
          <div class="flex flex-wrap gap-1 items-center">
            <Badge
              v-for="a in selectedAlbumItems"
              :key="a.id"
              variant="secondary"
              class="gap-1 pr-1"
            >
              {{ a.name }}
              <button type="button" class="ml-1 hover:opacity-70" @click.stop="toggleAlbumById(a.id)">
                <X class="h-3 w-3" />
              </button>
            </Badge>
            <Popover>
              <PopoverTrigger as-child>
                <Button variant="outline" size="sm" class="h-7 gap-1 border-dashed text-xs">
                  <PlusCircle class="h-3 w-3" />
                  {{ $t("albums") }}
                </Button>
              </PopoverTrigger>
              <PopoverContent class="w-[200px] p-2">
                <Input v-model="albumSearch" :placeholder="$t('search')" class="mb-2 h-7 text-sm" />
                <div class="max-h-36 overflow-y-auto flex flex-col">
                  <div
                    v-for="album in albumResults"
                    :key="album.item_id"
                    class="flex items-center gap-2 py-0.5 cursor-pointer text-sm"
                    @click.stop="toggleAlbumById(parseInt(album.item_id), album.name)"
                  >
                    <Checkbox
                      :checked="rules.album_ids.includes(parseInt(album.item_id))"
                      class="h-4 w-4 pointer-events-none"
                    />
                    <span class="truncate">{{ album.name }}</span>
                  </div>
                  <p v-if="albumSearch.length < 2" class="text-xs text-muted-foreground py-1">
                    {{ $t("search") }}…
                  </p>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <!-- Favorites only -->
        <div class="flex items-center justify-between">
          <Label for="sp-fav" class="cursor-pointer">
            {{ $t("smart_playlist.favorites_only") }}
          </Label>
          <Switch id="sp-fav" v-model:checked="rules.favorites_only" />
        </div>

        <!-- Rule logic -->
        <div class="flex flex-col gap-2">
          <Label>{{ $t("smart_playlist.logic") }}</Label>
          <RadioGroup v-model="rules.logic" class="flex flex-row gap-6">
            <div class="flex items-center gap-2">
              <RadioGroupItem id="logic-and" value="AND" />
              <Label for="logic-and">{{ $t("smart_playlist.logic_and") }}</Label>
            </div>
            <div class="flex items-center gap-2">
              <RadioGroupItem id="logic-or" value="OR" />
              <Label for="logic-or">{{ $t("smart_playlist.logic_or") }}</Label>
            </div>
          </RadioGroup>
        </div>

        <!-- Min popularity -->
        <div class="flex flex-col gap-2">
          <Label>
            {{ $t("smart_playlist.min_popularity") }}
            <span v-if="rules.min_popularity !== undefined" class="ml-2 text-muted-foreground text-sm">
              {{ rules.min_popularity }}%
            </span>
            <span v-else class="ml-2 text-muted-foreground text-sm">
              {{ $t("smart_playlist.any") }}
            </span>
          </Label>
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

        <!-- Seed track URI -->
        <div class="flex flex-col gap-2">
          <Label for="sp-seed">{{ $t("smart_playlist.seed_track") }}</Label>
          <Input
            id="sp-seed"
            v-model="seedTrackUri"
            :placeholder="$t('smart_playlist.seed_track_placeholder')"
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="showDialog = false">
          {{ $t("close") }}
        </Button>
        <Button :disabled="!playlistName || isSaving" @click="doSave">
          <span v-if="isSaving">{{ $t("smart_playlist.creating") }}</span>
          <span v-else>{{ $t("settings.save") }}</span>
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { toast } from "vue-sonner";
import { PlusCircle, X } from "lucide-vue-next";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NumberField,
  NumberFieldContent,
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@/components/ui/number-field";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import api from "@/plugins/api";
import type { Album, Artist, Genre, SmartPlaylistRules } from "@/plugins/api/interfaces";
import { type CreateSmartPlaylistEvent, eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import router from "@/plugins/router";
import { store } from "@/plugins/store";

const showDialog = ref(false);
const dialogKey = ref(0);
const playlistName = ref("");
const mode = ref<"dynamic" | "fixed">("dynamic");
const trackCount = ref(100);
const isSaving = ref(false);
const nameInput = ref();
const seedTrackUri = ref("");

// Genre / artist / album picker state
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
const albumSearch = ref("");
const albumResults = ref<Album[]>([]);
const selectedArtistItems = ref<{ id: number; name: string }[]>([]);
const selectedAlbumItems = ref<{ id: number; name: string }[]>([]);

const rules = reactive<SmartPlaylistRules>({
  genre_ids: [],
  artist_ids: [],
  album_ids: [],
  favorites_only: false,
  seed_track_uri: undefined,
  min_popularity: undefined,
  logic: "AND",
  limit: 100,
});

watch(showDialog, (open) => {
  store.dialogActive = open;
  if (open) {
    nextTick(() => {
      nameInput.value?.focus?.();
    });
  }
});

function resetState() {
  playlistName.value = "";
  mode.value = "dynamic";
  trackCount.value = 100;
  isSaving.value = false;
  seedTrackUri.value = "";
  genreSearch.value = "";
  artistSearch.value = "";
  albumSearch.value = "";
  artistResults.value = [];
  albumResults.value = [];
  selectedArtistItems.value = [];
  selectedAlbumItems.value = [];
  rules.genre_ids = [];
  rules.artist_ids = [];
  rules.album_ids = [];
  rules.favorites_only = false;
  rules.seed_track_uri = undefined;
  rules.min_popularity = undefined;
  rules.logic = "AND";
  rules.limit = 100;
}

function genreName(id: number): string {
  return genres.value.find((g) => parseInt(g.item_id) === id)?.name ?? String(id);
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
    selectedArtistItems.value = selectedArtistItems.value.filter((a) => a.id !== id);
  } else if (name !== undefined) {
    rules.artist_ids.push(id);
    selectedArtistItems.value.push({ id, name });
  }
}

function toggleAlbumById(id: number, name?: string) {
  const idx = rules.album_ids.indexOf(id);
  if (idx >= 0) {
    rules.album_ids.splice(idx, 1);
    selectedAlbumItems.value = selectedAlbumItems.value.filter((a) => a.id !== id);
  } else if (name !== undefined) {
    rules.album_ids.push(id);
    selectedAlbumItems.value.push({ id, name });
  }
}

watch(artistSearch, async (q) => {
  if (q.length >= 2) {
    const result = await api.getLibraryArtists(undefined, q, 20);
    if (artistSearch.value === q) artistResults.value = result;
  } else {
    artistResults.value = [];
  }
});

watch(albumSearch, async (q) => {
  if (q.length >= 2) {
    const result = await api.getLibraryAlbums(undefined, q, 20);
    if (albumSearch.value === q) albumResults.value = result;
  } else {
    albumResults.value = [];
  }
});

function onPopularityInput(e: Event) {
  const v = parseInt((e.target as HTMLInputElement).value, 10);
  rules.min_popularity = v === 0 ? undefined : v;
}

async function doSave() {
  if (!playlistName.value || isSaving.value) return;
  isSaving.value = true;
  try {
    const genreNamesMap: Record<number, string> = {};
    for (const id of rules.genre_ids) {
      const found = genres.value.find((g) => parseInt(g.item_id) === id);
      if (found) genreNamesMap[id] = found.name;
    }
    const finalRules: SmartPlaylistRules = {
      ...rules,
      seed_track_uri: seedTrackUri.value || undefined,
      genre_names: genreNamesMap,
    };
    if (mode.value === "dynamic") {
      const playlist = await api.createSmartPlaylist(playlistName.value, finalRules, true);
      toast.success($t("smart_playlist.created"));
      showDialog.value = false;
      router.push({
        name: "playlist",
        params: { itemId: playlist.item_id, provider: "library" },
      });
    } else {
      const playlist = await api.generateSmartPlaylist(
        playlistName.value,
        finalRules,
        trackCount.value,
      );
      toast.success($t("playlist_created"));
      showDialog.value = false;
      router.push({
        name: "playlist",
        params: { itemId: playlist.item_id, provider: "library" },
      });
    }
  } catch (e) {
    toast.error(String(e));
  } finally {
    isSaving.value = false;
  }
}

onMounted(async () => {
  genres.value = await api.getLibraryGenres({ hide_empty: false });
  eventbus.on("createSmartPlaylist", (evt: CreateSmartPlaylistEvent) => {
    resetState();
    dialogKey.value++;
    showDialog.value = true;
  });
});

onBeforeUnmount(() => {
  eventbus.off("createSmartPlaylist");
});
</script>
