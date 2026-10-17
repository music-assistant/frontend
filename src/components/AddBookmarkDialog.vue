<template>
  <BookmarkDialog
    v-model:open="open"
    :title="$t('add_bookmark')"
    :initial-name="bookmark ? formatDuration(bookmark.start) : ''"
    :stored-in="bookmark?.storedIn ?? ''"
    @save="save"
  />
</template>

<script setup lang="ts">
import BookmarkDialog from "@/components/BookmarkDialog.vue";
import type { NewBookmark } from "@/helpers/bookmarks";
import { formatDuration } from "@/helpers/utils";
import { api } from "@/plugins/api";
import { eventbus } from "@/plugins/eventbus";
import { onBeforeUnmount, onMounted, ref } from "vue";

const open = ref(false);
const bookmark = ref<NewBookmark>();

const onAddBookmark = function (evt: NewBookmark) {
  bookmark.value = evt;
  open.value = true;
};

const save = async function (name: string) {
  if (!bookmark.value) return;
  await api.setBookmark(
    bookmark.value.mediaType,
    bookmark.value.providerInstanceId,
    bookmark.value.providerItemId,
    bookmark.value.start,
    name,
  );
  // the item's detail page and the full screen player list them
  eventbus.emit("bookmarksChanged");
};

onMounted(() => {
  eventbus.on("addBookmark", onAddBookmark);
});

onBeforeUnmount(() => {
  eventbus.off("addBookmark", onAddBookmark);
});
</script>
