<template>
  <!-- chapters of the playing item, each followed by the bookmarks inside it -->
  <div class="queue-chapters">
    <!-- on top, so a long chapter list does not hide it -->
    <button
      v-if="canAdd"
      type="button"
      class="queue-chapter mb-1 font-medium"
      data-testid="add-bookmark"
      @click.stop="addClicked"
    >
      <span class="flex min-w-0 items-center gap-1.5">
        <BookmarkPlus :size="14" class="shrink-0 text-primary" />
        <span class="queue-chapter__name">{{ $t("add_bookmark") }}</span>
      </span>
      <!-- the position it takes, counted like the bookmarks in its chapter -->
      <span class="queue-chapter__time tabular-nums">
        {{ formatDuration(position - chapterStartAt(position)) }}
      </span>
    </button>
    <template
      v-for="group in groups"
      :key="group.chapter?.position ?? 'bookmarks'"
    >
      <button
        v-if="group.chapter"
        type="button"
        class="queue-chapter"
        :class="{
          'queue-chapter--active': group.chapter.position === activePosition,
        }"
        :aria-current="
          group.chapter.position === activePosition ? 'true' : undefined
        "
        @click.stop="emit('seek', group.chapter)"
      >
        <span class="queue-chapter__name">{{ group.chapter.name }}</span>
        <span v-if="startTimes" class="queue-chapter__time tabular-nums">
          {{ formatDuration(group.chapter.start) }}
        </span>
        <span v-else-if="group.chapter.end" class="queue-chapter__time">
          {{ formatDuration(group.chapter.end - group.chapter.start) }}
        </span>
      </button>
      <!-- a position within the chapter, beside the chapters' durations -->
      <QueueBookmarkRow
        v-for="bookmark in group.bookmarks"
        :key="`bookmark-${bookmark.start}`"
        :bookmark="bookmark"
        :time="bookmark.start - (group.chapter?.start ?? 0)"
        :editable="bookmarkActions.isEditable(bookmark)"
        :in-chapter="!!group.chapter"
        @seek="emit('seek', bookmark)"
        @rename="bookmarkActions.renameClicked(bookmark)"
        @remove="bookmarkActions.removeClicked(bookmark)"
      />
    </template>
    <BookmarkDialog
      v-model:open="bookmarkActions.renameDialogOpen.value"
      :title="$t('rename_bookmark')"
      :initial-name="bookmarkActions.renamedBookmark.value?.name ?? ''"
      :stored-in="
        bookmarkActions.renamedBookmark.value
          ? bookmarkActions.storeName(bookmarkActions.renamedBookmark.value)
          : ''
      "
      @save="bookmarkActions.renameSaved"
    />
    <BookmarkDialog
      v-model:open="addDialogOpen"
      :title="$t('add_bookmark')"
      :initial-name="newBookmark ? formatDuration(newBookmark.start) : ''"
      :stored-in="newBookmark?.storedIn ?? ''"
      @save="addSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { BookmarkPlus } from "@lucide/vue";
import { ref, watch } from "vue";
import BookmarkDialog from "@/components/BookmarkDialog.vue";
import {
  newBookmarkOfPlayingItem,
  saveNewBookmark,
  useBookmarkActions,
  type NewBookmark,
} from "@/composables/useBookmarks";
import {
  chaptersFitBookmarks,
  resolveCurrentChapter,
  type ChapterBookmarks,
} from "@/helpers/chapters";
import { formatDuration } from "@/helpers/utils";
import QueueBookmarkRow from "@/layouts/default/PlayerOSD/QueueBookmarkRow.vue";
import type {
  MediaItemBookmark,
  MediaItemChapter,
  QueueItem,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";

export interface Props {
  item: QueueItem;
  groups: ChapterBookmarks[];
  // the playing chapter's position, highlighted in the list
  activePosition?: number;
  // the playing item takes a new bookmark
  canAdd: boolean;
  // the playing position, in seconds of the whole item
  position: number;
  // show where each chapter starts instead of its length
  startTimes?: boolean;
}
const props = defineProps<Props>();
const emit = defineEmits<{
  // a chapter or bookmark to play from
  seek: [target: MediaItemChapter | MediaItemBookmark];
}>();

// rename and delete the playing item's bookmarks
const bookmarkActions = useBookmarkActions(
  () => props.item.media_item?.media_type,
);

// where the chapter holding the position starts, 0 without chapters that fit
// the playing copy's positions
const chapterStartAt = function (seconds: number) {
  const media = props.item.media_item;
  if (!media || !chaptersFitBookmarks(media)) return 0;
  return (
    resolveCurrentChapter(
      media.metadata?.chapters,
      seconds,
      "duration" in media ? media.duration : undefined,
    )?.start ?? 0
  );
};

const addDialogOpen = ref(false);
// taken on the click, the position moves on while the name is typed
const newBookmark = ref<NewBookmark>();

const addClicked = function () {
  newBookmark.value = newBookmarkOfPlayingItem();
  addDialogOpen.value = !!newBookmark.value;
};

const addSaved = async function (name: string) {
  if (newBookmark.value) await saveNewBookmark(newBookmark.value, name);
};

// closing the full screen player unmounts this list, the dialogs have to go first
// or they leave the app-wide dialog flag set
watch(
  () => store.showFullscreenPlayer,
  (open) => {
    if (open) return;
    addDialogOpen.value = false;
    bookmarkActions.renameDialogOpen.value = false;
  },
);
</script>

<style scoped>
.queue-chapters {
  display: flex;
  flex-direction: column;
  margin: 2px 0 6px 60px;
}

.queue-chapter {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 6px 8px;
  border-radius: 6px;
  text-align: left;
  color: var(--text-color, currentColor);
  background: transparent;
  cursor: pointer;
  transition: background-color 0.12s ease;
}

.queue-chapter:hover {
  background: color-mix(
    in srgb,
    var(--text-color, currentColor) 8%,
    transparent
  );
}

.queue-chapter--active {
  color: var(--primary);
  background: color-mix(in srgb, var(--primary) 14%, transparent);
  font-weight: 600;
}

.queue-chapter--active:hover {
  background: color-mix(in srgb, var(--primary) 20%, transparent);
}

.queue-chapter__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--queue-subtitle-size, 0.8rem);
}

.queue-chapter__time {
  flex: 0 0 auto;
  font-size: 0.72rem;
  opacity: 0.6;
}
</style>
