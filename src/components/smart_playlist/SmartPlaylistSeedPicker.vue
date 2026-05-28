<template>
  <div class="flex flex-col gap-2">
    <Tabs
      :model-value="kind"
      @update:model-value="(v) => emit('update:kind', v as 'track' | 'artist')"
    >
      <TabsList class="grid grid-cols-2 h-8">
        <TabsTrigger
          value="track"
          class="text-xs border-0 data-[state=active]:bg-muted-foreground/20 data-[state=active]:text-foreground dark:data-[state=active]:bg-muted-foreground/30 dark:data-[state=active]:text-foreground"
        >
          {{ $t("track") }}
        </TabsTrigger>
        <TabsTrigger
          value="artist"
          class="text-xs border-0 data-[state=active]:bg-muted-foreground/20 data-[state=active]:text-foreground dark:data-[state=active]:bg-muted-foreground/30 dark:data-[state=active]:text-foreground"
        >
          {{ $t("artist") }}
        </TabsTrigger>
      </TabsList>
    </Tabs>

    <div
      v-if="selectedItem"
      class="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2"
    >
      <div class="flex flex-col min-w-0">
        <span class="text-sm font-medium truncate">{{
          selectedItem.name
        }}</span>
        <span v-if="subtitle" class="text-xs text-muted-foreground truncate">
          {{ subtitle }}
        </span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        class="h-7 w-7 flex-shrink-0"
        @click="emit('clear')"
      >
        <X class="h-3.5 w-3.5" />
      </Button>
    </div>

    <Popover v-else>
      <PopoverTrigger as-child>
        <Button
          variant="outline"
          :disabled="!hasProvider"
          :class="[
            'h-9 justify-start gap-2 text-sm font-normal text-muted-foreground',
            invalid ? 'border-destructive ring-1 ring-destructive/40' : '',
          ]"
        >
          <Search class="h-3.5 w-3.5" />
          {{
            hasProvider
              ? kind === "track"
                ? $t("smart_playlist.seed_track_pick")
                : $t("smart_playlist.seed_artist_pick")
              : kind === "track"
                ? $t("smart_playlist.seed_no_track_provider")
                : $t("smart_playlist.seed_no_artist_provider")
          }}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        class="w-[var(--reka-popover-trigger-width)] p-2"
      >
        <Input
          :model-value="searchQuery"
          :placeholder="$t('search')"
          class="mb-2 h-8 text-sm"
          @update:model-value="emit('update:searchQuery', $event as string)"
          @keydown.stop
        />
        <div class="max-h-56 overflow-y-auto flex flex-col">
          <div v-if="isSearching" class="flex justify-center py-2">
            <Loader2 class="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
          <div
            v-for="item in results"
            :key="item.item_id"
            class="flex flex-col py-1 px-1.5 cursor-pointer text-sm hover:bg-accent rounded-sm"
            @click.stop="emit('select', item)"
          >
            <span class="truncate font-medium">{{ item.name }}</span>
            <slot name="item-sub" :item="item"></slot>
          </div>
          <p
            v-if="searchQuery.length < 2"
            class="text-xs text-muted-foreground py-1.5 px-1.5"
          >
            {{ $t("search") }}…
          </p>
          <p
            v-else-if="!isSearching && results.length === 0"
            class="text-xs text-muted-foreground py-1.5 px-1.5"
          >
            {{ $t("no_results") }}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  </div>
</template>

<script setup lang="ts">
import { Loader2, Search, X } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SearchItem {
  item_id: string;
  name: string;
}

defineProps<{
  kind: "track" | "artist";
  selectedItem: SearchItem | null;
  searchQuery: string;
  results: SearchItem[];
  isSearching: boolean;
  hasProvider: boolean;
  subtitle?: string;
  invalid?: boolean;
}>();

const emit = defineEmits<{
  "update:kind": [value: "track" | "artist"];
  "update:searchQuery": [value: string];
  select: [item: SearchItem];
  clear: [];
}>();
</script>
