<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        variant="outline"
        size="sm"
        class="h-8 max-w-[240px] justify-start px-2 text-sm font-normal"
      >
        <span class="truncate">{{ triggerLabel }}</span>
      </Button>
    </PopoverTrigger>
    <PopoverContent
      align="start"
      class="w-[300px] p-2"
      @open-auto-focus="preventOnScreenKeyboardOnOpen"
    >
      <Input
        v-if="hasSearch"
        v-model="query"
        :placeholder="$t('rotation.value.search')"
        :aria-label="$t('rotation.value.search')"
        class="mb-2 h-8 text-sm"
        @keydown.stop
      />
      <div class="flex max-h-56 min-h-[60px] flex-col overflow-y-auto">
        <div v-if="isRemote && isSearching" class="flex justify-center py-6">
          <Spinner class="text-muted-foreground" />
        </div>
        <template v-else-if="shownOptions.length > 0">
          <button
            v-for="option in shownOptions"
            :key="option.value"
            type="button"
            class="truncate rounded-sm px-1.5 py-1 text-left text-sm hover:bg-accent"
            @click.stop="onPick(option)"
          >
            {{ option.name }}
          </button>
        </template>
        <p
          v-else
          class="flex flex-1 items-center justify-center px-2 py-3 text-center text-xs text-muted-foreground"
        >
          {{
            isRemote && query.length < MIN_SEARCH_LENGTH
              ? $t("rotation.value.type_to_search")
              : $t("rotation.value.no_results")
          }}
        </p>
      </div>
    </PopoverContent>
  </Popover>
</template>

<script setup lang="ts">
import { AUDIO_QUALITIES } from "@/components/rotation/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { useRotationRefLabels } from "@/composables/rotation/useRotationRefLabels";
import { useSmartPlaylistGenres } from "@/composables/smart-playlist/useSmartPlaylistGenres";
import { setupDebouncedSearch } from "@/composables/smart-playlist/useSmartPlaylistSearchHelpers";
import { preventOnScreenKeyboardOnOpen } from "@/helpers/dialog_focus";
import api from "@/plugins/api";
import { AlbumType, type RotationDescribe } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { computed, ref, watch } from "vue";

interface Option {
  value: string;
  name: string;
}

const MIN_SEARCH_LENGTH = 2;
const SEARCH_LIMIT = 20;
const HIDDEN_ALBUM_TYPES: string[] = [AlbumType.UNKNOWN];

const props = defineProps<{
  field: string;
  modelValue?: unknown;
  providers?: RotationDescribe["providers"];
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const open = ref(false);
const query = ref("");
const remoteResults = ref<Option[]>([]);
const isSearching = ref(false);

const isRemote = props.field === "artist" || props.field === "album";
const FIXED_LIST_FIELDS = ["provider", "album_type", "audio_quality"];
const hasSearch = !FIXED_LIST_FIELDS.includes(props.field);
const genres = props.field === "genre" ? useSmartPlaylistGenres() : null;

const current = computed(() =>
  typeof props.modelValue === "string" ? props.modelValue : "",
);
const { labelOf, remember } = useRotationRefLabels(
  () => props.field,
  () => (current.value ? [current.value] : []),
  () => props.providers ?? [],
);

const triggerLabel = computed(() =>
  current.value ? labelOf(current.value) : $t("rotation.value.pick"),
);

if (isRemote) {
  setupDebouncedSearch<Option>({
    query,
    results: remoteResults,
    isSearching,
    searchFn: async (q) => {
      const items =
        props.field === "artist"
          ? await api.getLibraryArtists(undefined, q, SEARCH_LIMIT)
          : await api.getLibraryAlbums(undefined, q, SEARCH_LIMIT);
      return items.map((item) => ({ value: item.uri, name: item.name }));
    },
    minLength: MIN_SEARCH_LENGTH,
  });
}

const localOptions = computed<Option[]>(() => {
  if (props.field === "genre") {
    return (genres?.genres.value ?? []).map((g) => ({
      value: g.name,
      name: g.name,
    }));
  }
  if (props.field === "provider") {
    return (props.providers ?? []).map((p) => ({
      value: p.instance_id,
      name: p.name,
    }));
  }
  if (props.field === "album_type") {
    return Object.values(AlbumType)
      .filter((type) => !HIDDEN_ALBUM_TYPES.includes(type))
      .map((type) => ({ value: type, name: $t(`album_type.${type}`) }));
  }
  if (props.field === "audio_quality") {
    return AUDIO_QUALITIES.map((quality) => ({
      value: quality,
      name: $t(`rotation.audio_quality.${quality}`),
    }));
  }
  return [];
});

const shownOptions = computed(() => {
  if (isRemote) return remoteResults.value;
  const needle = query.value.toLowerCase();
  return localOptions.value.filter((o) =>
    o.name.toLowerCase().includes(needle),
  );
});

watch(open, (isOpen) => {
  if (!isOpen) return;
  query.value = "";
  remoteResults.value = [];
  isSearching.value = false;
});

function onPick(option: Option) {
  remember(option.value, option.name);
  emit("update:modelValue", option.value);
  open.value = false;
}
</script>
