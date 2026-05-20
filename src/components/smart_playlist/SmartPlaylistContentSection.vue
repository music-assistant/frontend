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
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <Label>{{ $t("artists") }}</Label>
          <TagsInput v-model="artistModelValue">
            <TagsInputItem
              v-for="a in selectedArtistItems"
              :key="a.id"
              :value="String(a.id)"
              class="max-w-[240px]"
            >
              <span
                class="block max-w-[200px] truncate whitespace-nowrap py-0.5 px-2 text-sm"
                >{{ a.name }}</span
              >
              <TagsInputItemDelete />
            </TagsInputItem>
            <Popover
              :open="
                selectedSeedTrack || selectedSeedArtist ? false : undefined
              "
            >
              <PopoverTrigger as-child>
                <Button
                  variant="outline"
                  size="sm"
                  :disabled="!!selectedSeedTrack || !!selectedSeedArtist"
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
                  <div
                    v-if="isArtistSearching"
                    class="flex justify-center py-2"
                  >
                    <Loader2
                      class="h-4 w-4 animate-spin text-muted-foreground"
                    />
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
                      :checked="
                        rules.artist_ids.includes(parseInt(artist.item_id))
                      "
                      class="h-4 w-4 pointer-events-none"
                    />
                    <span class="truncate">{{ artist.name }}</span>
                  </div>
                  <p
                    v-if="artistSearch.length < 2"
                    class="text-xs text-muted-foreground py-1"
                  >
                    {{ $t("search") }}...
                  </p>
                </div>
              </PopoverContent>
            </Popover>
          </TagsInput>
          <p
            v-if="selectedSeedTrack || selectedSeedArtist"
            class="text-xs text-muted-foreground"
          >
            {{ $t("smart_playlist.seed_overrides_filter") }}
          </p>
        </div>

        <div class="flex flex-col gap-2">
          <Label>{{ $t("smart_playlist.excluded_artists") }}</Label>
          <TagsInput v-model="excludedArtistModelValue">
            <TagsInputItem
              v-for="a in selectedExcludedArtistItems"
              :key="a.id"
              :value="String(a.id)"
              class="max-w-[240px]"
            >
              <span
                class="block max-w-[200px] truncate whitespace-nowrap py-0.5 px-2 text-sm"
                >{{ a.name }}</span
              >
              <TagsInputItemDelete />
            </TagsInputItem>
            <Popover
              :open="
                selectedSeedTrack || selectedSeedArtist ? false : undefined
              "
            >
              <PopoverTrigger as-child>
                <Button
                  variant="outline"
                  size="sm"
                  :disabled="!!selectedSeedTrack || !!selectedSeedArtist"
                  class="h-7 gap-1 border-dashed text-xs"
                >
                  <PlusCircle class="h-3 w-3" />
                  {{ $t("artists") }}
                </Button>
              </PopoverTrigger>
              <PopoverContent class="w-[200px] p-2">
                <Input
                  v-model="excludedArtistSearch"
                  :placeholder="$t('search')"
                  class="mb-2 h-7 text-sm"
                  @keydown.stop
                />
                <div class="max-h-36 overflow-y-auto flex flex-col">
                  <div
                    v-if="isExcludedArtistSearching"
                    class="flex justify-center py-2"
                  >
                    <Loader2
                      class="h-4 w-4 animate-spin text-muted-foreground"
                    />
                  </div>
                  <div
                    v-for="artist in excludedArtistResults"
                    :key="artist.item_id"
                    class="flex items-center gap-2 py-0.5 cursor-pointer text-sm"
                    @click.stop="
                      toggleExcludedArtistById(
                        parseInt(artist.item_id),
                        artist.name,
                      )
                    "
                  >
                    <Checkbox
                      :checked="
                        (rules.excluded_artist_ids ?? []).includes(
                          parseInt(artist.item_id),
                        )
                      "
                      class="h-4 w-4 pointer-events-none"
                    />
                    <span class="truncate">{{ artist.name }}</span>
                  </div>
                  <p
                    v-if="excludedArtistSearch.length < 2"
                    class="text-xs text-muted-foreground py-1"
                  >
                    {{ $t("search") }}...
                  </p>
                </div>
              </PopoverContent>
            </Popover>
          </TagsInput>
          <p
            v-if="selectedSeedTrack || selectedSeedArtist"
            class="text-xs text-muted-foreground"
          >
            {{ $t("smart_playlist.seed_overrides_filter") }}
          </p>
        </div>

        <div class="flex flex-col gap-2">
          <Label>{{ $t("albums") }}</Label>
          <TagsInput v-model="albumModelValue">
            <TagsInputItem
              v-for="a in selectedAlbumItems"
              :key="a.id"
              :value="String(a.id)"
              class="max-w-[240px]"
            >
              <span
                class="block max-w-[200px] truncate whitespace-nowrap py-0.5 px-2 text-sm"
                >{{ a.name }}</span
              >
              <TagsInputItemDelete />
            </TagsInputItem>
            <Popover
              :open="
                selectedSeedTrack || selectedSeedArtist ? false : undefined
              "
            >
              <PopoverTrigger as-child>
                <Button
                  variant="outline"
                  size="sm"
                  :disabled="!!selectedSeedTrack || !!selectedSeedArtist"
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
                    <Loader2
                      class="h-4 w-4 animate-spin text-muted-foreground"
                    />
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
                      :checked="
                        rules.album_ids.includes(parseInt(album.item_id))
                      "
                      class="h-4 w-4 pointer-events-none"
                    />
                    <span class="truncate">{{ album.name }}</span>
                  </div>
                  <p
                    v-if="albumSearch.length < 2"
                    class="text-xs text-muted-foreground py-1"
                  >
                    {{ $t("search") }}...
                  </p>
                </div>
              </PopoverContent>
            </Popover>
          </TagsInput>
          <p
            v-if="selectedSeedTrack || selectedSeedArtist"
            class="text-xs text-muted-foreground"
          >
            {{ $t("smart_playlist.seed_overrides_filter") }}
          </p>
        </div>

        <div class="flex flex-col gap-2">
          <Label>{{ $t("smart_playlist.excluded_albums") }}</Label>
          <TagsInput v-model="excludedAlbumModelValue">
            <TagsInputItem
              v-for="a in selectedExcludedAlbumItems"
              :key="a.id"
              :value="String(a.id)"
              class="max-w-[240px]"
            >
              <span
                class="block max-w-[200px] truncate whitespace-nowrap py-0.5 px-2 text-sm"
                >{{ a.name }}</span
              >
              <TagsInputItemDelete />
            </TagsInputItem>
            <Popover
              :open="
                selectedSeedTrack || selectedSeedArtist ? false : undefined
              "
            >
              <PopoverTrigger as-child>
                <Button
                  variant="outline"
                  size="sm"
                  :disabled="!!selectedSeedTrack || !!selectedSeedArtist"
                  class="h-7 gap-1 border-dashed text-xs"
                >
                  <PlusCircle class="h-3 w-3" />
                  {{ $t("albums") }}
                </Button>
              </PopoverTrigger>
              <PopoverContent class="w-[200px] p-2">
                <Input
                  v-model="excludedAlbumSearch"
                  :placeholder="$t('search')"
                  class="mb-2 h-7 text-sm"
                  @keydown.stop
                />
                <div class="max-h-36 overflow-y-auto flex flex-col">
                  <div
                    v-if="isExcludedAlbumSearching"
                    class="flex justify-center py-2"
                  >
                    <Loader2
                      class="h-4 w-4 animate-spin text-muted-foreground"
                    />
                  </div>
                  <div
                    v-for="album in excludedAlbumResults"
                    :key="album.item_id"
                    class="flex items-center gap-2 py-0.5 cursor-pointer text-sm"
                    @click.stop="
                      toggleExcludedAlbumById(
                        parseInt(album.item_id),
                        album.name,
                      )
                    "
                  >
                    <Checkbox
                      :checked="
                        (rules.excluded_album_ids ?? []).includes(
                          parseInt(album.item_id),
                        )
                      "
                      class="h-4 w-4 pointer-events-none"
                    />
                    <span class="truncate">{{ album.name }}</span>
                  </div>
                  <p
                    v-if="excludedAlbumSearch.length < 2"
                    class="text-xs text-muted-foreground py-1"
                  >
                    {{ $t("search") }}...
                  </p>
                </div>
              </PopoverContent>
            </Popover>
          </TagsInput>
          <p
            v-if="selectedSeedTrack || selectedSeedArtist"
            class="text-xs text-muted-foreground"
          >
            {{ $t("smart_playlist.seed_overrides_filter") }}
          </p>
        </div>
      </div>
    </AccordionContent>
  </AccordionItem>
</template>

<script setup lang="ts">
import { Loader2, PlusCircle } from "lucide-vue-next";
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
import type { SmartPlaylistRulesFormContext } from "@/composables/useSmartPlaylistRulesForm";

const props = defineProps<{ form: SmartPlaylistRulesFormContext }>();

const {
  rules,
  artistModelValue,
  albumModelValue,
  excludedArtistModelValue,
  excludedAlbumModelValue,
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
