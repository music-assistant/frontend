<template>
  <!-- One list: the playing song waits at the top until it's placed, with a
       dashed gap everywhere it can go (top, between the songs, bottom). Drag
       it, tap a gap, or tap the song to open spaces between the songs. -->
  <ol
    ref="listRef"
    class="flex list-none flex-col gap-2"
    :aria-label="$t('providers.music_quiz.timeline_order')"
    data-testid="timeline-drag"
  >
    <li
      v-for="row in rows"
      :key="row.key"
      :data-row="row.kind"
      :class="
        row.kind === 'space'
          ? 'timeline-space'
          : row.kind === 'song'
            ? 'flex flex-col gap-3'
            : 'flex flex-col gap-2'
      "
      :style="
        row.kind === 'space'
          ? { animationDelay: `${row.order * 30}ms` }
          : undefined
      "
    >
      <template v-if="row.kind === 'song'">
        <div
          ref="songCardRef"
          class="song-card grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border-2 p-3 shadow-sm select-none"
          :class="
            locked
              ? 'border-primary bg-primary/10'
              : 'border-primary bg-card cursor-grab touch-none active:cursor-grabbing'
          "
          :role="locked ? undefined : 'button'"
          :tabindex="locked ? undefined : 0"
          :aria-label="`${$t('providers.music_quiz.timeline_drag_song')}: ${subtitle}`"
          :aria-describedby="locked ? undefined : keysHintId"
          :aria-disabled="disabled || undefined"
          :aria-expanded="locked ? undefined : choosing"
          data-testid="timeline-drag-song"
          @pointerdown="startDrag"
          @keydown="onKey"
        >
          <span
            class="bg-primary/15 text-primary grid aspect-square w-full place-items-center rounded-lg"
            aria-hidden="true"
          >
            <AudioLines class="size-6" />
          </span>
          <span class="flex min-w-0 flex-col gap-1">
            <span class="truncate font-semibold">
              {{ $t("providers.music_quiz.timeline_drag_song") }}
            </span>
            <span
              class="truncate text-sm"
              :class="
                position === null && !choosing
                  ? 'text-muted-foreground'
                  : 'text-primary'
              "
            >
              {{ subtitle }}
            </span>
          </span>
          <span class="flex items-center gap-2" aria-hidden="true">
            <strong class="text-primary text-lg font-bold">?</strong>
            <Lock v-if="locked" class="text-primary size-5" />
            <GripVertical v-else class="text-muted-foreground size-5" />
          </span>
        </div>
        <slot v-if="locked" name="after-song"></slot>
      </template>

      <!-- A space the song can go: no years, the song's own icon. -->
      <button
        v-else-if="row.kind === 'space'"
        type="button"
        class="bg-primary/10 border-primary/40 text-primary hover:bg-primary/20 focus-visible:ring-primary/60 grid size-full place-items-center rounded-xl border-2 outline-none focus-visible:ring-3 focus-visible:ring-inset"
        :aria-label="spaceLabel(row.position)"
        data-testid="timeline-space"
        @click="pick(row.position)"
      >
        <AudioLines class="size-5 opacity-70" aria-hidden="true" />
      </button>

      <template v-else>
        <!-- A gap the waiting song can go in: a quarter of a song card's
             height (84px). It sits above its song, so it moves with it. While
             the song is dragged over it, it grows to the song's size. -->
        <button
          v-if="row.gap !== undefined"
          type="button"
          class="timeline-gap focus-visible:ring-primary/60 w-full rounded-xl border-2 border-dashed outline-none focus-visible:ring-3"
          :class="
            dragTarget === row.gap
              ? 'border-primary bg-primary/10 h-(--timeline-song-height)'
              : 'border-muted-foreground/30 hover:border-primary/60 hover:bg-primary/5 h-[21px] bg-transparent'
          "
          :aria-label="spaceLabel(row.gap)"
          :disabled="disabled"
          data-testid="timeline-gap"
          @click="pick(row.gap)"
        ></button>
        <TimelineEntryCard
          v-if="row.kind === 'entry'"
          :entry="row.entry"
          data-glide
        />
      </template>
    </li>
  </ol>
  <p :id="keysHintId" class="sr-only">
    {{ $t("providers.music_quiz.timeline_drag_keys") }}
  </p>
  <p class="sr-only" aria-live="polite">{{ announcement }}</p>
