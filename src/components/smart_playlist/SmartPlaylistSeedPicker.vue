<template>
  <Popover v-model:open="popoverOpen">
    <PopoverTrigger as-child>
      <Button
        variant="ghost"
        size="sm"
        :disabled="!hasProvider || isFull"
        :class="[
          'h-7 px-2 gap-1 text-xs text-muted-foreground hover:text-foreground',
          invalid ? 'text-destructive' : '',
        ]"
      >
        <Plus class="h-3 w-3" />
        {{ buttonLabel }}
      </Button>
    </PopoverTrigger>
    <PopoverContent align="start" class="w-[340px] p-2">
      <Tabs
        :model-value="kind"
        @update:model-value="(v) => emit('update:kind', v as SeedKind)"
      >
        <TabsList class="grid grid-cols-4 h-8 mb-2">
          <TabsTrigger
            v-for="opt in tabs"
            :key="opt.value"
            :value="opt.value"
            class="h-full text-[11px] border-0 data-[state=active]:bg-muted-foreground/20 data-[state=active]:text-foreground dark:data-[state=active]:bg-muted-foreground/30 dark:data-[state=active]:text-foreground"
          >
            {{ opt.label }}
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <Input
        :model-value="searchQuery"
        :placeholder="$t('search')"
        class="mb-2 h-8 text-sm"
        @update:model-value="emit('update:searchQuery', $event as string)"
        @keydown.stop
      />
      <div class="max-h-56 overflow-y-auto flex flex-col min-h-[80px]">
        <div v-if="isSearching" class="flex justify-center py-6">
          <Loader2 class="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
        <template v-else-if="results.length > 0">
          <template v-for="(group, index) in resultGroups" :key="group.key">
            <div
              v-if="group.items.length > 0"
              role="group"
              :aria-label="group.heading"
            >
              <div
                class="px-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                :class="index === 0 ? 'pt-1' : 'pt-2'"
              >
                {{ group.heading }}
              </div>
              <button
                v-for="item in group.items"
                :key="`${group.key}-${item.item_id}`"
                type="button"
                class="w-full flex items-center gap-1.5 py-1 px-1.5 text-sm rounded-sm hover:bg-accent text-left"
                @click.stop="onPick(item)"
              >
                <div class="h-8 w-8 flex-none overflow-hidden rounded">
                  <MediaItemThumb :item="item" :size="32" />
                </div>
                <div class="flex flex-col min-w-0 flex-1">
                  <span class="truncate font-medium">{{ item.name }}</span>
                  <slot name="item-sub" :item="item"></slot>
                </div>
              </button>
            </div>
          </template>
        </template>
        <div
          v-else
          class="flex-1 flex items-center justify-center text-center py-3 px-2"
        >
          <p class="text-xs text-muted-foreground leading-relaxed">
            {{ emptyStateText }}
          </p>
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>

<script setup lang="ts">
import MediaItemThumb from "@/components/MediaItemThumb.vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SeedKind } from "@/composables/useSmartPlaylistSeedItems";
import type { Album, Artist, Playlist, Track } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { Loader2, Plus } from "@lucide/vue";
import { match } from "ts-pattern";
import { computed, ref } from "vue";

type SearchItem = Track | Artist | Album | Playlist;

const props = defineProps<{
  kind: SeedKind;
  searchQuery: string;
  results: SearchItem[];
  isSearching: boolean;
  hasProvider: boolean;
  isFull: boolean;
  invalid?: boolean;
}>();

const emit = defineEmits<{
  "update:kind": [value: SeedKind];
  "update:searchQuery": [value: string];
  select: [item: SearchItem];
}>();

const popoverOpen = ref(false);

const resultGroups = computed(() => [
  {
    key: "lib",
    heading: $t("smart_playlist.results_library"),
    items: props.results.filter((r) => r.provider === "library"),
  },
  {
    key: "oth",
    heading: $t("smart_playlist.results_other"),
    items: props.results.filter((r) => r.provider !== "library"),
  },
]);

function onPick(item: SearchItem) {
  emit("select", item);
  popoverOpen.value = false;
}

const tabs = computed(() => [
  { value: "track" as SeedKind, label: $t("track") },
  { value: "artist" as SeedKind, label: $t("artist") },
  { value: "album" as SeedKind, label: $t("album") },
  { value: "playlist" as SeedKind, label: $t("playlist") },
]);

const kindLabel = computed(() =>
  match(props.kind)
    .with("track", () => $t("track"))
    .with("artist", () => $t("artist"))
    .with("album", () => $t("album"))
    .with("playlist", () => $t("playlist"))
    .exhaustive(),
);

const buttonLabel = computed(() => {
  if (!props.hasProvider) return $t("smart_playlist.seed_no_provider");
  if (props.isFull) return $t("smart_playlist.seed_full");
  return $t("smart_playlist.add_seed");
});

const emptyStateText = computed(() => {
  if (props.searchQuery.length < 2) {
    return $t("smart_playlist.picker_empty_search", {
      label: kindLabel.value.toLowerCase(),
    });
  }
  return $t("smart_playlist.picker_empty_no_match", {
    label: kindLabel.value.toLowerCase(),
  });
});
</script>
