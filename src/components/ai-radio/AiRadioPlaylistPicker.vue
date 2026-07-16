<template>
  <Popover v-model:open="popoverOpen">
    <PopoverTrigger as-child>
      <Button
        type="button"
        variant="outline"
        class="h-10 w-full justify-start gap-2 px-2 font-normal"
      >
        <template v-if="modelValue">
          <div class="h-6 w-6 shrink-0 overflow-hidden rounded">
            <MediaItemThumb
              v-if="selectedPlaylistItem"
              :item="selectedPlaylistItem"
              :size="24"
            />
            <div
              v-else
              class="flex h-full w-full items-center justify-center bg-muted"
            >
              <Music class="h-3 w-3 text-muted-foreground" />
            </div>
          </div>
          <span class="truncate">{{ modelValue.name }}</span>
        </template>
        <span v-else class="text-muted-foreground">
          {{ $t("providers.ai_radio.create.playlist_placeholder") }}
        </span>
      </Button>
    </PopoverTrigger>
    <PopoverContent align="start" class="w-[360px] p-2">
      <Input
        v-model="search"
        :placeholder="$t('search')"
        class="mb-2 h-8 text-sm"
        @keydown.stop
      />
      <div class="flex max-h-64 min-h-[80px] flex-col overflow-y-auto">
        <div v-if="loadingPlaylists" class="flex justify-center py-6">
          <Loader2 class="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
        <template v-else-if="filteredPlaylists.length > 0">
          <button
            v-for="playlist in filteredPlaylists"
            :key="`${playlist.provider}-${playlist.item_id}`"
            type="button"
            class="flex w-full items-center gap-2 rounded-sm px-1.5 py-1 text-left text-sm hover:bg-accent"
            @click="onPick(playlist)"
          >
            <div class="h-8 w-8 shrink-0 overflow-hidden rounded">
              <MediaItemThumb :item="playlist" :size="32" />
            </div>
            <span class="truncate">{{ playlist.name }}</span>
          </button>
        </template>
        <div
          v-else
          class="flex-1 py-3 text-center text-xs text-muted-foreground"
        >
          {{ $t("providers.ai_radio.create.playlist_empty") }}
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
import { useShows } from "@/composables/ai-radio/useShows";
import { $t } from "@/plugins/i18n";
import { Loader2, Music } from "@lucide/vue";
import { computed, onMounted, ref } from "vue";

/** A user-picked source playlist, kept as plain ids so it round-trips through route query and drafts. */
export interface PlaylistSelection {
  itemId: string;
  provider: string;
  name: string;
}

const props = defineProps<{
  modelValue?: PlaylistSelection;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: PlaylistSelection];
}>();

const { playlists, loadingPlaylists, loadPlaylists, playlistFor } = useShows();

const popoverOpen = ref(false);
const search = ref("");

const selectedPlaylistItem = computed(() => {
  if (!props.modelValue) return undefined;
  return playlistFor(props.modelValue.provider, props.modelValue.itemId);
});

const filteredPlaylists = computed(() => {
  const query = search.value.trim().toLowerCase();
  if (!query) return playlists.value;
  return playlists.value.filter((playlist) =>
    playlist.name.toLowerCase().includes(query),
  );
});

function onPick(playlist: (typeof playlists.value)[number]) {
  emit("update:modelValue", {
    itemId: playlist.item_id,
    provider: playlist.provider,
    name: playlist.name,
  });
  popoverOpen.value = false;
}

onMounted(() => {
  if (playlists.value.length === 0 && !loadingPlaylists.value) {
    void loadPlaylists();
  }
});
</script>