</template>

<script setup lang="ts">
import TimelineEntryCard from "@/components/music-quiz/answer-types/timeline/TimelineEntryCard.vue";
import {
  flip,
  landingSquash,
  startTimelineDrag,
} from "@/components/music-quiz/answer-types/timeline/timelineDrag";
import type { MusicQuizTimelineEntry } from "@/composables/music-quiz/useMusicQuiz";
import { $t } from "@/plugins/i18n";
import { AudioLines, GripVertical, Lock } from "@lucide/vue";
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from "vue";

type Row =
  | {
      kind: "entry";
      key: string;
      entry: MusicQuizTimelineEntry;
      /** The gap above this song, while the playing song waits. */
      gap?: number;
    }
  | { kind: "end"; key: string; gap: number }
  | { kind: "song"; key: string }
  | { kind: "space"; key: string; position: number; order: number };

const props = defineProps<{
  entries: MusicQuizTimelineEntry[];
  /** How many songs sit above the playing song; null until it's moved in. */
  position: number | null;
  locked: boolean;
  disabled: boolean;
}>();
const emit = defineEmits<{ "update:position": [position: number]; lock: [] }>();

const listRef = ref<HTMLOListElement | null>(null);
const songCardRef = ref<HTMLElement[] | HTMLElement | null>(null);
const keysHintId = useId();
// Where the song would land while it's being dragged.
const dragTarget = ref<number | null>(null);
// Spaces are open between the songs, waiting for a tap.
const choosing = ref(false);
const announcement = ref("");

// Not placed yet: the song waits at the top, above the dashed gaps.
const waiting = computed(() => props.position === null && !props.locked);

const rows = computed<Row[]>(() => {
  const list: Row[] = [];
  const last = props.entries.length;
  const songAt = props.position ?? 0;
  const showSpaces = choosing.value && !props.locked;
  // The open spaces stand in for the gaps.
  const showGaps = waiting.value && !showSpaces;
  let order = 0;
  for (let gap = 0; gap <= last; gap++) {
    if (gap === songAt) list.push({ kind: "song", key: "playing-song" });
    // No space where the song already sits.
    if (showSpaces && gap !== props.position) {
      list.push({
        kind: "space",
        key: `space-${gap}`,
        position: gap,
        order: order++,
      });
    }
    const entry = props.entries[gap];
    if (entry) {
      list.push({
        kind: "entry",
        key: entry.entry_id,
        entry,
        gap: showGaps ? gap : undefined,
      });
    } else if (showGaps) {
      list.push({ kind: "end", key: "end-gap", gap });
    }
  }
  return list;
});

const subtitle = computed(() => {
  if (choosing.value) return $t("providers.music_quiz.timeline_tap_hint");
  const shown = dragTarget.value ?? props.position;
  if (shown === null) return $t("providers.music_quiz.timeline_drag_hint");
  const place = slotLabel(shown);
  return props.locked
    ? `${$t("providers.music_quiz.timeline_locked_in")} · ${place}`
    : place;
});

function slotLabel(slot: number): string {
  const previous = props.entries[slot - 1];
  const next = props.entries[slot];
  if (!previous && next) {
    return $t("providers.music_quiz.timeline_place_before_year", [
      next.release_year,
    ]);
  }
  if (previous && !next) {
    return $t("providers.music_quiz.timeline_place_after_year", [
      previous.release_year,
    ]);
  }
  if (previous && next) {
    return previous.release_year === next.release_year
      ? $t("providers.music_quiz.timeline_place_in_year", [
          previous.release_year,
        ])
      : $t("providers.music_quiz.timeline_place_between_years", [
          previous.release_year,
          next.release_year,
        ]);
  }
  return $t("providers.music_quiz.timeline_place_here");
}

