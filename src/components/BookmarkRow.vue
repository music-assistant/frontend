<template>
  <!-- laid out as the rows of the detail pages: art, name, time and menu -->
  <div
    class="flex h-14 items-center gap-3 rounded-lg px-2 hover:bg-[rgba(var(--v-theme-on-surface),0.05)]"
    data-testid="bookmark-row"
  >
    <button
      type="button"
      class="flex h-full min-w-0 flex-1 items-center gap-3 text-left disabled:opacity-50"
      :disabled="disabled"
      data-testid="bookmark-play"
      @click="emit('play')"
    >
      <span
        class="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/12"
      >
        <BookmarkIcon
          :size="18"
          class="fill-primary text-primary"
          aria-hidden="true"
        />
      </span>
      <span
        class="min-w-0 truncate text-[15px] font-medium"
        data-testid="bookmark-name"
      >
        {{ bookmark.name }}
      </span>
    </button>
    <span
      class="min-w-11 shrink-0 text-right text-[13px] text-[rgba(var(--v-theme-on-surface),0.6)] tabular-nums"
      data-testid="bookmark-position"
    >
      {{ shownTime }}
    </span>
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button
          variant="ghost"
          size="icon-sm"
          class="size-7 rounded-full text-[rgba(var(--v-theme-on-surface),0.6)]"
          :aria-label="`${$t('more_options')}: ${bookmark.name}`"
          data-testid="bookmark-menu"
        >
          <EllipsisVertical :size="16" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem :disabled="disabled" @click="emit('play')">
          <Play />
          {{ $t("play_from_position", { time: position }) }}
        </DropdownMenuItem>
        <template v-if="editable">
          <DropdownMenuItem
            data-testid="bookmark-rename"
            @click="emit('rename')"
          >
            <Pencil />
            {{ $t("rename_bookmark") }}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            data-testid="bookmark-delete"
            @click="emit('remove')"
          >
            <Trash2 />
            {{ $t("delete_bookmark") }}
          </DropdownMenuItem>
        </template>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>

<script setup lang="ts">
import {
  Bookmark as BookmarkIcon,
  EllipsisVertical,
  Pencil,
  Play,
  Trash2,
} from "@lucide/vue";
import { computed } from "vue";
import { Button } from "@/components/ui/button";
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
  // the time shown in the row when not its position in the whole item, e.g.
  // counted from the start of its chapter
  time?: number;
  editable: boolean;
  disabled?: boolean;
}
const props = defineProps<Props>();
const emit = defineEmits<{
  play: [];
  rename: [];
  remove: [];
}>();

// where it plays from, in the whole item
const position = computed(() => formatDuration(props.bookmark.start));
const shownTime = computed(() =>
  props.time === undefined ? position.value : formatDuration(props.time),
);
</script>
