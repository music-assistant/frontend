import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import api from "@/plugins/api";
import { type DSPConfigPreset, EventType } from "@/plugins/api/interfaces";

interface DSPPresetRegistryOptions {
  optional?: boolean;
}

export function useDSPPresets(options: DSPPresetRegistryOptions = {}) {
  const presets = ref<DSPConfigPreset[]>([]);
  const available = ref<boolean>();
  let generation = 0;
  const presetsById = computed(
    () =>
      new Map(
        presets.value.flatMap((preset) =>
          preset.preset_id ? [[preset.preset_id, preset] as const] : [],
        ),
      ),
  );

  const refresh = async (): Promise<void> => {
    const refreshGeneration = ++generation;
    try {
      const result = await api.getDSPPresets(options.optional);
      if (refreshGeneration !== generation) return;
      presets.value = result;
      available.value = true;
    } catch {
      if (refreshGeneration !== generation) return;
      presets.value = [];
      available.value = false;
    }
  };

  const unsubscribe = api.subscribe(
    EventType.DSP_PRESETS_UPDATED,
    (event: { data: DSPConfigPreset[] }) => {
      generation += 1;
      presets.value = event.data;
      available.value = true;
    },
  );

  onMounted(() => {
    void refresh();
  });
  onBeforeUnmount(unsubscribe);

  const getPresetName = (presetId: string | null | undefined) =>
    presetId ? presetsById.value.get(presetId)?.name : undefined;

  return {
    available,
    getPresetName,
    presets,
    refresh,
  };
}
