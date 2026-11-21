<template>
  <Dialog v-model:open="open">
    <DialogContent
      class="sm:max-w-[560px]"
      @open-auto-focus="preventOnScreenKeyboardOnOpen"
    >
      <DialogHeader>
        <DialogTitle>{{ $t("genres") }}</DialogTitle>
        <DialogDescription class="sr-only">
          {{ $t("genres_of_item", { name: itemName }) }}
        </DialogDescription>
      </DialogHeader>
      <SearchInput
        v-if="genres.length > SEARCH_MIN_GENRES"
        v-model="filter"
        :placeholder="$t('search')"
        :aria-label="$t('search')"
        clearable
      />
      <p
        v-if="!filteredGenres.length"
        role="status"
        class="text-muted-foreground py-4 text-center text-sm"
      >
        {{ $t("no_content") }}
      </p>
      <!-- the padding keeps the focus ring of an outer chip inside the
           scrolling box -->
      <div
        v-else
        class="-m-1 flex max-h-[50vh] flex-wrap content-start gap-2 overflow-y-auto p-1"
      >
        <button
          v-for="genre in filteredGenres"
          :key="genre.item_id"
          v-hold="(e: Event) => onHold(e, genre)"
          type="button"
          class="hover:bg-accent focus-visible:ring-ring/50 max-w-full truncate rounded-full border px-3 py-1 text-sm outline-none focus-visible:ring-[3px]"
          :title="genreLabel(genre)"
          @click="(e: MouseEvent) => genreClick(e, genre)"
          @contextmenu.prevent="(e: MouseEvent) => emit('menu', e, genre)"
          @touchstart.passive="onTouchStart"
        >
          {{ genreLabel(genre) }}
        </button>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SearchInput } from "@/components/ui/search-input";
import { useHoldToOpenMenu } from "@/composables/useHoldToOpenMenu";
import { preventOnScreenKeyboardOnOpen } from "@/helpers/dialog_focus";
import { MediaType, type Genre } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { computed, ref, watch } from "vue";

export interface Props {
  genres: Genre[];
  itemName: string;
}
const props = defineProps<Props>();
const open = defineModel<boolean>("open", { required: true });
const emit = defineEmits<{
  select: [event: MouseEvent, genre: Genre];
  menu: [event: Event, genre: Genre];
}>();

// a short list is read at a glance; a long one needs narrowing down
const SEARCH_MIN_GENRES = 12;

const CONTENT_TYPE_KEYS: Partial<Record<MediaType, string>> = {
  [MediaType.PODCAST]: "genre_content_type.podcasts",
  [MediaType.AUDIOBOOK]: "genre_content_type.audiobooks",
};

// music, podcasts and audiobooks each have their own genres, so one name can
// appear more than once; the content type tells those apart
const duplicateNames = computed(() => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const genre of props.genres) {
    const name = genre.name.toLowerCase();
    if (seen.has(name)) duplicates.add(name);
    seen.add(name);
  }
  return duplicates;
});

const genreLabel = function (genre: Genre) {
  if (!duplicateNames.value.has(genre.name.toLowerCase())) return genre.name;
  const key =
    (genre.content_type && CONTENT_TYPE_KEYS[genre.content_type]) ||
    "genre_content_type.music";
  return `${genre.name} · ${$t(key)}`;
};

const filter = ref("");
watch(open, () => (filter.value = ""));

const filteredGenres = computed(() => {
  const query = filter.value.trim().toLowerCase();
  if (!query) return props.genres;
  return props.genres.filter((genre) =>
    genre.name.toLowerCase().includes(query),
  );
});

const { onHold, onTouchStart, swallowClickAfterHold } = useHoldToOpenMenu<
  [Genre]
>((event, genre) => emit("menu", event, genre));

const genreClick = function (event: MouseEvent, genre: Genre) {
  // the click a long-press leaves behind opened the menu, it is not a tap
  if (swallowClickAfterHold(event)) return;
  open.value = false;
  emit("select", event, genre);
};
</script>