/** What a space does, for screen readers: "Place before 2008: Paparazzi". */
function spaceLabel(slot: number): string {
  const previous = props.entries[slot - 1];
  const next = props.entries[slot];
  if (!previous && next) {
    return $t("providers.music_quiz.timeline_place_before", [
      next.release_year,
      next.title,
    ]);
  }
  if (previous && !next) {
    return $t("providers.music_quiz.timeline_place_after", [
      previous.release_year,
      previous.title,
    ]);
  }
  if (previous && next) {
    return $t("providers.music_quiz.timeline_place_between", [
      previous.release_year,
      previous.title,
      next.release_year,
      next.title,
    ]);
  }
  return $t("providers.music_quiz.timeline_place_here");
}

function songCard(): HTMLElement | null {
  const card = songCardRef.value;
  return Array.isArray(card) ? (card[0] ?? null) : card;
}

function rowElements(): HTMLElement[] {
  return Array.from(listRef.value?.children ?? []) as HTMLElement[];
}

/**
 * What glides when the list changes: the songs themselves, not their rows, as
 * a gap above a song moves it within its row. The playing song's row holds
 * no gap, so it glides as a whole (its card does the landing squash).
 */
function glideElements(): HTMLElement[] {
  return [
    ...rowElements().filter((row) => row.dataset.row === "song"),
    ...(listRef.value?.querySelectorAll<HTMLElement>("[data-glide]") ?? []),
  ];
}

/** True while a dropped song is still settling into place. */
function settling(): boolean {
  return !!songCard()?.parentElement?.dataset.dragging;
}

async function moveTo(slot: number) {
  emit("update:position", slot);
  announcement.value = slotLabel(slot);
  await nextTick();
}

async function openSpaces(focusFirst = false) {
  announcement.value = $t("providers.music_quiz.timeline_tap_hint");
  // The gaps give way to the spaces; the songs glide rather than jolt.
  await flip(glideElements, async () => {
    choosing.value = true;
    await nextTick();
  });
  if (!focusFirst) return;
  listRef.value
    ?.querySelector<HTMLElement>('[data-testid="timeline-space"]')
    ?.focus();
}

/** Close the spaces; the songs glide back together. */
function closeSpaces() {
  if (!choosing.value) return;
  // A focused space is about to go; keep the keyboard on the song.
  const hadFocus = !!listRef.value?.contains(document.activeElement);
  void flip(glideElements, async () => {
    choosing.value = false;
    await nextTick();
  }).then(() => {
    if (hadFocus) songCard()?.focus({ preventScroll: true });
  });
}

function pick(slot: number) {
  // A tap while a dropped song is still landing would fight the drop.
  if (settling()) return;
  void flip(glideElements, async () => {
    choosing.value = false;
    await moveTo(slot);
  }).then(() => {
    landingSquash(songCard());
    songCard()?.focus({ preventScroll: true });
  });
}

function startDrag(event: PointerEvent) {
  if (props.locked || props.disabled) return;
  // With the spaces open, a tap on the song just closes them again.
  if (choosing.value) {
    closeSpaces();
    return;
  }
  const list = listRef.value;
  const card = songCard()?.parentElement;
  if (!list || !card) return;
  // A gap grows to exactly the song's height while it's dragged over.
  list.style.setProperty("--timeline-song-height", `${card.offsetHeight}px`);
  startTimelineDrag(event, {
    list,
    card,
    entries: rowElements().filter((row) => row.dataset.row === "entry"),
    slot: props.position ?? 0,
    gaps: waiting.value
      ? {
          slots: [
            ...list.querySelectorAll<HTMLElement>(
              '[data-testid="timeline-gap"]',
            ),
          ],
          songs: [...list.querySelectorAll<HTMLElement>("[data-glide]")],
        }
      : undefined,
    onTarget: (slot, cancelling) => {
      // Being called off: it goes back, so nothing lights up.
      dragTarget.value = cancelling ? null : slot;
    },
    onDrop: async (slot, _moved, cancelled) => {
      dragTarget.value = null;
      // Called off: the song goes back where it was, placed or not.
      if (cancelled) return;
      if (waiting.value) {
        // The gaps close as it's placed; the songs glide up, not jump.
        await flip(glideElements, async () => {
          for (const row of rowElements()) {
            row.style.transition = "none";
            row.style.transform = "";
          }
          await moveTo(slot);
        });
      } else {
        await moveTo(slot);
      }
      landingSquash(songCard());
    },
    onTap: () => {
      dragTarget.value = null;
      void openSpaces();
    },
  });
}

