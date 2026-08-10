import { store } from "@/plugins/store";

export const isPlayerQueueControlDisabled = function (): boolean {
  return (
    !store.activePlayerQueue ||
    !store.activePlayerId ||
    (store.showFullscreenPlayer && !store.curQueueItem && !store.showQueueItems)
  );
};

export const togglePlayerQueue = function (): void {
  if (store.showFullscreenPlayer && store.showQueueItems) {
    store.showQueueItems = false;
    return;
  }
  store.showQueueItems = true;
  store.showFullscreenPlayer = true;
};
