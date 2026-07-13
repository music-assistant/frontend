import { deepClone } from "@/helpers/ai_radio";
import api from "@/plugins/api";
import type {
  AIRadioSection,
  AIRadioStation,
  Player,
  Playlist,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { ref } from "vue";
import { toast } from "vue-sonner";

const stations = ref<AIRadioStation[]>([]);
const sections = ref<AIRadioSection[]>([]);
const players = ref<Player[]>([]);
const playlists = ref<Playlist[]>([]);
const stationTemplate = ref<AIRadioStation | null>(null);
const sectionTemplate = ref<AIRadioSection | null>(null);

const loadingStations = ref(false);
const loadingSections = ref(false);
const loadingTemplates = ref(false);
const loadingPlaylists = ref(false);
const loadingPlayers = ref(false);

const savingStation = ref(false);
const deletingStation = ref(false);
const savingSection = ref(false);
const deletingSection = ref(false);

const PLAYLIST_PAGE_SIZE = 200;
const PLAYLIST_FETCH_LIMIT = 5000;

const sortByName = <T extends { name: string }>(items: T[]): T[] => {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
};

async function loadStations(): Promise<AIRadioStation[]> {
  loadingStations.value = true;
  try {
    const result = await api.sendCommand<AIRadioStation[]>(
      "ai_radio/stations/list",
    );
    stations.value = sortByName(result || []);
    return stations.value;
  } finally {
    loadingStations.value = false;
  }
}

async function loadSections(): Promise<AIRadioSection[]> {
  loadingSections.value = true;
  try {
    const result = await api.sendCommand<AIRadioSection[]>(
      "ai_radio/sections/list",
    );
    sections.value = sortByName(result || []);
    return sections.value;
  } finally {
    loadingSections.value = false;
  }
}

async function loadTemplates(): Promise<void> {
  loadingTemplates.value = true;
  try {
    const [station, section] = await Promise.all([
      api.sendCommand<AIRadioStation>("ai_radio/stations/template"),
      api.sendCommand<AIRadioSection>("ai_radio/sections/template"),
    ]);
    stationTemplate.value = station;
    sectionTemplate.value = section;
  } finally {
    loadingTemplates.value = false;
  }
}

async function loadPlayers(): Promise<Player[]> {
  loadingPlayers.value = true;
  try {
    const result = await api.getPlayers();
    players.value = [...result].sort((a, b) => a.name.localeCompare(b.name));
    return players.value;
  } finally {
    loadingPlayers.value = false;
  }
}

async function loadPlaylists(): Promise<Playlist[]> {
  loadingPlaylists.value = true;
  try {
    // Load in pages to avoid truncating larger libraries.
    let offset = 0;
    let hasMore = true;
    const allItems: Playlist[] = [];
    while (hasMore && offset < PLAYLIST_FETCH_LIMIT) {
      const batch = await api.getLibraryPlaylists(
        undefined,
        undefined,
        PLAYLIST_PAGE_SIZE,
        offset,
      );
      allItems.push(...batch);
      hasMore = batch.length === PLAYLIST_PAGE_SIZE;
      offset += PLAYLIST_PAGE_SIZE;
    }
    if (hasMore) {
      toast.warning(
        $t("providers.ai_radio.toast.playlists_truncated", [
          PLAYLIST_FETCH_LIMIT,
        ]),
      );
    }
    playlists.value = sortByName(allItems);
    return playlists.value;
  } finally {
    loadingPlaylists.value = false;
  }
}

async function saveStation(station: AIRadioStation): Promise<AIRadioStation> {
  savingStation.value = true;
  try {
    const saved = await api.sendCommand<AIRadioStation>(
      "ai_radio/stations/save",
      {
        station,
      },
    );
    toast.success($t("providers.ai_radio.toast.station_saved"));
    await loadStations();
    return saved;
  } finally {
    savingStation.value = false;
  }
}

async function deleteStation(stationId: string): Promise<void> {
  deletingStation.value = true;
  try {
    await api.sendCommand("ai_radio/stations/delete", {
      station_id: stationId,
    });
    toast.success($t("providers.ai_radio.toast.station_deleted"));
    await loadStations();
  } finally {
    deletingStation.value = false;
  }
}

async function getStation(stationId: string): Promise<AIRadioStation> {
  return api.sendCommand<AIRadioStation>("ai_radio/stations/get", {
    station_id: stationId,
  });
}

async function validateStation(
  station: AIRadioStation,
): Promise<AIRadioStation> {
  return api.sendCommand<AIRadioStation>("ai_radio/stations/validate", {
    station,
  });
}

async function saveSection(section: AIRadioSection): Promise<AIRadioSection> {
  savingSection.value = true;
  try {
    const saved = await api.sendCommand<AIRadioSection>(
      "ai_radio/sections/save",
      {
        section,
      },
    );
    toast.success($t("providers.ai_radio.toast.section_saved"));
    await Promise.all([loadSections(), loadStations()]);
    return saved;
  } finally {
    savingSection.value = false;
  }
}

async function deleteSection(sectionId: string): Promise<void> {
  deletingSection.value = true;
  try {
    await api.sendCommand("ai_radio/sections/delete", {
      section_id: sectionId,
    });
    toast.success($t("providers.ai_radio.toast.section_deleted"));
    await Promise.all([loadSections(), loadStations()]);
  } finally {
    deletingSection.value = false;
  }
}

async function getSection(sectionId: string): Promise<AIRadioSection> {
  return api.sendCommand<AIRadioSection>("ai_radio/sections/get", {
    section_id: sectionId,
  });
}

async function refreshEditor(): Promise<void> {
  await Promise.all([
    loadStations(),
    loadSections(),
    loadTemplates(),
    loadPlayers(),
    loadPlaylists(),
  ]);
}

function createStationDraftFromTemplate(): AIRadioStation {
  if (stationTemplate.value) {
    return deepClone(stationTemplate.value);
  }
  return {
    id: "",
    name: "",
    source_playlist_id: "",
    source_playlist_provider: "library",
    target_playlist_provider: "builtin",
    default_player_id: "",
    max_duration_minutes: 0,
    dynamic_batch_size: 1,
    dynamic_poll_seconds: 5,
    dynamic_prefetch_remaining_tracks: 2,
    clear_queue_on_start: true,
    merge_section_id: "",
    section_ids: [],
    section_order: [],
    sections: [],
    general: {
      timezone: "UTC",
      location: { city: "", country: "" },
      instructions: "",
      weather_provider: "open_meteo",
      weather_timeout_seconds: 8,
    },
  };
}

function createSectionDraftFromTemplate(): AIRadioSection {
  if (sectionTemplate.value) {
    return deepClone(sectionTemplate.value);
  }
  return {
    id: "",
    name: "",
    type: "ai_text",
    web_search: "disabled",
    prompt: "",
    constraints: { max_chars: 0 },
  };
}

export function useAiRadioEditor() {
  return {
    stations,
    sections,
    players,
    playlists,
    stationTemplate,
    sectionTemplate,
    loadingStations,
    loadingSections,
    loadingTemplates,
    loadingPlaylists,
    loadingPlayers,
    savingStation,
    deletingStation,
    savingSection,
    deletingSection,
    loadStations,
    loadSections,
    loadTemplates,
    loadPlayers,
    loadPlaylists,
    saveStation,
    deleteStation,
    getStation,
    validateStation,
    saveSection,
    deleteSection,
    getSection,
    refreshEditor,
    createStationDraftFromTemplate,
    createSectionDraftFromTemplate,
  };
}