function onKey(event: KeyboardEvent) {
  if (props.locked || props.disabled) return;
  const last = props.entries.length;
  const slot = props.position;
  let next: number | undefined;
  if (event.key === "Escape" && choosing.value) {
    event.preventDefault();
    closeSpaces();
    return;
  } else if (event.key === "ArrowUp") {
    next = slot === null ? 0 : Math.max(0, slot - 1);
  } else if (event.key === "ArrowDown") {
    next = slot === null ? Math.min(1, last) : Math.min(last, slot + 1);
  } else if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    // Not placed yet: open the spaces and move to the first one.
    if (slot === null) void openSpaces(true);
    else emit("lock");
    return;
  }
  if (next === undefined) return;
  event.preventDefault();
  choosing.value = false;
  const target = next;
  void flip(glideElements, () => moveTo(target)).then(() =>
    songCard()?.focus(),
  );
}

// Tapping anywhere else, or Escape, closes the spaces. On click, not on
// pointerdown: closing them moves what's below (Lock in) up, and a tap that
// started on Lock in should still land on it.
function onOutsideClick(event: MouseEvent) {
  if (!listRef.value?.contains(event.target as Node)) closeSpaces();
}
function onEscape(event: KeyboardEvent) {
  if (event.key === "Escape") closeSpaces();
}
watch(choosing, (open) => {
  if (open) {
    document.addEventListener("click", onOutsideClick, true);
    document.addEventListener("keydown", onEscape);
  } else {
    document.removeEventListener("click", onOutsideClick, true);
    document.removeEventListener("keydown", onEscape);
  }
});
// A locked answer or a new round closes them too. (Separate sources: the
// timeline array is replaced on every game update, which isn't a change.)
watch([() => props.locked, () => props.entries.length], () => {
  choosing.value = false;
});
onBeforeUnmount(() => {
  document.removeEventListener("click", onOutsideClick, true);
  document.removeEventListener("keydown", onEscape);
});
</script>

<style scoped>
[data-dragging] > .song-card {
  box-shadow:
    0 12px 28px rgb(0 0 0 / 0.28),
    0 2px 6px rgb(0 0 0 / 0.18);
}

.song-card {
  -webkit-touch-callout: none;
}

/* Spaces grow open with the same small bounce as the drag. The negative
   margin cancels the list gap while a space is still flat. */
.timeline-space {
  height: 3.5rem;
  animation: timeline-space-open 0.42s cubic-bezier(0.34, 1.46, 0.64, 1) both;
}

@keyframes timeline-space-open {
  from {
    height: 0;
    margin-top: -0.5rem;
    opacity: 0;
  }
  to {
    height: 3.5rem;
    margin-top: 0;
    opacity: 1;
  }
}

/* Gaps fade in rather than pop, while the songs glide around them, and grow
   with the drag's bounce when the song is dragged over one. */
.timeline-gap {
  animation: timeline-gap-in 0.3s ease-out both;
  transition:
    height 0.3s cubic-bezier(0.34, 1.46, 0.64, 1),
    background-color 0.15s,
    border-color 0.15s;
}

@keyframes timeline-gap-in {
  from {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .timeline-space,
  .timeline-gap {
    animation: none;
    transition: none;
  }
}
</style>
