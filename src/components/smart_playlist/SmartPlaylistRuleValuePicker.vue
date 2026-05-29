<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        variant="ghost"
        size="sm"
        class="h-7 px-2 gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <Plus class="h-3 w-3" />
        {{ addLabel }}
      </Button>
    </PopoverTrigger>
    <PopoverContent align="start" class="w-[340px] p-2">
      <Input
        v-if="searchable"
        v-model="query"
        :placeholder="$t('search')"
        class="mb-2 h-8 text-sm"
        @keydown.stop
      />
      <div class="max-h-56 overflow-y-auto flex flex-col min-h-[80px]">
        <div v-if="isSearching" class="flex justify-center py-6">
          <Loader2 class="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
        <template v-else-if="displayedOptions.length > 0">
          <button
            v-for="opt in displayedOptions"
            :key="opt.id"
            type="button"
            class="flex items-center gap-1.5 py-1 px-1.5 text-sm rounded-sm hover:bg-accent text-left"
            @click.stop="onPick(opt)"
          >
            <div
              v-if="opt.item"
              class="h-8 w-8 flex-none overflow-hidden rounded"
            >
              <MediaItemThumb :item="opt.item" :size="32" />
            </div>
            <span class="truncate">{{ opt.name }}</span>
          </button>
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
import api from "@/plugins/api";
import type { Album, Artist } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { useDebounceFn } from "@vueuse/core";
import { Loader2, Plus } from "lucide-vue-next";
import { computed, ref, watch } from "vue";

interface Option {
  id: number;
  name: string;
  item?: Artist | Album;
}

type Source = "genre" | "artist" | "album";

const props = defineProps<{
  source: Source;
  selectedIds: number[];
  preloadedOptions: Option[];
  addLabel: string;
}>();

const emit = defineEmits<{
  add: [value: Option];
}>();

const open = ref(false);
const query = ref("");
const remoteResults = ref<Option[]>([]);
const isSearching = ref(false);

const searchable = computed(
  () => props.source === "artist" || props.source === "album",
);

const filteredPreloaded = computed(() => {
  const base = props.preloadedOptions.filter(
    (o) => !props.selectedIds.includes(o.id),
  );
  if (!query.value) return base;
  return base.filter((o) =>
    o.name.toLowerCase().includes(query.value.toLowerCase()),
  );
});

const displayedOptions = computed(() => {
  if (props.source === "genre") return filteredPreloaded.value;
  return remoteResults.value.filter((o) => !props.selectedIds.includes(o.id));
});

const runSearch = useDebounceFn(async (q: string) => {
  if (q.length < 2) {
    remoteResults.value = [];
    isSearching.value = false;
    return;
  }
  try {
    let results: Option[] = [];
    if (props.source === "artist") {
      const res = await api.getLibraryArtists(undefined, q, 20);
      results = res.map((a) => ({
        id: parseInt(a.item_id),
        name: a.name,
        item: a,
      }));
    } else if (props.source === "album") {
      const res = await api.getLibraryAlbums(undefined, q, 20);
      results = res.map((a) => ({
        id: parseInt(a.item_id),
        name: a.name,
        item: a,
      }));
    }
    if (query.value === q) {
      remoteResults.value = results;
    }
  } finally {
    if (query.value === q) {
      isSearching.value = false;
    }
  }
}, 400);

watch(query, (q) => {
  if (!searchable.value) return;
  if (q.length < 2) {
    remoteResults.value = [];
    isSearching.value = false;
    return;
  }
  isSearching.value = true;
  runSearch(q);
});

// Reset transient state when the popover closes.
watch(open, (isOpen) => {
  if (!isOpen) {
    query.value = "";
    remoteResults.value = [];
    isSearching.value = false;
  }
});

function onPick(opt: Option) {
  emit("add", { id: opt.id, name: opt.name });
  query.value = "";
  remoteResults.value = [];
  open.value = false;
}

const emptyStateText = computed(() => {
  if (searchable.value && query.value.length < 2) {
    return $t("smart_playlist.picker_empty_search", {
      label: props.addLabel.toLowerCase(),
    });
  }
  if (
    props.selectedIds.length > 0 &&
    props.preloadedOptions.length === 0 &&
    !query.value
  ) {
    return $t("smart_playlist.picker_empty_remote", {
      label: props.addLabel.toLowerCase(),
    });
  }
  return $t("smart_playlist.picker_empty_no_match", {
    label: props.addLabel.toLowerCase(),
  });
});
</script>
