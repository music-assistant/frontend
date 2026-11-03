<template>
  <!-- laid out as the rows of the other detail pages -->
  <section v-if="titleKey" class="px-7 pt-[26px]">
    <div class="mb-2 flex flex-wrap items-center justify-between gap-2.5">
      <DetailSectionTitle :title="$t(titleKey)" />
      <!-- a single tab says no more than the title -->
      <Tabs
        v-if="tabs.length > 1"
        :model-value="shownTab"
        @update:model-value="(v) => (activeTab = v as ChapterTab)"
      >
        <TabsList>
          <TabsTrigger v-for="tab in tabs" :key="tab.id" :value="tab.id">
            {{ $t(tab.labelKey) }}
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
    <!-- the hover area reaches past the text, so the rows line up with the title -->
    <div class="-mx-2 divide-y divide-[rgba(var(--v-theme-on-surface),0.08)]">
      <template v-for="row in rows" :key="row.key">
        <button
          v-if="row.chapter"
          type="button"
          class="flex h-14 w-full items-center gap-3 rounded-lg px-2 text-left hover:bg-[rgba(var(--v-theme-on-surface),0.05)] disabled:opacity-50"
          :disabled="!itemIsAvailable(itemDetails)"
          data-testid="chapter-row"
          @click="chapterClicked(row.chapter)"
        >
          <span
            class="flex size-10 shrink-0 items-center justify-center rounded-md bg-[rgba(var(--v-theme-on-surface),0.08)] text-[13px] font-medium tabular-nums"
          >
            {{ row.chapter.position }}
          </span>
          <span
            class="min-w-0 flex-1 truncate text-[15px] font-medium"
            data-testid="chapter-name"
          >
            {{ row.chapter.name }}
          </span>
          <span
            v-if="row.chapter.end"
            class="min-w-11 shrink-0 text-right text-[13px] text-[rgba(var(--v-theme-on-surface),0.6)] tabular-nums"
            data-testid="chapter-duration"
          >
            {{ formatDuration(row.chapter.end - row.chapter.start) }}
          </span>
          <!-- where the bookmarks have their menu, so the times line up -->
          <span class="w-7 shrink-0"></span>
        </button>
        <BookmarkRow
          v-else-if="row.bookmark"
          :bookmark="row.bookmark"
          :editable="isEditable(row.bookmark)"
          :disabled="!itemIsAvailable(itemDetails)"
          @play="bookmarkClicked(row.bookmark)"
          @rename="renameClicked(row.bookmark)"
          @remove="removeClicked(row.bookmark)"
        />
      </template>
    </div>
    <BookmarkDialog
      v-model:open="renameDialogOpen"
      :title="$t('rename_bookmark')"
      :initial-name="renamedBookmark?.name ?? ''"
      :stored-in="renamedBookmark ? storeName(renamedBookmark) : ''"
      @save="renameSaved"
    />
  </section>
</template>

<script setup lang="ts">
import BookmarkDialog from "@/components/BookmarkDialog.vue";
import BookmarkRow from "@/components/BookmarkRow.vue";
import DetailSectionTitle from "@/components/details/DetailSectionTitle.vue";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBookmarkActions, useBookmarks } from "@/composables/useBookmarks";
import { groupBookmarksByChapter } from "@/helpers/chapters";
import { formatDuration } from "@/helpers/utils";
import { api } from "@/plugins/api";
import { itemIsAvailable } from "@/plugins/api/helpers";
import {
  MediaType,
  type Audiobook,
  type MediaItemBookmark,
  type MediaItemChapter,
  type PodcastEpisode,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { computed, ref } from "vue";

export interface Props {
  itemDetails: Audiobook | PodcastEpisode;
}
const props = defineProps<Props>();

const { bookmarks } = useBookmarks(() => {
  const item = props.itemDetails;
  return {
    mediaType: item.media_type,
    itemId: item.item_id,
    provider: item.provider,
    uri: item.uri,
    // a change made to any copy of the item
    copyUris: [
      item.uri,
      ...item.provider_mappings.map(
        (x) => `${x.provider_instance}://${item.media_type}/${x.item_id}`,
      ),
    ],
  };
});

type ChapterTab = "chapters" | "bookmarks" | "all";

// a tab per kind the item has, and the combined one when it has both
const tabs = computed(() => {
  const hasChapters = !!props.itemDetails.metadata?.chapters?.length;
  const hasBookmarks = bookmarks.value.length > 0;
  const result: { id: ChapterTab; labelKey: string }[] = [];
  if (hasChapters) result.push({ id: "chapters", labelKey: "chapters" });
  if (hasBookmarks) result.push({ id: "bookmarks", labelKey: "bookmarks" });
  if (hasChapters && hasBookmarks) {
    result.push({ id: "all", labelKey: "chapters_and_bookmarks_tab" });
  }
  return result;
});

// a single kind names the list after itself, both kinds after the two of them
const titleKey = computed(() =>
  tabs.value.length > 1 ? "chapters_and_bookmarks" : tabs.value[0]?.labelKey,
);

const activeTab = ref<ChapterTab>("chapters");

const {
  renameDialogOpen,
  renamedBookmark,
  isEditable,
  storeName,
  renameClicked,
  renameSaved,
  removeClicked,
} = useBookmarkActions(() => props.itemDetails.media_type);

// the picked tab while the item has it, the first one otherwise
const shownTab = computed(() =>
  tabs.value.some((x) => x.id === activeTab.value)
    ? activeTab.value
    : tabs.value[0]?.id,
);

interface ChapterRow {
  key: string;
  chapter?: MediaItemChapter;
  bookmark?: MediaItemBookmark;
}

const bookmarkKey = (bookmark: MediaItemBookmark) =>
  `${bookmark.provider_instance}-${bookmark.item_id}-${bookmark.start}`;

const rows = computed<ChapterRow[]>(() => {
  const tab = shownTab.value;
  if (tab === "chapters") {
    return (props.itemDetails.metadata?.chapters ?? []).map((chapter) => ({
      key: `chapter-${chapter.position}`,
      chapter,
    }));
  }
  if (tab === "bookmarks") {
    return [...bookmarks.value]
      .sort((a, b) => a.start - b.start)
      .map((bookmark) => ({ key: bookmarkKey(bookmark), bookmark }));
  }
  // each chapter is followed by the bookmarks inside it
  return groupBookmarksByChapter(
    props.itemDetails.metadata?.chapters,
    bookmarks.value,
  ).flatMap((group) => [
    ...(group.chapter
      ? [{ key: `chapter-${group.chapter.position}`, chapter: group.chapter }]
      : []),
    ...group.bookmarks.map((bookmark) => ({
      key: bookmarkKey(bookmark),
      bookmark,
    })),
  ]);
});

const chapterClicked = function (chapter: MediaItemChapter) {
  if (!props.itemDetails || !itemIsAvailable(props.itemDetails)) return;
  // an episode is played on its own, so it starts at a position, not a chapter
  api.playMedia(
    props.itemDetails.uri,
    undefined,
    props.itemDetails.media_type === MediaType.PODCAST_EPISODE
      ? { start_position: chapter.start }
      : { start_item: chapter.position.toString() },
  );
};

const bookmarkClicked = function (bookmark: MediaItemBookmark) {
  if (!itemIsAvailable(props.itemDetails)) return;
  // play the copy the bookmark was made on, its position may not fit another one
  api.playMedia(
    `${bookmark.provider_instance}://${props.itemDetails.media_type}/${bookmark.item_id}`,
    undefined,
    { start_position: bookmark.start },
  );
};
</script>
