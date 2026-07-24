<template>
  <section v-if="dsp">
    <v-toolbar color="transparent" class="border-b pr-4">
      <v-switch
        v-model="dsp.enabled"
        hide-details
        color="primary"
        class="pl-4"
      />
      <v-toolbar-title>{{
        $t("settings.dsp.configure_on", { name: playerName })
      }}</v-toolbar-title>
      <v-menu offset-y transition="slide-y-transition">
        <template #activator="{ props: menuProps }">
          <Badge
            v-if="selectedPresetLabel"
            :aria-label="selectedPresetLabel"
            :title="selectedPresetLabel"
            data-testid="selected-dsp-preset"
            class="mr-2 max-w-24 md:mr-4 md:max-w-48"
            variant="outline"
          >
            <span class="min-w-0 truncate">{{ selectedPresetLabel }}</span>
          </Badge>
          <v-btn v-bind="menuProps" class="mr-4" :class="getButtonClass()">
            <v-icon class="p-0 ms-md-n1 me-md-2"> mdi-tray-arrow-down </v-icon>
            <span class="d-none d-md-inline">
              {{ $t("settings.dsp.presets.load") }}
            </span>
          </v-btn>
        </template>
        <v-list>
          <v-list-item v-if="dspPresets.length === 0">
            <v-list-item-title>
              {{ $t("settings.dsp.presets.empty_warning") }}
            </v-list-item-title>
          </v-list-item>
          <v-list-item
            v-for="preset in dspPresets"
            v-else
            :key="preset.preset_id"
            @click="loadPreset(preset)"
          >
            <v-list-item-title>{{ preset.name }}</v-list-item-title>
            <template #append>
              <v-btn
                icon="mdi-delete"
                variant="text"
                density="compact"
                @click.stop="removePreset(preset.preset_id)"
              />
            </template>
          </v-list-item>
        </v-list>
      </v-menu>
      <v-btn :class="getButtonClass()" @click="showSavePresetDialog = true">
        <v-icon class="p-0 ms-md-n1 me-md-2"> mdi-content-save </v-icon>
        <span class="d-none d-md-inline">
          {{ $t("settings.dsp.presets.save") }}
        </span>
      </v-btn>
    </v-toolbar>

    <v-container fluid class="pa-4">
      <v-alert v-if="!dsp.enabled" type="info" class="mt-4" color="transparent">
        {{ $t("settings.dsp.disabled_message") }}
      </v-alert>
      <v-row :class="{ 'justify-center': mobile }" class="flex-nowrap">
        <!-- Timeline Column -->
        <v-col
          v-if="!mobile || selectedStage === null"
          class="flex-grow-0 flex-shrink-0"
          :class="{ 'border-e pr-4': !mobile }"
          align-self="start"
        >
          <DSPPipeline
            :dsp="dsp"
            :selected="selectedStage"
            @on-select="selectStage"
            @on-add-filter="showAddFilterDialog = true"
            @on-move-filter="(d) => moveFilter(d.index, d.direction)"
            @on-delete-filter="removeFilter"
          />
        </v-col>

        <!-- Filter Settings Panel -->
        <v-col v-if="selectedStage != null" style="min-width: 0">
          <!-- Toolbar of the selected item -->
          <v-toolbar
            density="compact"
            :color="$vuetify.theme.current.dark ? 'surface' : 'surface-light'"
            class="border-b"
          >
            <v-btn
              v-if="mobile"
              class="hidden-xs-only"
              icon
              @click="selectedStage = null"
            >
              <v-icon>mdi-arrow-left</v-icon>
            </v-btn>
            <v-toolbar-title>{{ stageTitle(selectedStage) }}</v-toolbar-title>
            <v-btn
              v-if="
                typeof selectedStage === 'number' &&
                !mobile &&
                selectedStage > 0
              "
              icon
              @click="moveFilter(selectedStage, 'up')"
            >
              <v-icon>mdi-arrow-up</v-icon>
            </v-btn>
            <v-btn
              v-if="
                typeof selectedStage === 'number' &&
                !mobile &&
                selectedStage < dsp.filters.length - 1
              "
              icon
              @click="moveFilter(selectedStage, 'down')"
            >
              <v-icon>mdi-arrow-down</v-icon>
            </v-btn>

            <v-switch
              v-if="typeof selectedStage === 'number'"
              v-model="dsp.filters[selectedStage].enabled"
              hide-details
              color="primary"
              class="mr-4"
            />
            <v-btn
              v-if="typeof selectedStage === 'number'"
              icon
              @click="removeFilter(selectedStage)"
            >
              <v-icon>mdi-delete</v-icon>
            </v-btn>
          </v-toolbar>

          <!-- Settings of the Input stage -->
          <v-card
            v-if="selectedStage === 'input'"
            flat
            :color="$vuetify.theme.current.dark ? 'surface' : 'surface-light'"
          >
            <DSPSlider v-model="dsp.input_gain" type="gain" />
          </v-card>

          <!-- Settings of the Output stage -->
          <v-card
            v-else-if="selectedStage === 'output'"
            flat
            :color="$vuetify.theme.current.dark ? 'surface' : 'surface-light'"
          >
            <DSPSlider v-model="dsp.output_gain" type="gain" />
          </v-card>

          <!-- Settings of the selected DSP Filter -->
          <v-card
            v-else
            flat
            :color="$vuetify.theme.current.dark ? 'surface' : 'surface-light'"
          >
            <DSPParametricEQ
              v-if="
                dsp.filters[selectedStage].type === DSPFilterType.PARAMETRIC_EQ
              "
              v-model="dsp.filters[selectedStage] as ParametricEQFilter"
            />
            <DSPToneControl
              v-else-if="
                dsp.filters[selectedStage].type === DSPFilterType.TONE_CONTROL
              "
              v-model="dsp.filters[selectedStage] as ToneControlFilter"
            />
            <DSPSlider
              v-else-if="dsp.filters[selectedStage].type === DSPFilterType.GAIN"
              v-model="(dsp.filters[selectedStage] as GainFilter).gain"
              type="gain"
            />
            <DSPSlider
              v-else-if="
                dsp.filters[selectedStage].type === DSPFilterType.BALANCE
              "
              v-model="(dsp.filters[selectedStage] as BalanceFilter).balance"
              :type="{
                min: -100,
                max: 100,
                step: 1,
                label: $t('settings.dsp.parameter.balance'),
                unit: '%',
                is_log: false,
              }"
            />
            <DSPStereoWidth
              v-else-if="
                dsp.filters[selectedStage].type === DSPFilterType.STEREO_WIDTH
              "
              v-model="dsp.filters[selectedStage] as StereoWidthFilter"
            />
            <DSPCrossfeed
              v-else-if="
                dsp.filters[selectedStage].type === DSPFilterType.CROSSFEED
              "
              v-model="dsp.filters[selectedStage] as CrossfeedFilter"
            />
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <!-- Save DSP Preset Dialog -->
    <v-dialog v-model="showSavePresetDialog" max-width="300">
      <v-card>
        <v-card-title>{{ $t("settings.dsp.presets.save") }}</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="newPresetName"
            :label="$t('settings.dsp.presets.name')"
            :placeholder="$t('settings.dsp.presets.name_placeholder')"
            variant="outlined"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showSavePresetDialog = false">
            {{ $t("cancel") }}
          </v-btn>
          <v-btn
            color="primary"
            :disabled="!newPresetName.trim()"
            @click="savePreset"
          >
            {{ $t("settings.dsp.presets.save") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Add Filter Dialog -->
    <v-dialog v-model="showAddFilterDialog" max-width="300">
      <v-card>
        <v-card-title>{{ $t("settings.dsp.filter.add") }}</v-card-title>
        <v-card-text>
          <v-select
            v-model="newFilterType"
            :items="filterTypes"
            :label="$t('settings.dsp.filter.type')"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showAddFilterDialog = false">{{ $t("cancel") }}</v-btn>
          <v-btn color="primary" @click="addFilter">{{
            $t("settings.dsp.filter.add")
          }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, toRaw, watch, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import { useDisplay, useTheme } from "vuetify";
import { api } from "@/plugins/api";
import {
  DSPConfig,
  DSPConfigPreset,
  ParametricEQBandType,
  DSPFilter,
  DSPFilterType,
  type GainFilter,
  type BalanceFilter,
  type StereoWidthFilter,
  type CrossfeedFilter,
  ParametricEQFilter,
  ToneControlFilter,
  EventType,
} from "@/plugins/api/interfaces";
import { getPlayerName } from "@/helpers/utils";
import DSPPipeline from "@/components/dsp/DSPPipeline.vue";
import DSPSlider from "@/components/dsp/DSPSlider.vue";
import DSPParametricEQ from "@/components/dsp/DSPParametricEQ.vue";
import DSPToneControl from "@/components/dsp/DSPToneControl.vue";
import DSPStereoWidth from "@/components/dsp/DSPStereoWidth.vue";
import DSPCrossfeed from "@/components/dsp/DSPCrossfeed.vue";
import { Badge } from "@/components/ui/badge";
import { useDSPPresets } from "@/composables/useDSPPresets";
import {
  areDSPConfigsEqual,
  sanitizeDSPPresetConfig,
} from "@/helpers/audioProcessing";

const { t } = useI18n();
const theme = useTheme();

const props = defineProps<{
  playerId?: string;
}>();

const dsp = ref<DSPConfig>();
const { getPresetName, presets: dspPresets } = useDSPPresets();
const selectedStage = ref<number | null | "input" | "output">(null);
const showAddFilterDialog = ref(false);
const showSavePresetDialog = ref(false);
const newFilterType = ref(DSPFilterType.PARAMETRIC_EQ);
const newPresetName = ref("");
const { mobile } = useDisplay();
let updatedFromServer = false;
let localConfigGeneration = 0;
let applyRequestId = 0;
let playerLoadRequestId = 0;
let manualSaveRequestId = 0;
let playerOperationVersion = 0;
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
interface ManualSaveContext {
  config: DSPConfig;
  generation: number;
  playerId: string;
  requestId: number;
}
const pendingManualSaves: ManualSaveContext[] = [];
let scheduledManualSave: ManualSaveContext | undefined;
interface PresetApplyContext {
  canceledManualSave?: ManualSaveContext;
  generation: number;
  operationVersion: number;
  playerId: string;
  presetId: string;
  requestId: number;
  serverGeneration: number;
}
const activePresetApplies = new Map<number, PresetApplyContext>();
const latestPlayerOperationVersions = new Map<string, number>();
let pendingPresetApply: PresetApplyContext | undefined;

let unsubPlayerDSP: (() => void) | undefined = undefined;

const filterTypes = Object.values(DSPFilterType).map((value) => {
  return {
    value: value,
    title: t(`settings.dsp.types.${value}`),
  };
});
const selectedPresetLabel = computed(() => {
  const presetId = dsp.value?.preset_id;
  if (!presetId) return undefined;
  const presetName =
    getPresetName(presetId) ?? t("settings.dsp.presets.custom");
  return t("settings.dsp.presets.selected", [presetName]);
});

// Methods
const getButtonClass = (): string => {
  return theme.global.current.value.dark
    ? "bg-grey-darken-3"
    : "bg-grey-lighten-3";
};

const selectStage = (index: number | "input" | "output") => {
  selectedStage.value = index;
};

const stageTitle = (index: number | "input" | "output") => {
  if (index === "input") return t("settings.dsp.input");
  if (index === "output") return t("settings.dsp.output");
  return t(`settings.dsp.types.${dsp.value?.filters[index].type}`);
};

const addFilter = () => {
  if (!dsp.value) return;

  let filter: DSPFilter;

  switch (newFilterType.value) {
    case DSPFilterType.PARAMETRIC_EQ:
      filter = {
        preamp: 0,
        per_channel_preamp: {},
        enabled: true,
        type: DSPFilterType.PARAMETRIC_EQ,
        bands: [],
      };
      break;
    case DSPFilterType.TONE_CONTROL:
      filter = {
        enabled: true,
        type: DSPFilterType.TONE_CONTROL,
        bass_level: 0,
        mid_level: 0,
        treble_level: 0,
      };
      break;
    case DSPFilterType.GAIN:
      filter = {
        enabled: true,
        type: DSPFilterType.GAIN,
        gain: 0,
      };
      break;
    case DSPFilterType.BALANCE:
      filter = {
        enabled: true,
        type: DSPFilterType.BALANCE,
        balance: 0,
      };
      break;
    case DSPFilterType.STEREO_WIDTH:
      filter = {
        enabled: true,
        type: DSPFilterType.STEREO_WIDTH,
        width: 1,
      };
      break;
    case DSPFilterType.CROSSFEED:
      filter = {
        enabled: true,
        type: DSPFilterType.CROSSFEED,
        strength: 0.2,
        soundstage: 0.5,
      };
      break;
    default:
      return;
  }

  dsp.value.filters.push(filter);
  showAddFilterDialog.value = false;
  selectStage(dsp.value.filters.length - 1); // Select the newly added filter
};

const moveFilter = (index: number, direction: "up" | "down") => {
  if (!dsp.value) return;

  const newIndex = direction === "up" ? index - 1 : index + 1;

  if (newIndex < 0 || newIndex >= dsp.value.filters.length) return;

  const [movedFilter] = dsp.value.filters.splice(index, 1);
  dsp.value.filters.splice(newIndex, 0, movedFilter);

  if (selectedStage.value === index) {
    selectedStage.value = newIndex;
  } else if (selectedStage.value === newIndex) {
    selectedStage.value = index;
  }
};

const removeFilter = (index: number) => {
  if (selectedStage.value === index) selectedStage.value = "input";
  dsp.value?.filters.splice(index, 1);
};

const loadPreset = async (preset: DSPConfigPreset) => {
  if (!preset.preset_id || !props.playerId) return;

  const carriedManualSave =
    pendingPresetApply?.playerId === props.playerId &&
    isLatestPlayerOperation(pendingPresetApply)
      ? pendingPresetApply.canceledManualSave
      : undefined;
  const canceledManualSave = scheduledManualSave ?? carriedManualSave;
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = null;
  scheduledManualSave = undefined;
  localConfigGeneration += 1;
  selectedStage.value = "input";
  const applyContext = {
    canceledManualSave,
    generation: localConfigGeneration,
    operationVersion: markPlayerOperation(props.playerId),
    playerId: props.playerId,
    presetId: preset.preset_id,
    requestId: ++applyRequestId,
    serverGeneration: playerLoadRequestId,
  };
  pendingPresetApply = applyContext;
  activePresetApplies.set(applyContext.requestId, applyContext);
  try {
    const config = await api.applyDSPPreset(
      applyContext.playerId,
      applyContext.presetId,
    );
    if (isCurrentPresetApply(applyContext)) {
      setServerDSPConfig(config, applyContext.playerId);
    }
  } catch {
    const isCurrentApply = isCurrentPresetApply(applyContext);
    if (
      applyContext.canceledManualSave &&
      isLatestPlayerOperation(applyContext)
    ) {
      if (isCurrentApply && dsp.value) {
        debouncedSave(dsp.value);
      } else {
        void saveManualDSPConfig(applyContext.canceledManualSave, false);
      }
    } else if (isCurrentApply) {
      await reloadDSPConfigAfterFailedApply(applyContext);
    }
  } finally {
    activePresetApplies.delete(applyContext.requestId);
    if (pendingPresetApply?.requestId === applyContext.requestId) {
      pendingPresetApply = undefined;
    }
  }
};

const savePreset = async () => {
  if (!dsp.value || !newPresetName.value.trim()) return;

  const preset: DSPConfigPreset = {
    name: newPresetName.value.trim(),
    config: sanitizeDSPPresetConfig(dsp.value),
  };

  try {
    await api.saveDSPPreset(preset);
    newPresetName.value = "";
    showSavePresetDialog.value = false;
  } catch (error) {
    console.error("Failed to save DSP preset:", error);
  }
};

const removePreset = async (presetId: string | undefined) => {
  if (!presetId || !confirm(t("settings.dsp.presets.remove_confirm"))) return;

  await api.removeDSPPreset(presetId);
};

// Watchers

watch(
  mobile,
  (mobile) => {
    if (!mobile && selectedStage.value === null) {
      selectStage("input");
    }
  },
  { immediate: true },
);
const playerName = computed(() =>
  getPlayerName(api.players[props.playerId!], 27),
);

watch(
  () => props.playerId,
  async (val) => {
    if (unsubPlayerDSP) unsubPlayerDSP();
    flushScheduledManualSave();
    pendingPresetApply = undefined;
    localConfigGeneration += 1;
    const loadRequestId = ++playerLoadRequestId;
    clearServerDSPConfig();
    selectedStage.value = mobile.value ? null : "input";
    // Don't overwrite the config for the newly selected player
    if (val) {
      unsubPlayerDSP = api.subscribe(
        EventType.PLAYER_DSP_CONFIG_UPDATED,
        (evt: { data: DSPConfig }) => {
          if (props.playerId !== val) return;
          const manualSave = takeMatchingManualSave(evt.data, val);
          if (
            manualSave &&
            (manualSave.playerId !== props.playerId ||
              manualSave.generation !== localConfigGeneration)
          ) {
            return;
          }
          if (shouldIgnorePlayerDSPUpdate(evt.data)) return;
          playerLoadRequestId += 1;
          setServerDSPConfig(evt.data, val);
        },
        val,
      );
      const config = await api.getDSPConfig(val);
      if (loadRequestId !== playerLoadRequestId || props.playerId !== val) {
        return;
      }
      setServerDSPConfig(config, val);
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (unsubPlayerDSP) unsubPlayerDSP();
  flushScheduledManualSave();
  localConfigGeneration += 1;
  playerLoadRequestId += 1;
  pendingPresetApply = undefined;
});

// Debounced save, to prevent too many requests, but still be responsive
const debouncedSave = (newVal: DSPConfig) => {
  const playerId = props.playerId;
  if (!playerId) return;
  if (saveTimeout) clearTimeout(saveTimeout);
  const saveContext = {
    config: structuredClone(toRaw(newVal)),
    generation: localConfigGeneration,
    playerId,
    requestId: ++manualSaveRequestId,
  };
  scheduledManualSave = saveContext;
  saveTimeout = setTimeout(() => {
    saveTimeout = null;
    if (scheduledManualSave?.requestId === saveContext.requestId) {
      scheduledManualSave = undefined;
      void saveManualDSPConfig(saveContext);
    }
  }, 2000);
};

watch(
  dsp,
  (newVal, oldVal) => {
    if (updatedFromServer) {
      // Skip resending, since we just got the config
      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = null;
      scheduledManualSave = undefined;
      updatedFromServer = false;
      return;
    }
    if (oldVal === null) return; // We haven't changed anything yet
    if (newVal) {
      localConfigGeneration += 1;
      if (props.playerId) markPlayerOperation(props.playerId);
      newVal.preset_id = null;
      debouncedSave(newVal);
    }
  },
  { deep: true },
);

function setServerDSPConfig(
  config: DSPConfig,
  playerId = props.playerId,
): void {
  if (playerId) markPlayerOperation(playerId);
  updatedFromServer = true;
  dsp.value = structuredClone(config);
}

function clearServerDSPConfig(): void {
  updatedFromServer = true;
  dsp.value = undefined;
}

function isCurrentPresetApply(
  applyContext: NonNullable<typeof pendingPresetApply>,
): boolean {
  return (
    pendingPresetApply?.requestId === applyContext.requestId &&
    props.playerId === applyContext.playerId &&
    localConfigGeneration === applyContext.generation &&
    playerLoadRequestId === applyContext.serverGeneration &&
    isLatestPlayerOperation(applyContext)
  );
}

function shouldIgnorePlayerDSPUpdate(config: DSPConfig): boolean {
  if (!config.preset_id) return false;
  const matchingApply = [...activePresetApplies.values()]
    .filter(
      (applyContext) =>
        applyContext.playerId === props.playerId &&
        applyContext.presetId === config.preset_id,
    )
    .sort((left, right) => right.requestId - left.requestId)[0];
  if (!matchingApply) return false;
  return (
    matchingApply.requestId !== pendingPresetApply?.requestId ||
    localConfigGeneration !== matchingApply.generation
  );
}

async function reloadDSPConfigAfterFailedApply(
  applyContext: PresetApplyContext,
): Promise<void> {
  const loadRequestId = playerLoadRequestId;
  try {
    const config = await api.getDSPConfig(applyContext.playerId);
    if (
      loadRequestId === playerLoadRequestId &&
      isCurrentPresetApply(applyContext)
    ) {
      setServerDSPConfig(config, applyContext.playerId);
    }
  } catch {
    // The API already surfaced the command failure.
  }
}

async function saveManualDSPConfig(
  saveContext: ManualSaveContext,
  requireCurrentContext = true,
): Promise<void> {
  if (
    requireCurrentContext &&
    (props.playerId !== saveContext.playerId ||
      localConfigGeneration !== saveContext.generation)
  ) {
    return;
  }
  pendingManualSaves.push(saveContext);
  try {
    await api.saveDSPConfig(saveContext.playerId, saveContext.config);
  } finally {
    const index = pendingManualSaves.findIndex(
      (pending) => pending.requestId === saveContext.requestId,
    );
    if (index !== -1) pendingManualSaves.splice(index, 1);
  }
}

function takeMatchingManualSave(
  config: DSPConfig,
  playerId: string,
): ManualSaveContext | undefined {
  const index = pendingManualSaves.findIndex(
    (pending) =>
      pending.playerId === playerId &&
      areDSPConfigsEqual(pending.config, config),
  );
  if (index === -1) return undefined;
  return pendingManualSaves.splice(index, 1)[0];
}

function flushScheduledManualSave(): void {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = null;
  const saveContext = scheduledManualSave;
  scheduledManualSave = undefined;
  if (saveContext) {
    void saveManualDSPConfig(saveContext, false);
  }
}

function markPlayerOperation(playerId: string): number {
  const version = ++playerOperationVersion;
  latestPlayerOperationVersions.set(playerId, version);
  return version;
}

function isLatestPlayerOperation(applyContext: PresetApplyContext): boolean {
  return (
    latestPlayerOperationVersions.get(applyContext.playerId) ===
    applyContext.operationVersion
  );
}
</script>
