<template>
  <section v-if="dsp">
    <!-- Toolbar -->
    <div class="flex items-center gap-2 border-b px-4 py-2">
      <Switch
        :model-value="dsp.enabled"
        @update:model-value="dsp.enabled = $event"
      />
      <span class="flex-1 text-sm font-medium truncate">{{
        $t("settings.dsp.configure_on", { name: playerName })
      }}</span>

      <!-- Load Preset Menu -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="secondary" size="sm">
            <Download class="size-4 md:-ml-1 md:mr-2" />
            <span class="hidden md:inline">
              {{ $t("settings.dsp.presets.load") }}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <div v-if="dspPresets.length === 0" class="px-3 py-2 text-sm text-muted-foreground">
            {{ $t("settings.dsp.presets.empty_warning") }}
          </div>
          <DropdownMenuItem
            v-for="preset in dspPresets"
            v-else
            :key="preset.preset_id"
            class="flex items-center justify-between"
            @click="loadPreset(preset)"
          >
            <span>{{ preset.name }}</span>
            <button
              class="ml-4 p-1 rounded-sm hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
              @click.stop="removePreset(preset.preset_id)"
            >
              <Trash2 class="size-4" />
            </button>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <!-- Save Preset Button -->
      <Button variant="secondary" size="sm" @click="showSavePresetDialog = true">
        <Save class="size-4 md:-ml-1 md:mr-2" />
        <span class="hidden md:inline">
          {{ $t("settings.dsp.presets.save") }}
        </span>
      </Button>
    </div>

    <div class="p-4">
      <!-- Disabled message -->
      <div v-if="!dsp.enabled" class="rounded-md border border-blue-500/20 bg-blue-500/5 p-4 mt-4 text-sm text-muted-foreground">
        {{ $t("settings.dsp.disabled_message") }}
      </div>

      <div class="flex flex-nowrap" :class="{ 'justify-center': mobile }">
        <!-- Timeline Column -->
        <div
          v-if="!mobile || selectedStage === null"
          class="shrink-0 grow-0"
          :class="{ 'border-r pr-4': !mobile }"
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
        <div v-if="selectedStage != null" class="flex-1 min-w-0">
          <!-- Toolbar of the selected item -->
          <div
            class="flex items-center gap-1 border-b px-2 py-1"
            :class="isDark ? 'bg-card' : 'bg-muted/30'"
          >
            <Button
              v-if="mobile"
              variant="ghost"
              size="icon"
              @click="selectedStage = null"
            >
              <ArrowLeft class="size-5" />
            </Button>
            <span class="flex-1 text-sm font-medium truncate">{{ stageTitle(selectedStage) }}</span>
            <Button
              v-if="
                typeof selectedStage === 'number' &&
                !mobile &&
                selectedStage > 0
              "
              variant="ghost"
              size="icon"
              @click="moveFilter(selectedStage, 'up')"
            >
              <ArrowUp class="size-5" />
            </Button>
            <Button
              v-if="
                typeof selectedStage === 'number' &&
                !mobile &&
                selectedStage < dsp.filters.length - 1
              "
              variant="ghost"
              size="icon"
              @click="moveFilter(selectedStage, 'down')"
            >
              <ArrowDown class="size-5" />
            </Button>

            <Switch
              v-if="typeof selectedStage === 'number'"
              :model-value="dsp.filters[selectedStage].enabled"
              class="mr-2"
              @update:model-value="dsp.filters[selectedStage].enabled = $event"
            />
            <Button
              v-if="typeof selectedStage === 'number'"
              variant="ghost"
              size="icon"
              @click="removeFilter(selectedStage)"
            >
              <Trash2 class="size-5" />
            </Button>
          </div>

          <!-- Settings of the Input stage -->
          <div
            v-if="selectedStage === 'input'"
            :class="isDark ? 'bg-card' : 'bg-muted/30'"
          >
            <DSPSlider v-model="dsp.input_gain" type="gain" />
          </div>

          <!-- Settings of the Output stage -->
          <div
            v-else-if="selectedStage === 'output'"
            :class="isDark ? 'bg-card' : 'bg-muted/30'"
          >
            <DSPSlider v-model="dsp.output_gain" type="gain" />
          </div>

          <!-- Settings of the selected DSP Filter -->
          <div
            v-else
            :class="isDark ? 'bg-card' : 'bg-muted/30'"
          >
            <DSPParametricEQ
              v-if="
                dsp.filters[selectedStage].type === DSPFilterType.PARAMETRIC_EQ
              "
              v-model="dsp.filters[selectedStage] as ParametricEQFilter"
            />
            <DSPToneControl
              v-if="
                dsp.filters[selectedStage].type === DSPFilterType.TONE_CONTROL
              "
              v-model="dsp.filters[selectedStage] as ToneControlFilter"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Save DSP Preset Dialog -->
    <Dialog :open="showSavePresetDialog" @update:open="showSavePresetDialog = $event">
      <DialogContent class="max-w-sm">
        <DialogHeader>
          <DialogTitle>{{ $t("settings.dsp.presets.save") }}</DialogTitle>
          <DialogDescription class="sr-only">{{ $t('aria.save_dsp_preset') }}</DialogDescription>
        </DialogHeader>
        <div class="space-y-2 py-2">
          <Input
            v-model="newPresetName"
            :placeholder="$t('settings.dsp.presets.name_placeholder')"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showSavePresetDialog = false">
            {{ $t("cancel") }}
          </Button>
          <Button
            :disabled="!newPresetName.trim()"
            @click="savePreset"
          >
            {{ $t("settings.dsp.presets.save") }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Add Filter Dialog -->
    <Dialog :open="showAddFilterDialog" @update:open="showAddFilterDialog = $event">
      <DialogContent class="max-w-sm">
        <DialogHeader>
          <DialogTitle>{{ $t("settings.dsp.filter.add") }}</DialogTitle>
          <DialogDescription class="sr-only">{{ $t('aria.add_dsp_filter') }}</DialogDescription>
        </DialogHeader>
        <div class="space-y-2 py-2">
          <Select
            :model-value="newFilterType"
            @update:model-value="newFilterType = $event as DSPFilterType"
          >
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="ft in filterTypes"
                :key="ft.value"
                :value="ft.value"
              >
                {{ ft.title }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showAddFilterDialog = false">
            {{ $t("cancel") }}
          </Button>
          <Button @click="addFilter">
            {{ $t("settings.dsp.filter.add") }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>
</template>

<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  onBeforeUnmount,
  onMounted,
} from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useBreakpoint } from "@/composables/useBreakpoint";
import { useIsDark } from "@/composables/useIsDark";
import { api } from "@/plugins/api";
import {
  DSPConfig,
  DSPConfigPreset,
  ParametricEQBandType,
  DSPFilter,
  DSPFilterType,
  ParametricEQFilter,
  ToneControlFilter,
  EventType,
} from "@/plugins/api/interfaces";
import { getPlayerName } from "@/helpers/utils";
import DSPPipeline from "@/components/dsp/DSPPipeline.vue";
import DSPSlider from "@/components/dsp/DSPSlider.vue";
import DSPParametricEQ from "@/components/dsp/DSPParametricEQ.vue";
import DSPToneControl from "@/components/dsp/DSPToneControl.vue";
import Button from "@/components/Button.vue";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Download,
  Save,
  Trash2,
} from "lucide-vue-next";

