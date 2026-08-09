import api from "@/plugins/api";
import type { AIRadioHost } from "@/plugins/api/interfaces";
import { ref } from "vue";

export interface AIRadioTtsEngine {
  uid: string;
  name: string;
}

const hosts = ref<AIRadioHost[]>([]);
const ttsEngines = ref<AIRadioTtsEngine[]>([]);
// queue_id -> host_id, for queues that currently have a DJ host assigned.
const queueDjStatus = ref<Record<string, string>>({});

const loadingHosts = ref(false);
const loadingTtsEngines = ref(false);
const loadingQueueDjStatus = ref(false);
const savingHost = ref(false);
// Host/queue id currently being deleted/assigned, so only that row reflects it.
const deletingHostId = ref("");
const settingQueueDjId = ref("");

const sortByName = <T extends { name: string }>(items: T[]): T[] => {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
};

async function loadHosts(): Promise<AIRadioHost[]> {
  loadingHosts.value = true;
  try {
    const result = await api.sendCommand<AIRadioHost[]>("ai_radio/hosts/list");
    hosts.value = sortByName(result || []);
    return hosts.value;
  } finally {
    loadingHosts.value = false;
  }
}

async function getHost(hostId: string): Promise<AIRadioHost> {
  return api.sendCommand<AIRadioHost>("ai_radio/hosts/get", {
    host_id: hostId,
  });
}

async function saveHost(host: AIRadioHost): Promise<AIRadioHost> {
  savingHost.value = true;
  try {
    const saved = await api.sendCommand<AIRadioHost>("ai_radio/hosts/save", {
      host,
    });
    await loadHosts();
    return saved;
  } finally {
    savingHost.value = false;
  }
}

async function deleteHost(hostId: string): Promise<void> {
  deletingHostId.value = hostId;
  try {
    await api.sendCommand("ai_radio/hosts/delete", { host_id: hostId });
    await loadHosts();
  } finally {
    deletingHostId.value = "";
  }
}

async function loadHostTemplate(): Promise<AIRadioHost> {
  return api.sendCommand<AIRadioHost>("ai_radio/hosts/template");
}

async function loadTtsEngines(): Promise<AIRadioTtsEngine[]> {
  loadingTtsEngines.value = true;
  try {
    const result = await api.sendCommand<AIRadioTtsEngine[]>(
      "ai_radio/engines/tts/list",
    );
    ttsEngines.value = result || [];
    return ttsEngines.value;
  } finally {
    loadingTtsEngines.value = false;
  }
}

/** Assigns (or, with hostId null, clears) the DJ host for a queue; returns the updated queue_id -> host_id map. */
async function setQueueDj(
  queueId: string,
  hostId: string | null,
): Promise<Record<string, string>> {
  settingQueueDjId.value = queueId;
  try {
    const result = await api.sendCommand<Record<string, string>>(
      "ai_radio/queue_dj/set",
      { queue_id: queueId, host_id: hostId },
    );
    queueDjStatus.value = result || {};
    return queueDjStatus.value;
  } finally {
    settingQueueDjId.value = "";
  }
}

async function loadQueueDjStatus(): Promise<Record<string, string>> {
  loadingQueueDjStatus.value = true;
  try {
    const result = await api.sendCommand<Record<string, string>>(
      "ai_radio/queue_dj/status",
    );
    queueDjStatus.value = result || {};
    return queueDjStatus.value;
  } finally {
    loadingQueueDjStatus.value = false;
  }
}

export function useHosts() {
  return {
    hosts,
    ttsEngines,
    queueDjStatus,
    loadingHosts,
    loadingTtsEngines,
    loadingQueueDjStatus,
    savingHost,
    deletingHostId,
    settingQueueDjId,
    loadHosts,
    getHost,
    saveHost,
    deleteHost,
    loadHostTemplate,
    loadTtsEngines,
    setQueueDj,
    loadQueueDjStatus,
  };
}
