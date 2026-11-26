<template>
  <Dialog v-model:open="open">
    <DialogContent
      class="sm:max-w-[560px]"
      @open-auto-focus="preventOnScreenKeyboardOnOpen"
      @close-auto-focus="restoreFocus"
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
           scrolling box; a long name wraps, as touch has no tooltip -->
      <div
        v-else
        class="-m-1 flex max-h-[50vh] flex-wrap content-start gap-2 overflow-y-auto p-1"
      >
        <button
          v-for="genre in filteredGenres"
          :key="genre.item_id"
          v-hold="(e: Event) => onHold(e, genre)"
          type="button"
          class="detail-hero-genres-dialog__genre hover:bg-accent focus-visible:ring-ring/50 max-w-full rounded-2xl border px-3 py-1 text-left text-sm [overflow-wrap:anywhere] outline-none focus-visible:ring-[3px]"
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
import { store } from "@/plugins/store";
import { computed, onBeforeUnmount, ref, watch } from "vue";

export interface Props {
  genres: Genre[];
  itemName: string;
}
const props = defineProps<Props>();
const open = defineModel<boolean>("open", { required: true });
const emit = defineEmits<{
  select: [genre: Genre, posX: number, posY: number];
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

// the dialog can open over another that stays open behind it, so closing it
// restores the flag rather than clearing it for the one underneath
let dialogActiveBeforeOpen = false;
// it has no trigger element, so on close focus goes back to what opened it
let focusBeforeOpen: HTMLElement | null = null;

watch(open, (value, previous) => {
  filter.value = "";
  if (value && !previous) {
    dialogActiveBeforeOpen = store.dialogActive;
    focusBeforeOpen =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
  }
  store.dialogActive = value || (dialogActiveBeforeOpen && store.dialogActive);
});

onBeforeUnmount(() => {
  if (open.value) {
    store.dialogActive = dialogActiveBeforeOpen && store.dialogActive;
  }
});

const restoreFocus = function (event: Event) {
  event.preventDefault();
  const target = focusBeforeOpen;
  focusBeforeOpen = null;
  if (!target) return;
  // deferred like reka's own restore, so the dialog has let go of focus
  setTimeout(() => {
    // a picked genre may have moved focus on purpose, such as into its menu
    const active = document.activeElement;
    if (active && active !== document.body) return;
    if (target.isConnected) target.focus();
  }, 0);
};

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
  // a click from the keyboard has no pointer position, so a menu it opens
  // goes under the chip instead
  let { clientX: x, clientY: y } = event;
  if (event.detail === 0) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    x = rect.left;
    y = rect.bottom;
  }
  open.value = false;
  emit("select", genre, x, y);
};
</script>
