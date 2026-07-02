// Encapsulates the fullscreen player's unified queue list: the loaded window of
// items, bidirectional paging, now-playing focus handling, the per-item context
// menu and audiobook chapter playback. Extracted from PlayerFullscreen.vue to
// keep that component focused on layout.
import { usePartyConfig } from "@/composables/usePartyConfig";
import { MarqueeTextSync } from "@/helpers/marquee_text_sync";
import { getQueueItemMenuItems } from "@/helpers/queue_item_menu_items";
import { useQueueDragReorder } from "@/layouts/default/PlayerOSD/useQueueDragReorder";
import api from "@/plugins/api";
import {
  EventMessage,
  EventType,
  MediaItemChapter,
  MediaItemType,
  PlaybackState,
  QueueItem,
  QueueOption,
} from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import { useVirtualizer } from "@tanstack/vue-virtual";
import {
  Ref,
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { useDisplay } from "vuetify";

export type QueueItemState = "played" | "playing" | "buffered" | "upcoming";

export function useFullscreenQueue(showLyrics: Ref<boolean>) {
  const { name } = useDisplay();

  // Marquee sync group shared by the (non-playing) hovered rows.
  const hoveredMarqueeSync = new MarqueeTextSync();

  // Scroll viewport element (the virtualizer's scroll parent).
  const queueScrollRef = ref<HTMLElement | null>(null);
  // Keep the now-playing track scrolled into focus while true. Disabled when the
  // user scrolls it out of view, re-enabled when they bring it back.
  const followCurrent = ref(true);

  // Total number of items in the queue (drives the virtualizer's row count).
  const totalItems = computed(() => store.activePlayerQueue?.items ?? 0);

  // Sparsely loaded item data, keyed by absolute queue index. Only the pages
  // around the viewport are ever fetched, so a queue with thousands of tracks
  // stays cheap in both memory and DOM (rows are virtualized).
  const loadedItems = ref(new Map<number, QueueItem>());
  const itemAt = (index: number) => loadedItems.value.get(index);

  // Badge colors for guest request badges (loaded from party/config).
  const requestBadgeColor = ref("#2196f3");
  const boostBadgeColor = ref("#ff5722");

  // ---- section state -------------------------------------------------------

  // Section state for the queue item at the given absolute queue index.
  const itemState = (absIndex: number): QueueItemState => {
    const queue = store.activePlayerQueue;
    const current = queue?.current_index ?? 0;
    const buffer = Math.max(queue?.index_in_buffer ?? current, current);
    if (absIndex < current) return "played";
    if (absIndex === current) return "playing";
    if (absIndex <= buffer) return "buffered";
    return "upcoming";
  };

  // Translation key for the divider rendered *before* the item at the given
  // absolute index (or null for none). "Now playing" labels just the current
  // track; "Up next" introduces everything after it (buffered items included —
  // they keep a subtle "buffered" tint so it's clear they're already cued).
  const dividerBefore = (absIndex: number): string | null => {
    const queue = store.activePlayerQueue;
    if (!queue) return null;
    const current = queue.current_index ?? 0;
    if (absIndex === current) return "now_playing";
    if (absIndex === current + 1) return "up_next";
    return null;
  };

  // Number of items after the current track — the "Up next" section, which now
  // includes any already-buffered items.
  const upNextCount = computed(() => {
    const queue = store.activePlayerQueue;
    if (!queue) return 0;
    const current = queue.current_index ?? 0;
    return Math.max(0, (queue.items ?? 0) - current - 1);
  });

  // Whether the player is actually rendering audio (drives the equalizer icon).
  const playerActive = computed(
    () => store.activePlayer?.playback_state !== PlaybackState.IDLE,
  );

  // ---- virtualization ------------------------------------------------------

  // Estimated row height (px), used before a row is measured. Real heights are
  // measured per row (divider / audiobook-chapter rows are taller).
  const ROW_ESTIMATE = 60;

  const virtualizer = useVirtualizer(
    computed(() => ({
      count: totalItems.value,
      getScrollElement: () => queueScrollRef.value,
      estimateSize: () => ROW_ESTIMATE,
      overscan: 8,
      // Leave some history peeking above the now-playing track when we focus it.
      scrollPaddingStart: queueScrollRef.value
        ? queueScrollRef.value.clientHeight * 0.2
        : 80,
    })),
  );

  // Ref callback so the virtualizer can measure each rendered row's real height.
  const measureRow = (el: unknown) => {
    virtualizer.value.measureElement(el as HTMLElement | null);
  };

  const totalSize = computed(() => virtualizer.value.getTotalSize());

  // Visible (+ overscan) rows with their data, section state and any divider.
  const virtualRows = computed(() =>
    virtualizer.value.getVirtualItems().map((vItem) => ({
      vItem,
      index: vItem.index,
      item: itemAt(vItem.index),
      state: itemState(vItem.index),
      divider: dividerBefore(vItem.index),
    })),
  );

  // ---- responsive font sizes ----------------------------------------------

  const queueTitleFontSize = computed(() => {
    switch (name.value) {
      case "xs":
        return "0.875rem";
      case "sm":
        return "0.875rem";
      case "md":
        return "0.925rem";
      case "lg":
        return "0.9rem";
      case "xl":
        return "0.925rem";
      case "xxl":
        return "0.975rem";
      default:
        return "0.875rem";
    }
  });

  const queueSubtitleFontSize = computed(() => {
    switch (name.value) {
      case "xs":
        return "0.775rem";
      case "sm":
        return "0.775rem";
      case "md":
        return "0.8rem";
      case "lg":
        return "0.8rem";
      case "xl":
        return "0.8rem";
      case "xxl":
        return "0.85rem";
      default:
        return "0.775rem";
    }
  });

  // ---- data loading (per-page, around the viewport) ------------------------

  // Items are fetched a page at a time and cached by absolute index. Only pages
  // that intersect the visible range are ever requested, so a huge queue costs
  // little memory and the DOM stays tiny (rows are virtualized).
  const PAGE_SIZE = 50;
  const loadedPages = new Set<number>();
  const pendingPages = new Set<number>();
  // Bumped whenever the cache is invalidated (queue changed / player switched);
  // in-flight fetches compare against it and drop stale results.
  let loadGeneration = 0;

  const ensurePageLoaded = (page: number) => {
    const queue = store.activePlayerQueue;
    if (!queue || page < 0) return;
    const offset = page * PAGE_SIZE;
    if (offset >= queue.items) return;
    if (loadedPages.has(page) || pendingPages.has(page)) return;
    pendingPages.add(page);
    const generation = loadGeneration;
    api
      .getPlayerQueueItems(queue.queue_id, PAGE_SIZE, offset)
      .then((result) => {
        if (generation !== loadGeneration) return;
        const map = loadedItems.value;
        result.forEach((item, i) => map.set(offset + i, item));
        loadedPages.add(page);
      })
      .finally(() => {
        if (generation === loadGeneration) pendingPages.delete(page);
      });
  };

  const ensureRangeLoaded = (firstIndex: number, lastIndex: number) => {
    if (lastIndex < firstIndex) return;
    const firstPage = Math.floor(Math.max(0, firstIndex) / PAGE_SIZE);
    const lastPage = Math.floor(lastIndex / PAGE_SIZE);
    for (let page = firstPage; page <= lastPage; page++) ensurePageLoaded(page);
  };

  // First / last absolute index currently rendered by the virtualizer.
  const visibleRange = computed<[number, number]>(() => {
    const items = virtualizer.value.getVirtualItems();
    if (!items.length) return [0, -1];
    return [items[0].index, items[items.length - 1].index];
  });

  // Invalidate the loaded window so it refetches. The already-loaded item
  // objects stay in place and are overwritten as fresh pages arrive, so a queue
  // change (reorder/add/remove) updates only the rows that actually differ
  // instead of blanking every row to a skeleton and reloading every thumbnail.
  // Pass clear=true when switching to a different queue, whose items must not be
  // shown even briefly.
  const invalidate = (clear = false) => {
    loadGeneration += 1;
    loadedPages.clear();
    pendingPages.clear();
    if (clear) {
      loadedItems.value = new Map();
    } else {
      // Drop entries past the queue's (possibly reduced) end; the rest stay
      // visible until the refetch overwrites them.
      const total = store.activePlayerQueue?.items ?? 0;
      for (const index of loadedItems.value.keys()) {
        if (index >= total) loadedItems.value.delete(index);
      }
    }
    const [first, last] = visibleRange.value;
    ensureRangeLoaded(first, last);
  };

  // Scroll the now-playing track into focus (scrollPaddingStart leaves a little
  // already-played history peeking above it).
  const focusCurrent = (behavior: ScrollBehavior = "auto") => {
    const current = store.activePlayerQueue?.current_index;
    if (current == null || current < 0) return;
    virtualizer.value.scrollToIndex(current, { align: "start", behavior });
  };

  // Load the pages the viewport needs, and track whether the now-playing track
  // is on screen (so playback advances only re-focus while the user follows).
  watch(
    visibleRange,
    ([first, last]) => {
      ensureRangeLoaded(first, last);
      const current = store.activePlayerQueue?.current_index;
      if (current != null && last >= first) {
        followCurrent.value = current >= first && current <= last;
      }
    },
    { immediate: true },
  );

  // ---- per-item context menu / actions ------------------------------------

  const openQueueItemMenu = (evt: Event, index: number) => {
    const item = itemAt(index);
    if (!item) return;
    eventbus.emit("contextmenu", {
      items: getQueueItemMenuItems(item, index),
      posX: (evt as PointerEvent).clientX,
      posY: (evt as PointerEvent).clientY,
    });
  };

  const chapterClicked = (item: MediaItemType, chapter: MediaItemChapter) => {
    api.playMedia(item.uri, QueueOption.PLAY, chapter.position.toString());
  };

  // ---- drag-to-reorder (up-next items only) --------------------------------

  // Pointer-driven reorder of the up-next items, in its own composable. While
  // dragging it stops the list from following playback (so it can't yank).
  const {
    startItemDrag,
    draggingIndex,
    isDragging,
    draggedItem,
    ghostY,
    rowOffset,
  } = useQueueDragReorder({
    scrollEl: queueScrollRef,
    getVirtualItems: () => virtualizer.value.getVirtualItems(),
    itemAt,
    onDragStart: () => {
      followCurrent.value = false;
    },
  });

  // ---- party badge colors --------------------------------------------------

  const { config: partyConfig, fetchConfig: fetchPartyConfig } =
    usePartyConfig();

  // React to party config changes (e.g., admin changes badge colors).
  watch(partyConfig, (newConfig) => {
    if (newConfig) {
      requestBadgeColor.value = newConfig.request_badge_color ?? "#2196F3";
      boostBadgeColor.value = newConfig.boost_badge_color ?? "#FF5722";
    }
  });

  onMounted(async () => {
    // Only fetch badge colors if party provider is loaded.
    if (Object.values(api.providers).some((p) => p.domain === "party")) {
      await fetchPartyConfig();
    }
  });

  // ---- lifecycle / playback follow ----------------------------------------

  // Focus the now-playing track when the queue list becomes visible.
  watch(
    () =>
      store.showFullscreenPlayer && store.showQueueItems && !showLyrics.value,
    (visible) => {
      if (!visible) return;
      followCurrent.value = true;
      nextTick(() => requestAnimationFrame(() => focusCurrent("auto")));
    },
    { immediate: true },
  );

  // Re-focus the now-playing track as playback advances, while the user is
  // following along (dividers/sections recompute reactively from current_index).
  watch(
    () => store.activePlayerQueue?.current_index,
    (index) => {
      if (
        index == null ||
        !store.showFullscreenPlayer ||
        !store.showQueueItems ||
        showLyrics.value
      )
        return;
      if (followCurrent.value) nextTick(() => focusCurrent("smooth"));
    },
  );

  // Reload data when the server reports the queue changed (reorder/add/remove).
  // This runs even while the panel is hidden so an off-screen change isn't
  // served stale on reopen; while hidden the refetch is a no-op (no rows are
  // rendered) and the cleared page bookkeeping makes the visibleRange watcher
  // refetch once the panel is shown again.
  onMounted(() => {
    const unsub = api.subscribe(
      EventType.QUEUE_ITEMS_UPDATED,
      (evt: EventMessage) => {
        if (evt.object_id != store.activePlayerQueue?.queue_id) return;
        invalidate();
        if (
          store.showFullscreenPlayer &&
          store.showQueueItems &&
          followCurrent.value
        ) {
          nextTick(() => requestAnimationFrame(() => focusCurrent("auto")));
        }
      },
    );
    onBeforeUnmount(unsub);
  });

  // Reset when the active player changes.
  watch(
    () => store.activePlayerId,
    () => {
      invalidate(true);
      if (
        store.showFullscreenPlayer &&
        store.showQueueItems &&
        !showLyrics.value
      ) {
        followCurrent.value = true;
        nextTick(() => requestAnimationFrame(() => focusCurrent("auto")));
      }
    },
    { immediate: true },
  );

  return {
    queueScrollRef,
    virtualRows,
    totalItems,
    upNextCount,
    totalSize,
    measureRow,
    playerActive,
    hoveredMarqueeSync,
    requestBadgeColor,
    boostBadgeColor,
    queueTitleFontSize,
    queueSubtitleFontSize,
    openQueueItemMenu,
    chapterClicked,
    startItemDrag,
    draggingIndex,
    isDragging,
    draggedItem,
    ghostY,
    rowOffset,
  };
}
