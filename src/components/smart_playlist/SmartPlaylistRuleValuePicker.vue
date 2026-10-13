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
        v-if="source === 'folder' && folderPath !== null && currentFolder"
        class="mb-1 flex items-center gap-1"
      >
        <Button
          variant="ghost"
          size="icon"
          class="h-7 w-7 shrink-0"
          :aria-label="$t('back')"
          @click.stop="openParent(folderPath)"
        >
          <ChevronLeft class="h-3.5 w-3.5" />
        </Button>
        <span class="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {{ currentFolder.name }}
        </span>
        <Button
          size="sm"
          class="h-7 shrink-0 px-2 text-xs"
          :disabled="selectedIds.includes(currentFolder.id)"
          @click.stop="onPickFolder(currentFolder)"
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
import { parentBrowsePath } from "@/helpers/browse_path";
import { preventOnScreenKeyboardOnOpen } from "@/helpers/dialog_focus";
import { FILESYSTEM_DOMAIN_PREFIX } from "@/helpers/provider_domain";
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
import { toast } from "vue-sonner";

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
const currentFolder = computed(() =>
  folderPath.value === null ? null : folderValue(folderPath.value),
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

function openParent(path: string) {
  const parent = parentBrowsePath(path);
  // a source's own level goes back to the list of sources
  openFolder(parent === "root" ? null : parent);
}

async function openFolder(path: string | null) {
  folderPath.value = path;
  query.value = "";
  if (path === null) {
    // drops the spinner of a folder still loading, its result is ignored
    isSearching.value = false;
    folderOptions.value = Object.values(api.providers)
      .filter(
        (p) =>
          p.domain.startsWith(FILESYSTEM_DOMAIN_PREFIX) &&
          p.available &&
          // skips audiobook, podcast and sound effect folders: they hold no tracks
          p.supported_features.includes(ProviderFeature.LIBRARY_TRACKS),
      )
      .map((p) => ({ id: 0, name: p.name, path: `${p.instance_id}://` }));
    return;
  }
  isSearching.value = true;
  try {
    // the failure is reported below, so keep the global error toast quiet
    const items = await api.browse(path, undefined, {
      suppressGlobalError: true,
    });
    if (folderPath.value !== path) return;
    folderOptions.value = items
      .filter(
        (i): i is BrowseFolder =>
          i.media_type === MediaType.FOLDER && i.name !== "..",
      )
      .map((i) => ({ id: 0, name: i.name, path: i.path }));
  } catch {
    if (folderPath.value !== path) return;
    folderOptions.value = [];
    toast.error($t("settings.folder_picker.browse_failed"));
  } finally {
    if (folderPath.value === path) isSearching.value = false;
  }
}

function onPick(opt: Option) {
  emit("add", { id: opt.id, name: opt.name });
  open.value = false;
}

function onPickFolder(folder: RuleValue) {
  emit("add", folder);
  open.value = false;
}

const emptyStateText = computed(() => {
  if (props.source === "folder" && !query.value) {
    return folderPath.value === null
      ? $t("smart_playlist.picker_empty_folder_sources")
      : $t("settings.folder_picker.no_subfolders");
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
