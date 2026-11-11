<template>
  <!-- a row of the playing item's chapter list: jump to it, or rename or delete it -->
  <div
    class="queue-chapter group/bookmark py-0!"
    :class="{ 'pl-6!': inChapter }"
    :data-in-chapter="inChapter"
  >
    <button
      type="button"
      class="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left"
      data-testid="queue-bookmark"
      @click.stop="emit('seek')"
    >
      <BookmarkIcon :size="14" class="shrink-0 fill-primary text-primary" />
      <!-- sized here: the player's scoped chapter styles stop at this component -->
      <span
        class="queue-chapter__name min-w-0 truncate text-[length:var(--queue-subtitle-size,0.8rem)]"
        >{{ bookmark.name }}</span
      >
    </button>
    <span
      class="queue-chapter__time shrink-0 text-[0.72rem] tabular-nums opacity-60"
    >
      {{ formatDuration(time) }}
    </span>
    <DropdownMenu v-if="editable">
      <DropdownMenuTrigger as-child>
        <button
          type="button"
          class="-me-1 flex size-6 shrink-0 items-center justify-center rounded-full hover:bg-[color-mix(in_srgb,var(--text-color,currentColor)_12%,transparent)] focus-visible:opacity-100 data-[state=open]:opacity-100"
          :class="{ 'opacity-0 group-hover/bookmark:opacity-100': !isTouch }"
          :aria-label="`${$t('more_options')}: ${bookmark.name}`"
          data-testid="queue-bookmark-menu"
          @click.stop
        >
          <EllipsisVertical :size="14" />
        </button>
      </DropdownMenuTrigger>
      <!-- above the full screen dialog -->
      <DropdownMenuContent align="end" class="z-[100001]">
        <DropdownMenuItem
          data-testid="queue-bookmark-rename"
          @click="emit('rename')"
        >
          <Pencil />
          {{ $t("rename_bookmark") }}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          data-testid="queue-bookmark-delete"
          @click="emit('remove')"
        >
          <Trash2 />
          {{ $t("delete_bookmark") }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>

<script setup lang="ts">
import {
  Bookmark as BookmarkIcon,
  EllipsisVertical,
  Pencil,
  Trash2,
} from "@lucide/vue";
import { useMediaQuery } from "@vueuse/core";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDuration } from "@/helpers/utils";
import type { MediaItemBookmark } from "@/plugins/api/interfaces";

export interface Props {
  bookmark: MediaItemBookmark;
  // the position shown, e.g. counted from the start of its chapter
  time: number;
  editable: boolean;
  // indented under the chapter it is in
  inChapter: boolean;
}
defineProps<Props>();
const emit = defineEmits<{
  seek: [];
  rename: [];
  remove: [];
}>();

// without hover the menu stays visible
const isTouch = useMediaQuery("(hover: none)");
</script>
