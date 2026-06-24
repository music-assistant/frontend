// Encapsulates the fullscreen player's unified queue list: the loaded window of
// items, bidirectional paging, now-playing focus handling, the per-item context
// menu and audiobook chapter playback. Extracted from PlayerFullscreen.vue to
// keep that component focused on layout.
import { usePartyConfig } from "@/composables/usePartyConfig";
import { MarqueeTextSync } from "@/helpers/marquee_text_sync";
import api from "@/plugins/api";
import {
  EventMessage,
  EventType,
  MediaItemChapter,
  MediaItemType,
  MediaType,
  PlaybackState,
  QueueItem,
  QueueOption,
  Track,
} from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import router from "@/plugins/router";
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

  // Drop all cached data (e.g. after a reorder) and refetch what's visible.
  const invalidate = () => {
    loadGeneration += 1;
    loadedItems.value = new Map();
    loadedPages.clear();
    pendingPages.clear();
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

  const itemClick = (item: MediaItemType) => {
    // a media item in the list was clicked
    store.showFullscreenPlayer = false;
    router.push({
      name: item.media_type,
      params: {
        itemId: item.item_id,
        provider: item.provider,
      },
    });
  };

  const queueCommand = (item: QueueItem | undefined, command: string) => {
    if (!item || !store.activePlayerQueue) return;
    if (command == "play_now") {
      api.queueCommandPlayIndex(
        store.activePlayerQueue.queue_id,
        item.queue_item_id,
      );
    } else if (command == "move_next") {
      api.queueCommandMoveNext(
        store.activePlayerQueue.queue_id,
        item.queue_item_id,
      );
    } else if (command == "up") {
      api.queueCommandMoveUp(
        store.activePlayerQueue.queue_id,
        item.queue_item_id,
      );
    } else if (command == "down") {
      api.queueCommandMoveDown(
        store.activePlayerQueue.queue_id,
        item.queue_item_id,
      );
    } else if (command == "end") {
      api.queueCommandMoveItemEnd(
        store.activePlayerQueue.queue_id,
        item.queue_item_id,
      );
    } else if (command == "delete") {
      api.queueCommandDelete(
        store.activePlayerQueue.queue_id,
        item.queue_item_id,
      );
    }
  };

  const openQueueItemMenu = (evt: Event, index: number) => {
    const item = itemAt(index);
    if (!item) return;
    const itemIndex = index;
    const menuItems = [
      {
        label: "play_now",
        labelArgs: [],
        action: () => {
          queueCommand(item, "play_now");
        },
        icon: "mdi-play-circle-outline",
        disabled:
          itemIndex === store.activePlayerQueue?.current_index ||
          itemIndex === store.activePlayerQueue?.index_in_buffer,
      },
      {
        label: "play_next",
        labelArgs: [],
        action: () => {
          queueCommand(item, "move_next");
        },
        icon: "mdi-skip-next-circle-outline",
        disabled: itemIndex <= (store.activePlayerQueue?.index_in_buffer || 0),
      },
      {
        label: "queue_move_up",
        labelArgs: [],
        action: () => {
          queueCommand(item, "up");
        },
        icon: "mdi-arrow-up",
        disabled: itemIndex <= (store.activePlayerQueue?.index_in_buffer || 0),
      },
      {
        label: "queue_move_down",
        labelArgs: [],
        action: () => {
          queueCommand(item, "down");
        },
        icon: "mdi-arrow-down",
        disabled: itemIndex <= (store.activePlayerQueue?.index_in_buffer || 0),
      },
      {
        label: "queue_move_end",
        labelArgs: [],
        action: () => {
          queueCommand(item, "end");
        },
        icon: "mdi-arrow-collapse-down",
        disabled: itemIndex <= (store.activePlayerQueue?.index_in_buffer || 0),
      },
      {
        label: "queue_delete",
        labelArgs: [],
        action: () => {
          queueCommand(item, "delete");
        },
        icon: "mdi-delete",
        disabled: itemIndex <= (store.activePlayerQueue?.index_in_buffer || 0),
      },
    ];
    if (item?.media_item?.media_type == MediaType.TRACK) {
      menuItems.push({
        label: "show_info",
        labelArgs: [],
        action: () => {
          itemClick(item.media_item as Track);
        },
        icon: "mdi-information-outline",
        disabled: false,
      });
    }
    eventbus.emit("contextmenu", {
      items: menuItems,
      posX: (evt as PointerEvent).clientX,
      posY: (evt as PointerEvent).clientY,
    });
  };

  const chapterClicked = (item: MediaItemType, chapter: MediaItemChapter) => {
    api.playMedia(
      item.uri,
      QueueOption.PLAY,
      undefined,
      chapter.position.toString(),
    );
  };

  // ---- drag-to-reorder (up-next items only) --------------------------------

  // While dragging, the source row hides in place, a floating "ghost" of it
  // follows the pointer, and the rows between source and target slide aside to
  // open a gap — so you can see where the item will land. dragDropIndex is the
  // index the item would be inserted *before* on drop.
  const dragSourceIndex = ref<number | null>(null);
  const dragDropIndex = ref<number | null>(null);
  // The item being dragged (drives the floating ghost). Captured at drag start.
  const draggedItem = ref<QueueItem | null>(null);
  // Y of the floating ghost's top within the virtual spacer (content space).
  const ghostY = ref(0);
  // Height (px) of the dragged row — the size of the gap the others open up.
  const dragRowHeight = ref(0);
  // Offset between the pointer and the top of the grabbed item, so the ghost
  // keeps the same grip point under the finger instead of jumping.
  let dragGrabOffset = 0;
  // queue_item_id captured at drag start — the item data may be re-fetched
  // mid-drag, so we don't hold on to the object itself.
  let dragItemId: string | null = null;
  // Last pointer Y (viewport px) so the auto-scroll loop can recompute the drop
  // target as the list scrolls under a stationary finger.
  let dragPointerY = 0;
  // Auto-scroll velocity (px/frame) while the pointer sits near an edge.
  let autoScrollSpeed = 0;
  let autoScrollRaf = 0;
  // Lets cleanup detach every drag listener at once (no per-handler bookkeeping).
  let dragAbort: AbortController | null = null;

  // First absolute index an up-next item may occupy. Everything up to and
  // including the buffered items is locked (already cued in the stream).
  const firstReorderableIndex = () => {
    const queue = store.activePlayerQueue;
    if (!queue) return 0;
    const current = queue.current_index ?? 0;
    const buffer = Math.max(queue.index_in_buffer ?? current, current);
    return buffer + 1;
  };

  // Resolve the insertion index (drop *before* this absolute index) for a given
  // pointer Y, clamped to the reorderable up-next region.
  const computeDropIndex = (clientY: number): number => {
    const el = queueScrollRef.value;
    if (!el) return dragDropIndex.value ?? firstReorderableIndex();
    const rect = el.getBoundingClientRect();
    const y = clientY - rect.top + el.scrollTop;
    const rows = virtualizer.value.getVirtualItems();
    let dropIndex = totalItems.value;
    let matched = false;
    for (const row of rows) {
      if (y < row.start + row.size / 2) {
        dropIndex = row.index;
        matched = true;
        break;
      }
    }
    if (!matched) {
      const last = rows[rows.length - 1];
      dropIndex = last ? last.index + 1 : totalItems.value;
    }
    const min = firstReorderableIndex();
    return Math.min(Math.max(dropIndex, min), totalItems.value);
  };

  // Set the auto-scroll velocity from how close the pointer is to an edge.
  const updateAutoScroll = (clientY: number) => {
    const el = queueScrollRef.value;
    if (!el) {
      autoScrollSpeed = 0;
      return;
    }
    const rect = el.getBoundingClientRect();
    const EDGE = 56; // px from the edge where auto-scroll engages
    const distTop = clientY - rect.top;
    const distBottom = rect.bottom - clientY;
    if (distTop < EDGE) {
      autoScrollSpeed = -Math.ceil((EDGE - distTop) / 5);
    } else if (distBottom < EDGE) {
      autoScrollSpeed = Math.ceil((EDGE - distBottom) / 5);
    } else {
      autoScrollSpeed = 0;
    }
  };

  // Recompute the ghost position and drop target from the current pointer Y.
  const updateDragPositions = (clientY: number) => {
    dragPointerY = clientY;
    const el = queueScrollRef.value;
    if (el) {
      const rect = el.getBoundingClientRect();
      ghostY.value = clientY - rect.top + el.scrollTop - dragGrabOffset;
    }
    dragDropIndex.value = computeDropIndex(clientY);
  };

  function autoScrollFrame() {
    if (dragSourceIndex.value == null) return;
    const el = queueScrollRef.value;
    if (autoScrollSpeed !== 0 && el) {
      el.scrollTop += autoScrollSpeed;
      updateDragPositions(dragPointerY);
    }
    autoScrollRaf = requestAnimationFrame(autoScrollFrame);
  }

  const onDragPointerMove = (evt: PointerEvent) => {
    if (dragSourceIndex.value == null) return;
    evt.preventDefault();
    updateAutoScroll(evt.clientY);
    updateDragPositions(evt.clientY);
  };

  const cleanupDrag = () => {
    dragAbort?.abort();
    dragAbort = null;
    if (autoScrollRaf) cancelAnimationFrame(autoScrollRaf);
    autoScrollRaf = 0;
    autoScrollSpeed = 0;
    dragSourceIndex.value = null;
    dragDropIndex.value = null;
    draggedItem.value = null;
    dragRowHeight.value = 0;
    dragGrabOffset = 0;
    dragItemId = null;
  };

  const finishDrag = (commit: boolean) => {
    const source = dragSourceIndex.value;
    const drop = dragDropIndex.value;
    const itemId = dragItemId;
    const queue = store.activePlayerQueue;
    cleanupDrag();
    if (!commit || source == null || drop == null || itemId == null || !queue)
      return;
    // Removing the source first shifts everything after it down by one, so the
    // final resting index is one lower when dropping below the original spot.
    const finalIndex = drop > source ? drop - 1 : drop;
    const shift = finalIndex - source;
    if (shift === 0) return;
    api.queueCommandMoveItem(queue.queue_id, itemId, shift);
  };

  // Begin dragging an up-next row from its drag handle.
  const startItemDrag = (evt: PointerEvent, index: number) => {
    // Primary mouse button / touch / pen only.
    if (evt.pointerType === "mouse" && evt.button !== 0) return;
    const item = itemAt(index);
    if (!item || itemState(index) !== "upcoming") return;

    // Measure the grabbed item so the ghost lines up under the finger and the
    // gap the other rows open matches the item's height. Fall back to the
    // virtualizer's measurement if the element can't be resolved.
    const el = queueScrollRef.value;
    const qitemEl = (evt.target as HTMLElement | null)?.closest(".qitem");
    if (el && qitemEl) {
      const cRect = el.getBoundingClientRect();
      const qRect = qitemEl.getBoundingClientRect();
      const qTop = qRect.top - cRect.top + el.scrollTop;
      dragRowHeight.value = qRect.height;
      dragGrabOffset = evt.clientY - cRect.top + el.scrollTop - qTop;
      ghostY.value = qTop;
    } else {
      const vItem = virtualizer.value
        .getVirtualItems()
        .find((v) => v.index === index);
      dragRowHeight.value = vItem?.size ?? 60;
      dragGrabOffset = dragRowHeight.value / 2;
      ghostY.value = (vItem?.start ?? 0) + dragRowHeight.value / 2;
    }

    dragSourceIndex.value = index;
    dragDropIndex.value = index;
    draggedItem.value = item;
    dragItemId = item.queue_item_id;
    dragPointerY = evt.clientY;
    autoScrollSpeed = 0;
    // Don't let playback advance re-focus (yank) the list while dragging.
    followCurrent.value = false;
    dragAbort = new AbortController();
    const { signal } = dragAbort;
    window.addEventListener("pointermove", onDragPointerMove, {
      passive: false,
      signal,
    });
    window.addEventListener("pointerup", () => finishDrag(true), { signal });
    window.addEventListener("pointercancel", () => finishDrag(false), {
      signal,
    });
    autoScrollRaf = requestAnimationFrame(autoScrollFrame);
  };

  // Index of the row currently being dragged (the hidden source row).
  const draggingIndex = computed(() => dragSourceIndex.value);

  // Whether a reorder drag is in progress (drives the ghost + gap rendering).
  const isDragging = computed(() => dragSourceIndex.value !== null);

  // Extra Y offset for a visible row so the rows between the source and the
  // drop target slide aside, opening a gap the size of the dragged row exactly
  // where it will land. Returns 0 for everything else (incl. the source row).
  const rowOffset = (index: number): number => {
    const source = dragSourceIndex.value;
    const drop = dragDropIndex.value;
    if (source == null || drop == null || index === source) return 0;
    const height = dragRowHeight.value;
    // Dragging down: rows below the source and above the target shift up.
    if (drop > source && index > source && index < drop) return -height;
    // Dragging up: rows from the target down to the source shift down.
    if (drop < source && index >= drop && index < source) return height;
    return 0;
  };

  onBeforeUnmount(cleanupDrag);

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
  onMounted(() => {
    const unsub = api.subscribe(
      EventType.QUEUE_ITEMS_UPDATED,
      (evt: EventMessage) => {
        if (evt.object_id != store.activePlayerQueue?.queue_id) return;
        if (!store.showFullscreenPlayer || !store.showQueueItems) return;
        invalidate();
        if (followCurrent.value) {
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
      invalidate();
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
