import { computed, onMounted, ref } from "vue";
import api from "@/plugins/api";
import { type DSPIRMetadata, EventType } from "@/plugins/api/interfaces";

interface DSPIRRegistryOptions {
  optional?: boolean;
}

// The IR library is server-wide, so every caller shares one list.
const irs = ref<DSPIRMetadata[]>([]);
const available = ref<boolean>();
const irsById = computed(
  () => new Map(irs.value.map((ir) => [ir.ir_id, ir] as const)),
);
let generation = 0;
let subscribed = false;

// Whoever triggered the fetch decides whether a failure raises the global error.
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

// Upload responses are complete records, so a new IR can be listed at once.
const addIR = (ir: DSPIRMetadata): void => {
  const index = irs.value.findIndex((item) => item.ir_id === ir.ir_id);
  if (index === -1) irs.value.push(ir);
  else irs.value[index] = ir;
  available.value = true;
};

// The event carries the new library. Older servers never emit it, leaving the
// fetch on mount as the only refresh.
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
