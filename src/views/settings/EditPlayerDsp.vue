<template>
  <section v-if="dsp">
    <v-toolbar color="transparent" class="border-b">
      <v-switch
        v-model="dsp.enabled"
        hide-details
        color="primary"
        class="pl-4"
      />
      <v-toolbar-title>{{
        $t("settings.dsp.configure_on", { name: playerName })
      }}</v-toolbar-title>
    </v-toolbar>

    <v-container class="pa-4">
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
            <v-card-item>
              <v-checkbox
                v-model="dsp.output_limiter"
                :label="$t('settings.dsp.enable_output_limiter')"
                hide-details
              />
            </v-card-item>
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
              v-if="
                dsp.filters[selectedStage].type === DSPFilterType.TONE_CONTROL
              "
              v-model="dsp.filters[selectedStage] as ToneControlFilter"
            />
          </v-card>
        </v-col>
      </v-row>
    </v-container>

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
import { ref, computed, watch, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useDisplay } from "vuetify";
import { api } from "@/plugins/api";
import {
  DSPConfig,
  ParametricEQBandType,
  DSPFilter,
  DSPFilterType,
  ParametricEQFilter,
  ToneControlFilter,
} from "@/plugins/api/interfaces";
import { getPlayerName } from "@/helpers/utils";
import DSPPipeline from "@/components/dsp/DSPPipeline.vue";
import DSPSlider from "@/components/dsp/DSPSlider.vue";
import DSPParametricEQ from "@/components/dsp/DSPParametricEQ.vue";
import DSPToneControl from "@/components/dsp/DSPToneControl.vue";

const { t } = useI18n();
const router = useRouter();

const props = defineProps<{
  playerId?: string;
}>();

const dsp = ref<DSPConfig>();
const selectedStage = ref<number | null | "input" | "output">(null);
const showAddFilterDialog = ref(false);
const newFilterType = ref(DSPFilterType.PARAMETRIC_EQ);
const windowWidth = ref(window.innerWidth);
const { mobile } = useDisplay();

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
    if (val) {
      dsp.value = await api.getDSPConfig(val);
    }
  },
  { immediate: true },
);

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
  (old_val, newVal) => {
    if (old_val === null) return; // We haven't changed anything yet
    if (newVal) debouncedSave(newVal);
  },
  { deep: true },
);
</script>
