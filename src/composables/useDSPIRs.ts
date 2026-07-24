import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import api from "@/plugins/api";
import {
  type DSPConfig,
  DSPFilterType,
  type DSPIRMetadata,
  EventType,
} from "@/plugins/api/interfaces";

interface DSPIRRegistryOptions {
  optional?: boolean;
}

export function useDSPIRs(options: DSPIRRegistryOptions = {}) {
  const irs = ref<DSPIRMetadata[]>([]);
  const available = ref<boolean>();
  let generation = 0;
  const irsById = computed(
    () => new Map(irs.value.map((ir) => [ir.ir_id, ir] as const)),
  );

  const refresh = async (): Promise<void> => {
    const refreshGeneration = ++generation;
    try {
      const result = await api.getDSPIRs(options.optional);
      if (refreshGeneration !== generation) return;
      irs.value = result;
      available.value = true;
    } catch {
      if (refreshGeneration !== generation) return;
      irs.value = [];
      available.value = false;
    }
  };

  // Removing an IR blanks the ir_id of every convolution filter that used it,
  // so a config arriving with an unselected convolution filter is the signal
  // that our list may be stale. Refreshing on every DSP update would refetch on
  // each slider save instead.
  const unsubscribe = api.subscribe(
    EventType.PLAYER_DSP_CONFIG_UPDATED,
    (event: { data: DSPConfig }) => {
      const hasUnselected = event.data.filters?.some(
        (filter) =>
          filter.type === DSPFilterType.CONVOLUTION && filter.ir_id === "",
      );
      if (hasUnselected) void refresh();
    },
  );

  onMounted(() => {
    void refresh();
  });
  onBeforeUnmount(unsubscribe);

  const getIR = (irId: string | null | undefined) =>
    irId ? irsById.value.get(irId) : undefined;
  const getIRName = (irId: string | null | undefined) => getIR(irId)?.name;

  return {
    available,
    getIR,
    getIRName,
    irs,
    refresh,
  };
}
