<template>
  <div class="flex flex-col gap-3">
    <div class="flex items-baseline justify-between">
      <Label
        :class="
          invalid
            ? 'text-sm font-medium text-destructive'
            : 'text-sm font-medium'
        "
      >
        {{ $t("smart_playlist.seed_heading") }}
      </Label>
      <span class="text-xs text-muted-foreground">
        {{ seedItems.seeds.value.length }} / {{ SEED_MAX }}
      </span>
    </div>

    <div
      :class="[
        'group flex items-center gap-2 rounded-md border bg-card/40 px-2 py-1.5 hover:bg-card transition-colors',
        invalid && !seedItems.hasSeed.value
          ? 'border-destructive ring-1 ring-destructive/40'
          : '',
      ]"
    >
      <div class="flex items-center gap-1 px-2 text-xs font-medium">
        <Sparkles class="h-3.5 w-3.5 text-muted-foreground" />
        <span>{{ $t("smart_playlist.seed_label") }}</span>
      </div>

      <div class="flex-1 min-w-0 flex items-center gap-1 flex-wrap">
        <Badge
          v-for="s in seedItems.seeds.value"
          :key="s.uri"
          variant="default"
          class="gap-1 max-w-[220px] pr-1"
        >
          <component
            :is="iconFor(s.kind)"
            class="h-2.5 w-2.5 flex-shrink-0 opacity-80"
          />
          <span class="truncate text-xs">
            {{ s.name
            }}<span v-if="s.subtitle" class="opacity-70">
              – {{ s.subtitle }}</span
            >
          </span>
          <button
            type="button"
            class="hover:bg-primary-foreground/20 rounded-full p-0.5 pt-1 flex-shrink-0 transition-colors"
            @click.stop="seedItems.removeSeed(s.uri)"
          >
            <X class="h-2.5 w-2.5" />
          </button>
        </Badge>

        <SmartPlaylistSeedPicker
          :kind="kind"
          :search-query="seedItems.searchQuery.value"
          :results="seedItems.searchResults.value"
          :is-searching="seedItems.isSearching.value"
          :is-submitted="seedItems.isSearchSubmitted.value"
          :has-provider="seedItems.hasSimilarTracksProvider.value"
          :is-full="seedItems.isFull.value"
          :invalid="invalid && !seedItems.hasSeed.value"
          @update:kind="onChangeKind"
          @update:search-query="onSearchUpdate"
          @select="seedItems.addSeedFromSearch($event, kind)"
          @submit="seedItems.submitSearch()"
        >
          <template #item-sub="{ item }">
            <span
              v-if="kind === 'track' || kind === 'album'"
              class="truncate text-xs text-muted-foreground"
            >
              {{
                ((item as Track | Album).artists as Artist[])?.[0]?.name ?? ""
              }}
            </span>
          </template>
        </SmartPlaylistSeedPicker>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  SEED_MAX,
  useSmartPlaylistSeedItems,
  type SeedKind,
} from "@/composables/smart-playlist/useSmartPlaylistSeedItems";
import type { Album, Artist, Track } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { Disc3, ListMusic, Mic2, Music, Sparkles, X } from "@lucide/vue";
import { computed, toRef, type Component } from "vue";
import SmartPlaylistSeedPicker from "./SmartPlaylistSeedPicker.vue";

const props = defineProps<{
  seedItems: ReturnType<typeof useSmartPlaylistSeedItems>;
  invalid?: boolean;
}>();

const seedItems = toRef(props, "seedItems");

const kind = computed(() => seedItems.value.activeKind.value);

function onChangeKind(next: SeedKind) {
  seedItems.value.activeKind.value = next;
}

function onSearchUpdate(q: string) {
  seedItems.value.searchQuery.value = q;
}

function iconFor(k: SeedKind): Component {
  switch (k) {
    case "track":
      return Music;
    case "artist":
      return Mic2;
    case "album":
      return Disc3;
    case "playlist":
      return ListMusic;
  }
  return Music;
}
</script>
