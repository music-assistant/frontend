import { computed, onMounted, ref } from "vue";
import api from "@/plugins/api";
import { type DSPIRMetadata, EventType } from "@/plugins/api/interfaces";

interface DSPIRRegistryOptions {
  optional?: boolean;
}

// The IR library is server-wide, so the list is shared by every consumer: an
// upload from the DSP editor has to be visible to the stream details panel
// without either of them refetching.
const irs = ref<DSPIRMetadata[]>([]);
const available = ref<boolean>();
const irsById = computed(
  () => new Map(irs.value.map((ir) => [ir.ir_id, ir] as const)),
);
let generation = 0;
let subscribed = false;

// `suppressError` belongs to the caller that triggered the fetch, not to the
// shared list: a failure while the editor is open warrants the global error,
// the same failure behind the stream details panel does not.
const refresh = async (suppressError: boolean): Promise<void> => {
  const refreshGeneration = ++generation;
  try {
    const result = await api.getDSPIRs(suppressError);
    if (refreshGeneration !== generation) return;
    irs.value = result;
    available.value = true;
  } catch {
    if (refreshGeneration !== generation) return;
    irs.value = [];
    available.value = false;
  }
};

// An upload response is a complete record, so it can be listed before the
// refetch lands and the selection never points at an id the list lacks.
const addIR = (ir: DSPIRMetadata): void => {
  const index = irs.value.findIndex((item) => item.ir_id === ir.ir_id);
  if (index === -1) irs.value.push(ir);
  else irs.value[index] = ir;
  available.value = true;
};

// The event carries the library itself, so it replaces the list outright. It
// fires on every upload and removal, including ones made from another session.
// Servers without it never fire it; the fetch on mount covers those.
const subscribe = (): void => {
  if (subscribed) return;
  subscribed = true;
  api.subscribe(
    EventType.DSP_IRS_UPDATED,
    (event: { data: DSPIRMetadata[] }) => {
      generation += 1;
      irs.value = event.data;
      available.value = true;
    },
  );
};

const getIR = (irId: string | null | undefined) =>
  irId ? irsById.value.get(irId) : undefined;
const getIRName = (irId: string | null | undefined) => getIR(irId)?.name;

export function useDSPIRs(options: DSPIRRegistryOptions = {}) {
  const refreshForCaller = () => refresh(options.optional ?? false);

  subscribe();
  onMounted(() => {
    void refreshForCaller();
  });

  return {
    addIR,
    available,
    getIR,
    getIRName,
    irs,
    refresh: refreshForCaller,
  };
}
