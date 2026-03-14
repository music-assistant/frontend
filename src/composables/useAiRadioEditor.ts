import api from "@/plugins/api";
import type {
  AIRadioSection,
  AIRadioStation,
  Player,
  Playlist,
} from "@/plugins/api/interfaces";
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

const deepClone = <T>(value: T): T => {
  return JSON.parse(JSON.stringify(value)) as T;
};

const sortByName = <T extends { name: string }>(items: T[]): T[] => {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
};

async function loadStations(silent = false): Promise<AIRadioStation[]> {
  loadingStations.value = true;
  try {
    const result = await api.sendCommand<AIRadioStation[]>("ai_radio/stations/list");
    stations.value = sortByName(result || []);
    if (!silent) {
      toast.success("AI Radio stations loaded");
    }
    return stations.value;
  } catch (error) {
    if (!silent) {
      toast.error("Failed to load AI Radio stations");
    }
    throw error;
  } finally {
    loadingStations.value = false;
  }
}

async function loadSections(silent = false): Promise<AIRadioSection[]> {
  loadingSections.value = true;
  try {
    const result = await api.sendCommand<AIRadioSection[]>("ai_radio/sections/list");
    sections.value = sortByName(result || []);
    if (!silent) {
      toast.success("AI Radio sections loaded");
    }
    return sections.value;
  } catch (error) {
    if (!silent) {
      toast.error("Failed to load AI Radio sections");
    }
    throw error;
  } finally {
    loadingSections.value = false;
  }
}

async function loadTemplates(silent = false): Promise<void> {
  loadingTemplates.value = true;
  try {
    const [station, section] = await Promise.all([
      api.sendCommand<AIRadioStation>("ai_radio/stations/template"),
      api.sendCommand<AIRadioSection>("ai_radio/sections/template"),
    ]);
    stationTemplate.value = station;
    sectionTemplate.value = section;
    if (!silent) {
      toast.success("AI Radio templates loaded");
    }
  } catch (error) {
    if (!silent) {
      toast.error("Failed to load AI Radio templates");
    }
    throw error;
  } finally {
    loadingTemplates.value = false;
  }
}

async function loadPlayers(silent = false): Promise<Player[]> {
  loadingPlayers.value = true;
  try {
    const result = await api.getPlayers();
    players.value = [...result].sort((a, b) => a.name.localeCompare(b.name));
    if (!silent) {
      toast.success("Players loaded");
    }
    return players.value;
  } catch (error) {
    if (!silent) {
      toast.error("Failed to load players");
    }
    throw error;
  } finally {
    loadingPlayers.value = false;
  }
}

async function loadPlaylists(silent = false): Promise<Playlist[]> {
  loadingPlaylists.value = true;
  try {
    // Load in pages to avoid truncating larger libraries.
    const limit = 200;
    let offset = 0;
    const allItems: Playlist[] = [];
    while (true) {
      const batch = await api.getLibraryPlaylists(
        undefined,
        undefined,
        limit,
        offset,
      );
      allItems.push(...batch);
      if (batch.length < limit) {
        break;
      }
      offset += limit;
      if (offset >= 5000) {
        break;
      }
    }
    playlists.value = sortByName(allItems);
    if (!silent) {
      toast.success("Playlists loaded");
    }
    return playlists.value;
  } catch (error) {
    if (!silent) {
      toast.error("Failed to load playlists");
    }
    throw error;
  } finally {
    loadingPlaylists.value = false;
  }
}

async function saveStation(station: AIRadioStation): Promise<AIRadioStation> {
  savingStation.value = true;
  try {
    const saved = await api.sendCommand<AIRadioStation>("ai_radio/stations/save", {
      station,
    });
    toast.success("Station saved");
    await loadStations(true);
    return saved;
  } catch (error) {
    toast.error("Failed to save station");
    throw error;
  } finally {
    savingStation.value = false;
  }
}

async function deleteStation(stationId: string): Promise<void> {
  deletingStation.value = true;
  try {
    await api.sendCommand("ai_radio/stations/delete", { station_id: stationId });
    toast.success("Station deleted");
    await loadStations(true);
  } catch (error) {
    toast.error("Failed to delete station");
    throw error;
  } finally {
    deletingStation.value = false;
  }
}

async function getStation(stationId: string): Promise<AIRadioStation> {
  return api.sendCommand<AIRadioStation>("ai_radio/stations/get", {
    station_id: stationId,
  });
}

async function validateStation(station: AIRadioStation): Promise<AIRadioStation> {
  return api.sendCommand<AIRadioStation>("ai_radio/stations/validate", {
    station,
  });
}

async function saveSection(section: AIRadioSection): Promise<AIRadioSection> {
  savingSection.value = true;
  try {
    const saved = await api.sendCommand<AIRadioSection>("ai_radio/sections/save", {
      section,
    });
    toast.success("Section saved");
    await Promise.all([loadSections(true), loadStations(true)]);
    return saved;
  } catch (error) {
    toast.error("Failed to save section");
    throw error;
  } finally {
    savingSection.value = false;
  }
}

async function deleteSection(sectionId: string): Promise<void> {
  deletingSection.value = true;
  try {
    await api.sendCommand("ai_radio/sections/delete", { section_id: sectionId });
    toast.success("Section deleted");
    await Promise.all([loadSections(true), loadStations(true)]);
  } catch (error) {
    toast.error("Failed to delete section");
    throw error;
  } finally {
    deletingSection.value = false;
  }
}

async function getSection(sectionId: string): Promise<AIRadioSection> {
  return api.sendCommand<AIRadioSection>("ai_radio/sections/get", {
    section_id: sectionId,
  });
}

async function refreshEditor(silent = false): Promise<void> {
  await Promise.all([
    loadStations(silent),
    loadSections(silent),
    loadTemplates(silent),
    loadPlayers(silent),
    loadPlaylists(silent),
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
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 1200,
      instructions: "",
      openai_base_url: "https://api.openai.com/v1",
      section_store_path: "ai_radio_sections",
      weather_provider: "open_meteo",
      weather_timeout_seconds: 8,
      tts_provider: "openai",
      openai_tts_model: "gpt-4o-mini-tts",
      openai_tts_voice: "ballad",
      openai_tts_instructions: "",
      elevenlabs_model: "eleven_flash_v2_5",
      elevenlabs_voice_id: "",
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
    deepClone,
  };
}
