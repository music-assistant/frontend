<template>
  <section v-if="dsp">
    <div class="flex items-center gap-2 border-b px-4 py-2">
      <Switch
        v-model="dsp.enabled"
        :aria-label="dspToggleLabel"
        :title="dspToggleLabel"
      />
      <h2 class="min-w-0 flex-1 truncate text-base font-medium">
        {{ $t("settings.dsp.configure_on", { name: playerName }) }}
      </h2>
      <Badge
        v-if="selectedPresetLabel"
        :aria-label="selectedPresetLabel"
        :title="selectedPresetLabel"
        data-testid="selected-dsp-preset"
        class="max-w-24 md:max-w-48"
        variant="outline"
      >
        <span class="min-w-0 truncate">{{ selectedPresetLabel }}</span>
      </Badge>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="secondary">
            <Download />
            <span class="hidden md:inline">
              {{ $t("settings.dsp.presets.load") }}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          class="min-w-[max(8rem,var(--reka-dropdown-menu-trigger-width))]"
        >
          <DropdownMenuItem v-if="dspPresets.length === 0" disabled>
            {{ $t("settings.dsp.presets.empty_warning") }}
          </DropdownMenuItem>
          <DropdownMenuItem
            v-for="preset in dspPresets"
            v-else
            :key="preset.preset_id ?? undefined"
            class="justify-between gap-4"
            @click="loadPreset(preset)"
          >
            <span class="min-w-0 truncate">{{ preset.name }}</span>
            <!-- .stop keeps the click off the item, which would otherwise
                 select the preset and close the menu. -->
            <Button
              variant="ghost"
              size="icon-xs"
              :aria-label="`${$t('delete')}: ${preset.name}`"
              :title="`${$t('delete')}: ${preset.name}`"
              @click.stop="removePreset(preset.preset_id)"
            >
              <Trash2 />
            </Button>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button variant="secondary" @click="showSavePresetDialog = true">
        <Save />
        <span class="hidden md:inline">
          {{ $t("settings.dsp.presets.save") }}
        </span>
      </Button>
    </div>

    <div class="p-4">
      <div
        class="flex flex-nowrap gap-6"
        :class="{ 'justify-center': mobileLayout }"
      >
        <!-- Timeline Column -->
        <div
          v-if="!mobileLayout || selectedStage === null"
          class="shrink-0 grow-0 self-start"
          :class="{ 'border-r border-border pr-4': !mobileLayout }"
        >
          <DSPPipeline
            :dsp="dsp"
            :selected="selectedStage"
            @on-select="selectStage"
            @on-add-filter="showAddFilterDialog = true"
            @on-move-filter="(d) => moveFilter(d.index, d.direction)"
            @on-delete-filter="removeFilter"
          />
        </div>

        <!-- Filter Settings Panel -->
        <div v-if="selectedStage != null" class="min-w-0 flex-1">
          <!-- Toolbar of the selected item -->
          <div
            class="flex min-h-12 items-center gap-1 border-b bg-muted px-2 py-1.5"
          >
            <Button
              v-if="mobileLayout"
              variant="ghost"
              size="icon-sm"
              :aria-label="$t('back')"
              @click="selectedStage = null"
            >
              <ArrowLeft />
            </Button>
            <h3 class="min-w-0 flex-1 truncate px-2 font-medium">
              {{ stageTitle(selectedStage) }}
            </h3>
            <Button
              v-if="
                typeof selectedStage === 'number' &&
                !mobileLayout &&
                selectedStage > 0
              "
              variant="ghost"
              size="icon-sm"
              :aria-label="$t('settings.dsp.move_up')"
              @click="moveFilter(selectedStage, 'up')"
            >
              <ArrowUp />
            </Button>
            <Button
              v-if="
                typeof selectedStage === 'number' &&
                !mobileLayout &&
                selectedStage < dsp.filters.length - 1
              "
              variant="ghost"
              size="icon-sm"
              :aria-label="$t('settings.dsp.move_down')"
              @click="moveFilter(selectedStage, 'down')"
            >
              <ArrowDown />
            </Button>

            <Switch
              v-if="typeof selectedStage === 'number'"
              v-model="dsp.filters[selectedStage].enabled"
              :aria-label="selectedFilterToggleLabel"
              :title="selectedFilterToggleLabel"
              class="mx-2"
            />
            <Button
              v-if="typeof selectedStage === 'number'"
              variant="ghost"
              size="icon-sm"
              :aria-label="$t('settings.dsp.delete_filter')"
              @click="removeFilter(selectedStage)"
            >
              <Trash2 />
            </Button>
          </div>

          <!-- Settings of the Input stage -->
          <div v-if="selectedStage === 'input'" class="bg-muted">
            <DSPSlider v-model="dsp.input_gain" type="gain" />
            <DSPHelp :text="$t('settings.dsp.input_gain_help')" />
          </div>

          <!-- Settings of the Output stage -->
          <div v-else-if="selectedStage === 'output'" class="bg-muted">
            <DSPSlider v-model="dsp.output_gain" type="gain" />
            <DSPHelp :text="$t('settings.dsp.output_gain_help')" />
          </div>

          <!-- Settings of the selected DSP Filter -->
          <div v-else class="bg-muted">
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
            <template
              v-else-if="dsp.filters[selectedStage].type === DSPFilterType.GAIN"
            >
              <DSPSlider
                v-model="(dsp.filters[selectedStage] as GainFilter).gain"
                type="gain"
              />
              <DSPHelp :text="$t('settings.dsp.gain.help')" />
            </template>
            <template
              v-else-if="
                dsp.filters[selectedStage].type === DSPFilterType.BALANCE
              "
            >
              <DSPSlider
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
              <DSPHelp :text="$t('settings.dsp.balance.help')" />
            </template>
            <DSPTranspose
              v-else-if="
                dsp.filters[selectedStage].type === DSPFilterType.TRANSPOSE
              "
              v-model="dsp.filters[selectedStage] as TransposeFilter"
            />
            <DSPSafetyLimiter
              v-else-if="
                dsp.filters[selectedStage].type === DSPFilterType.SAFETY_LIMITER
              "
              v-model="dsp.filters[selectedStage] as SafetyLimiterFilter"
            />
            <DSPCompressor
              v-else-if="
                dsp.filters[selectedStage].type === DSPFilterType.COMPRESSOR
              "
              v-model="dsp.filters[selectedStage] as CompressorFilter"
            />
            <DSPHighLowPass
              v-else-if="
                dsp.filters[selectedStage].type === DSPFilterType.HIGH_LOW_PASS
              "
              v-model="dsp.filters[selectedStage] as HighLowPassFilter"
            />
            <DSPConvolution
              v-else-if="
                dsp.filters[selectedStage].type === DSPFilterType.CONVOLUTION
              "
              v-model="dsp.filters[selectedStage] as ConvolutionFilter"
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
          </div>
        </div>
      </div>

      <Alert v-if="!dsp.enabled" variant="warning" class="mt-5">
        <TriangleAlert />
        <AlertDescription>
          {{ $t("settings.dsp.disabled_message") }}
        </AlertDescription>
      </Alert>
    </div>

    <!-- Save DSP Preset Dialog -->
    <Dialog v-model:open="showSavePresetDialog">
      <DialogContent class="sm:max-w-[360px]">
        <DialogHeader>
          <DialogTitle>{{ $t("settings.dsp.presets.save") }}</DialogTitle>
        </DialogHeader>
        <div class="grid gap-2">
          <Label for="dsp-preset-name">
            {{ $t("settings.dsp.presets.name") }}
          </Label>
          <Input
            id="dsp-preset-name"
            v-model="newPresetName"
            :placeholder="$t('settings.dsp.presets.name_placeholder')"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showSavePresetDialog = false">
            {{ $t("cancel") }}
          </Button>
          <Button :disabled="!newPresetName.trim()" @click="savePreset">
            {{ $t("settings.dsp.presets.save") }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Add Filter Dialog -->
    <Dialog v-model:open="showAddFilterDialog">
      <DialogContent class="sm:max-w-[360px]">
        <DialogHeader>
          <DialogTitle>{{ $t("settings.dsp.filter.add") }}</DialogTitle>
        </DialogHeader>
        <div class="grid gap-2">
          <Label for="dsp-filter-type">
            {{ $t("settings.dsp.filter.type") }}
          </Label>
          <Select
            :model-value="newFilterType"
            @update:model-value="
              (value) => (newFilterType = value as DSPFilterType)
            "
          >
            <SelectTrigger id="dsp-filter-type" class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="filterType in filterTypes"
                :key="filterType.value"
                :value="filterType.value"
              >
                {{ filterType.title }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showAddFilterDialog = false">
            {{ $t("cancel") }}
          </Button>
          <Button @click="addFilter">{{
            $t("settings.dsp.filter.add")
          }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, toRaw, watch, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import { api } from "@/plugins/api";
import { store } from "@/plugins/store";
import {
  DSPConfig,
  DSPConfigPreset,
  ParametricEQBandType,
  DSPFilter,
  DSPFilterType,
  type GainFilter,
  type BalanceFilter,
  type TransposeFilter,
  type ConvolutionFilter,
  type StereoWidthFilter,
  type CrossfeedFilter,
  ParametricEQFilter,
  ToneControlFilter,
  type SafetyLimiterFilter,
  type CompressorFilter,
  type HighLowPassFilter,
  HighLowPassMode,
  EventType,
} from "@/plugins/api/interfaces";
import { getPlayerName } from "@/helpers/utils";
import DSPPipeline from "@/components/dsp/DSPPipeline.vue";
import DSPSlider from "@/components/dsp/DSPSlider.vue";
import DSPParametricEQ from "@/components/dsp/DSPParametricEQ.vue";
import DSPToneControl from "@/components/dsp/DSPToneControl.vue";
import DSPTranspose from "@/components/dsp/DSPTranspose.vue";
import DSPSafetyLimiter from "@/components/dsp/DSPSafetyLimiter.vue";
import DSPCompressor from "@/components/dsp/DSPCompressor.vue";
import DSPHighLowPass from "@/components/dsp/DSPHighLowPass.vue";
import DSPConvolution from "@/components/dsp/DSPConvolution.vue";
import DSPStereoWidth from "@/components/dsp/DSPStereoWidth.vue";
import DSPCrossfeed from "@/components/dsp/DSPCrossfeed.vue";
import { COMPRESSOR_PRESETS } from "@/components/dsp/compressorPresets";
import { DEFAULT_HIGH_PASS_FREQUENCY } from "@/components/dsp/highLowPass";
import DSPHelp from "@/components/dsp/DSPHelp.vue";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Download,
  Save,
  Trash2,
  TriangleAlert,
} from "@lucide/vue";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { useDSPPresets } from "@/composables/useDSPPresets";
import {
  areDSPConfigsEqual,
  dspFilterTypeLabel,
  sanitizeDSPPresetConfig,
} from "@/helpers/audioProcessing";

const { t } = useI18n();

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
// The app's own definition of a mobile layout, which also covers tablets and
// the force-mobile setting, rather than Vuetify's width-only breakpoint.
const mobileLayout = computed(() => store.mobileLayout);
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

const filterTypes = Object.values(DSPFilterType)
  .map((value) => {
    return {
      value: value,
      title: t(`settings.dsp.types.${value}`),
    };
  })
  .sort((a, b) => a.title.localeCompare(b.title));
const selectedPresetLabel = computed(() => {
  const presetId = dsp.value?.preset_id;
  if (!presetId) return undefined;
  const presetName =
    getPresetName(presetId) ?? t("settings.dsp.presets.custom");
  return t("settings.dsp.presets.selected", [presetName]);
});

// Methods
const selectStage = (index: number | "input" | "output") => {
  selectedStage.value = index;
};

const stageTitle = (index: number | "input" | "output") => {
  if (index === "input") return t("settings.dsp.input");
  if (index === "output") return t("settings.dsp.output");
  const filter = dsp.value?.filters[index];
  return filter ? dspFilterTypeLabel(filter) : "";
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
    case DSPFilterType.TRANSPOSE:
      filter = {
        enabled: true,
        type: DSPFilterType.TRANSPOSE,
        semitones: 0,
      };
      break;
    case DSPFilterType.SAFETY_LIMITER:
      filter = {
        enabled: true,
        type: DSPFilterType.SAFETY_LIMITER,
        ceiling: -2.0,
      };
      break;
    case DSPFilterType.COMPRESSOR:
      // Start from the Light preset so a new compressor opens in Basic mode.
      filter = {
        enabled: true,
        type: DSPFilterType.COMPRESSOR,
        ...COMPRESSOR_PRESETS.light,
      };
      break;
    case DSPFilterType.HIGH_LOW_PASS:
      filter = {
        enabled: true,
        type: DSPFilterType.HIGH_LOW_PASS,
        mode: HighLowPassMode.HIGH_PASS,
        frequency: DEFAULT_HIGH_PASS_FREQUENCY,
        slope: 12,
      };
      break;
    case DSPFilterType.CONVOLUTION:
      // An empty ir_id is valid: the filter is added first, the impulse
      // response picked afterwards.
      filter = {
        enabled: true,
        type: DSPFilterType.CONVOLUTION,
        ir_id: "",
        gain: 0,
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

const removePreset = async (presetId?: string | null) => {
  if (!presetId || !confirm(t("settings.dsp.presets.remove_confirm"))) return;

  await api.removeDSPPreset(presetId);
};

// Watchers

watch(
  mobileLayout,
  (isMobile) => {
    if (!isMobile && selectedStage.value === null) {
      selectStage("input");
    }
  },
  { immediate: true },
);
const playerName = computed(() =>
  getPlayerName(api.players[props.playerId!], 27),
);
// Stable names: the switch's checked state already conveys on/off, so the
// accessible name identifies what the switch controls.
const dspToggleLabel = computed(() => `DSP: ${playerName.value}`);
const selectedFilterToggleLabel = computed(() => {
  if (typeof selectedStage.value !== "number") {
    return t("settings.enable");
  }
  return stageTitle(selectedStage.value);
});

watch(
  () => props.playerId,
  async (val) => {
    if (unsubPlayerDSP) unsubPlayerDSP();
    flushScheduledManualSave();
    pendingPresetApply = undefined;
    localConfigGeneration += 1;
    const loadRequestId = ++playerLoadRequestId;
    clearServerDSPConfig();
    selectedStage.value = mobileLayout.value ? null : "input";
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
