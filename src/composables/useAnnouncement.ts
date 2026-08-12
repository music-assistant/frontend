// Shared state and helpers for speaking an announcement on a player. The
// overflow menu item and the announcement dialog both use these, so the TTS
// engine catalog and availability detection live in one place.
import api from "@/plugins/api";
import { waitForApiInitialization } from "@/plugins/api/helpers";
import type { AnnouncementTtsEngine } from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { computed, ref } from "vue";

// The catalog is fetched as soon as the connection is up and kept
// module-level, so building a menu never has to wait on a network call.
const ttsEngines = ref<AnnouncementTtsEngine[]>([]);

// A message needs an engine to speak it, so announcements are only offered
// once at least one engine is set up.
const announcementAvailable = computed(() => ttsEngines.value.length > 0);

// the prefetch and every menu open share one request, so opening a menu
// repeatedly never stacks up parallel fetches of the same catalog
let inFlight: Promise<void> | null = null;

void loadTtsEngines();

export function useAnnouncement() {
  // Best-effort staleness refresh; engines come from plugins that can be set
  // up while the app stays open. Callers read the catalog fetched above.
  void loadTtsEngines();
  return {
    ttsEngines,
    announcementAvailable,
    openAnnouncementDialog,
  };
}

function openAnnouncementDialog(playerId: string): void {
  eventbus.emit("playAnnouncementDialog", { playerId });
}

function loadTtsEngines(): Promise<void> {
  inFlight ??= (async () => {
    try {
      await waitForApiInitialization();
      ttsEngines.value = await api.getAnnouncementTtsEngines();
    } catch {
      // keep any previously loaded engines on failure
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}