const { t } = useI18n();
const router = useRouter();
const isDark = useIsDark();
const { mobile } = useBreakpoint();

const props = defineProps<{
  playerId?: string;
}>();

const dsp = ref<DSPConfig>();
const dspPresets = ref<DSPConfigPreset[]>([]);
const selectedStage = ref<number | null | "input" | "output">(null);
const showAddFilterDialog = ref(false);
const showSavePresetDialog = ref(false);
const newFilterType = ref(DSPFilterType.PARAMETRIC_EQ);
const newPresetName = ref("");
const windowWidth = ref(window.innerWidth);
let updatedFromServer = false;

let unsubPlayerDSP: (() => void) | undefined = undefined;

const filterTypes = Object.values(DSPFilterType).map((value) => {
  return {
    value: value,
    title: t(`settings.dsp.types.${value}`),
  };
});

// Methods

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
  if (!preset || !preset.config) return;

  selectedStage.value = "input";
  // Deep copy the preset config to avoid reference issues
  dsp.value = preset.config;
};

const savePreset = async () => {
  if (!dsp.value || !newPresetName.value.trim()) return;

  const preset: DSPConfigPreset = {
    name: newPresetName.value.trim(),
    config: dsp.value,
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
  dspPresets.value = dspPresets.value.filter((p) => p.preset_id !== presetId);
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
    // Don't overwrite the config for the newly selected player
    updatedFromServer = true;
    if (val) {
      dsp.value = await api.getDSPConfig(val);
    }
    unsubPlayerDSP = api.subscribe(
      EventType.PLAYER_DSP_CONFIG_UPDATED,
      (evt: { data: DSPConfig }) => {
        updatedFromServer = true;
        dsp.value = evt.data;
      },
      props.playerId,
    );
  },
  { immediate: true },
);

const unsubDSPPresets = api.subscribe(
  EventType.DSP_PRESETS_UPDATED,
  (evt: { data: DSPConfigPreset[] }) => {
    dspPresets.value = evt.data;
  },
);

onMounted(async () => {
  dspPresets.value = await api.getDSPPresets();
});

onBeforeUnmount(() => {
  if (unsubPlayerDSP) unsubPlayerDSP();
  unsubDSPPresets();
});

// Debounced save, to prevent too many requests, but still be responsive
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
const debouncedSave = (newVal: DSPConfig) => {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    if (props.playerId) {
      await api.saveDSPConfig(props.playerId, newVal);
    }
  }, 2000);
};

watch(
  dsp,
  (newVal, oldVal) => {
    if (updatedFromServer) {
      // Skip resending, since we just got the config
      if (saveTimeout) clearTimeout(saveTimeout);
      updatedFromServer = false;
      return;
    }
    if (oldVal === null) return; // We haven't changed anything yet
    if (newVal) debouncedSave(newVal);
  },
  { deep: true },
);
</script>
