<!--
  Dialog to edit the rules of an existing dynamic smart playlist.
-->
<template>
  <Dialog v-model:open="showDialog">
    <DialogContent class="sm:max-w-[520px]">
      <DialogHeader>
        <DialogTitle class="mb-2">
          {{ $t("smart_playlist.edit_rules") }}
        </DialogTitle>
        <DialogDescription>
          {{ playlistName }}
        </DialogDescription>
      </DialogHeader>

      <div v-if="loading" class="py-8 text-center text-muted-foreground text-sm">
        {{ $t("loading") }}
      </div>

      <div v-else class="flex flex-col gap-4 py-2">
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
          <Label for="esp-fav" class="cursor-pointer">
            {{ $t("smart_playlist.favorites_only") }}
          </Label>
          <Switch id="esp-fav" v-model:checked="rules.favorites_only" />
        </div>

        <!-- Rule logic -->
        <div class="flex flex-col gap-2">
          <Label>{{ $t("smart_playlist.logic") }}</Label>
          <RadioGroup v-model="rules.logic" class="flex flex-row gap-6">
            <div class="flex items-center gap-2">
              <RadioGroupItem id="esp-logic-and" value="AND" />
              <Label for="esp-logic-and">{{ $t("smart_playlist.logic_and") }}</Label>
            </div>
            <div class="flex items-center gap-2">
              <RadioGroupItem id="esp-logic-or" value="OR" />
              <Label for="esp-logic-or">{{ $t("smart_playlist.logic_or") }}</Label>
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
          <Label for="esp-seed">{{ $t("smart_playlist.seed_track") }}</Label>
          <Input
            id="esp-seed"
            v-model="seedTrackUri"
            :placeholder="$t('smart_playlist.seed_track_placeholder')"
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="showDialog = false">
          {{ $t("close") }}
        </Button>
        <Button :disabled="loading || isSaving" @click="doSave">
          <span v-if="isSaving">{{ $t("smart_playlist.saving") }}</span>
          <span v-else>{{ $t("settings.save") }}</span>
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import api from "@/plugins/api";
import type { Album, Artist, Genre, SmartPlaylistRules } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";

export interface Props {
  dbPlaylistId: string;
  playlistName: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{ (e: "saved"): void }>();

const showDialog = defineModel<boolean>("open", { default: false });

const loading = ref(false);
const isSaving = ref(false);
const seedTrackUri = ref("");

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

watch(showDialog, async (open) => {
  if (open) {
    loading.value = true;
    genreSearch.value = "";
    artistSearch.value = "";
    albumSearch.value = "";
    artistResults.value = [];
    albumResults.value = [];
    selectedArtistItems.value = [];
    selectedAlbumItems.value = [];

    const [loadedRules, loadedGenres] = await Promise.all([
      api.getSmartPlaylistRules(props.dbPlaylistId),
      api.getLibraryGenres({ hide_empty: false }),
    ]);
    genres.value = loadedGenres;

    if (loadedRules) {
      rules.genre_ids = [...loadedRules.genre_ids];
      rules.artist_ids = [...loadedRules.artist_ids];
      rules.album_ids = [...loadedRules.album_ids];
      rules.favorites_only = loadedRules.favorites_only;
      rules.seed_track_uri = loadedRules.seed_track_uri;
      rules.min_popularity = loadedRules.min_popularity;
      rules.logic = loadedRules.logic;
      rules.limit = loadedRules.limit;
      seedTrackUri.value = loadedRules.seed_track_uri ?? "";

      // Restore artist names
      await Promise.all(
        loadedRules.artist_ids.map(async (id) => {
          try {
            const artist = await api.getArtist(String(id), "library");
            selectedArtistItems.value.push({ id, name: artist.name });
          } catch {
            selectedArtistItems.value.push({ id, name: String(id) });
          }
        }),
      );
      // Restore album names
      await Promise.all(
        loadedRules.album_ids.map(async (id) => {
          try {
            const album = await api.getAlbum(String(id), "library");
            selectedAlbumItems.value.push({ id, name: album.name });
          } catch {
            selectedAlbumItems.value.push({ id, name: String(id) });
          }
        }),
      );
    }
    loading.value = false;
  }
});

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
  if (isSaving.value) return;
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
    await api.updateSmartPlaylistRules(props.dbPlaylistId, finalRules);
    toast.success($t("settings.save"));
    showDialog.value = false;
    emit("saved");
  } catch (e) {
    toast.error(String(e));
  } finally {
    isSaving.value = false;
  }
}
</script>
