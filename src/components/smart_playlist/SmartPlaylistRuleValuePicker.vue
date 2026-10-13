<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        variant="ghost"
        size="sm"
        class="h-7 shrink-0 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
      >
        <Plus class="h-3 w-3" />
        {{ addLabel }}
      </Button>
    </PopoverTrigger>
    <PopoverContent
      align="start"
      class="w-[340px] p-2"
      @open-auto-focus="preventOnScreenKeyboardOnOpen"
    >
      <Input
        v-model="query"
        :placeholder="$t('search')"
        :aria-label="
          $t('smart_playlist.picker_search', { label: addLabel.toLowerCase() })
        "
        class="mb-2 h-8 text-sm"
        @keydown.stop
      />
      <div
        v-if="source === 'folder' && folderPath !== null"
        class="mb-1 flex items-center gap-1"
      >
        <Button
          variant="ghost"
          size="icon"
          class="h-7 w-7 shrink-0"
          :aria-label="$t('back')"
          @click.stop="openFolder(parentPath(folderPath))"
        >
          <ChevronLeft class="h-3.5 w-3.5" />
        </Button>
        <span class="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {{ folderValue(folderPath).name }}
        </span>
        <Button
          size="sm"
          class="h-7 shrink-0 px-2 text-xs"
          :disabled="selectedIds.includes(folderValue(folderPath).id)"
          @click.stop="onPickFolder(folderPath)"
        >
          {{ $t("settings.folder_picker.use_folder") }}
        </Button>
      </div>
      <div class="max-h-56 overflow-y-auto flex flex-col min-h-[80px]">
        <div v-if="isSearching" class="flex justify-center py-6">
          <Spinner class="text-muted-foreground" />
        </div>
        <template v-else-if="displayedOptions.length > 0">
          <button
            v-for="opt in displayedOptions"
            :key="opt.path ?? opt.id"
            type="button"
            class="flex items-center gap-1.5 py-1 px-1.5 text-sm rounded-sm hover:bg-accent text-left"
            @click.stop="opt.path ? openFolder(opt.path) : onPick(opt)"
          >
            <Folder
              v-if="opt.path"
              class="h-4 w-4 flex-none text-muted-foreground"
            />
            <div
              v-else-if="opt.item"
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
import { Spinner } from "@/components/ui/spinner";
import { preventOnScreenKeyboardOnOpen } from "@/helpers/dialog_focus";
import api from "@/plugins/api";
import {
  folderValue,
  type RuleValue,
} from "@/composables/smart-playlist/useSmartPlaylistRulesForm";
import {
  MediaType,
  ProviderFeature,
  type Album,
  type Artist,
  type BrowseFolder,
  type Genre,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { ChevronLeft, Folder, Plus } from "@lucide/vue";
import { useDebounceFn } from "@vueuse/core";
import { computed, ref, watch } from "vue";

interface Option {
  id: number;
  name: string;
  item?: Artist | Album | Genre;
  // folder source only: the browse path to open
  path?: string;
}

type Source = "genre" | "artist" | "album" | "album_type" | "folder";

const props = defineProps<{
  source: Source;
  selectedIds: number[];
  preloadedOptions: Option[];
  addLabel: string;
}>();

const emit = defineEmits<{
  add: [value: RuleValue];
}>();

const open = ref(false);
const query = ref("");
const remoteResults = ref<Option[]>([]);
const isSearching = ref(false);

// Genre and album_type options are preloaded and filtered client-side, folders are browsed;
// artist/album are fetched remotely as the user types.
const isRemote = computed(
  () => props.source === "artist" || props.source === "album",
);

// null lists the filesystem music sources, otherwise the browse path of the open folder
const folderPath = ref<string | null>(null);
const folderOptions = ref<Option[]>([]);

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
  if (props.source === "folder") {
    return folderOptions.value.filter((o) =>
      o.name.toLowerCase().includes(query.value.toLowerCase()),
    );
  }
  if (!isRemote.value) return filteredPreloaded.value;
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
  if (!isRemote.value) return;
  if (q.length < 2) {
    remoteResults.value = [];
    isSearching.value = false;
    return;
  }
  isSearching.value = true;
  runSearch(q);
});

// Closing only unmounts the popover content, so the search has to be dropped by
// hand - on open, to keep the restored list out of the closing animation.
watch(open, (isOpen) => {
  if (isOpen) {
    query.value = "";
    remoteResults.value = [];
    isSearching.value = false;
    if (props.source === "folder") openFolder(null);
  }
});

function parentPath(path: string): string | null {
  const [provider, relPath] = path.split("://", 2);
  if (!relPath) return null;
  const parts = relPath.split("/").filter(Boolean);
  parts.pop();
  return `${provider}://${parts.join("/")}`;
}

async function openFolder(path: string | null) {
  folderPath.value = path;
  query.value = "";
  if (path === null) {
    folderOptions.value = Object.values(api.providers)
      .filter(
        (p) =>
          p.domain.startsWith("filesystem_") &&
          p.available &&
          // skips audiobook, podcast and sound effect folders: they hold no tracks
          p.supported_features.includes(ProviderFeature.LIBRARY_TRACKS),
      )
      .map((p) => ({ id: 0, name: p.name, path: `${p.instance_id}://` }));
    return;
  }
  isSearching.value = true;
  try {
    const items = await api.browse(path);
    if (folderPath.value !== path) return;
    folderOptions.value = items
      .filter(
        (i): i is BrowseFolder =>
          i.media_type === MediaType.FOLDER && i.name !== "..",
      )
      .map((i) => ({ id: 0, name: i.name, path: i.path }));
  } catch {
    folderOptions.value = [];
  } finally {
    if (folderPath.value === path) isSearching.value = false;
  }
}

function onPick(opt: Option) {
  emit("add", { id: opt.id, name: opt.name });
  open.value = false;
}

function onPickFolder(path: string) {
  emit("add", folderValue(path));
  open.value = false;
}

const emptyStateText = computed(() => {
  if (props.source === "folder" && !query.value) {
    return $t("settings.folder_picker.no_subfolders");
  }
  if (isRemote.value && query.value.length < 2) {
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
