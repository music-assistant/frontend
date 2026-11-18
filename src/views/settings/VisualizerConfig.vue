<!--
  MilkDrop visualizer page, reached from the Plugins section in the sidebar.

  Holds all per-user visualizer preferences (quality, presets, favourites,
  credits); changes apply immediately without a reload. Server-side
  operational settings live on the milkdrop_visualizer provider page.
-->
<template>
  <div class="space-y-6 p-6">
    <Card>
      <CardHeader>
        <div class="flex items-center gap-4">
          <div
            class="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10"
          >
            <Droplet class="size-6 text-primary" />
          </div>
          <div>
            <CardTitle>{{ $t("visualizer.title") }}</CardTitle>
            <CardDescription>
              {{ $t("settings.visualizer_description") }}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
    </Card>

    <Card v-if="!providerAvailable">
      <CardContent class="text-sm">
        {{ $t("visualizer.provider_missing") }}
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <div class="flex items-center gap-2">
          <SlidersHorizontal class="size-4 text-primary" />
          <CardTitle>{{ $t("visualizer.section_general") }}</CardTitle>
        </div>
      </CardHeader>
      <CardContent class="space-y-5">
        <div class="flex items-center justify-between gap-6">
          <div class="min-w-0">
            <div class="font-medium">
              {{ $t("settings.visualizer_enabled.label") }}
            </div>
            <div class="text-sm text-muted-foreground">
              {{ $t("settings.visualizer_enabled.description") }}
            </div>
          </div>
          <Switch
            :model-value="enabledPref"
            :aria-label="$t('settings.visualizer_enabled.label')"
            @update:model-value="
              (v: boolean) => setPref('visualizer_enabled', v)
            "
          />
        </div>

        <div
          class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
        >
          <div class="min-w-0">
            <div class="font-medium">{{ $t("visualizer.quality") }}</div>
            <div class="text-sm text-muted-foreground">
              {{ $t("visualizer.quality_description") }}
            </div>
          </div>
          <Select
            :model-value="qualityPref"
            @update:model-value="
              (v: unknown) => setPref('visualizer_quality', String(v))
            "
          >
            <SelectTrigger
              class="w-full shrink-0 sm:w-56"
              :aria-label="$t('visualizer.quality')"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="tier in QUALITY_TIERS"
                :key="tier"
                :value="tier"
              >
                {{ $t(`visualizer.quality_options.${tier}`) }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <VisualizerSliderRow
          :value="opacityPref"
          :default-value="VISUALIZER_OPACITY_DEFAULT"
          :label="$t('settings.visualizer_opacity.label')"
          :description="$t('settings.visualizer_opacity.description')"
          :min="10"
          :max="100"
          :step="5"
          unit="%"
          @commit="(v) => setPref('visualizer_opacity', v)"
        />

        <VisualizerSliderRow
          :value="blurPref"
          :default-value="VISUALIZER_BLUR_DEFAULT"
          :label="$t('settings.visualizer_blur.label')"
          :description="$t('settings.visualizer_blur.description')"
          :min="0"
          :max="30"
          :step="1"
          unit="px"
          @commit="(v) => setPref('visualizer_blur', v)"
        />

        <VisualizerSliderRow
          :value="paletteRampPref"
          :default-value="VISUALIZER_PALETTE_RAMP_DEFAULT"
          :label="$t('visualizer.palette_ramp')"
          :description="$t('visualizer.palette_ramp_description')"
          :min="0"
          :max="100"
          :step="VISUALIZER_PALETTE_RAMP_STEP"
          unit="%"
          @commit="(v) => setPref('visualizer_palette_ramp', v)"
        />
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <div class="flex items-center gap-2">
          <SwatchBook class="size-4 text-primary" />
          <CardTitle>{{ $t("visualizer.section_presets") }}</CardTitle>
        </div>
      </CardHeader>
      <CardContent class="space-y-5">
        <div
          class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
        >
          <div class="min-w-0">
            <div class="font-medium">{{ $t("visualizer.preset_mode") }}</div>
            <div class="text-sm text-muted-foreground">
              {{ $t("visualizer.preset_mode_description") }}
            </div>
          </div>
          <Select
            :model-value="presetModePref"
            @update:model-value="
              (v: unknown) => setPref('visualizer_preset_mode', String(v))
            "
          >
            <SelectTrigger
              class="w-full shrink-0 sm:w-56"
              :aria-label="$t('visualizer.preset_mode')"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="mode in PRESET_MODES"
                :key="mode"
                :value="mode"
              >
                {{ $t(`visualizer.preset_mode_options.${mode}`) }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div
          v-if="presetModePref === 'fixed'"
          class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
        >
          <div class="min-w-0 font-medium">
            {{ $t("visualizer.fixed_preset") }}
          </div>
          <Select
            :model-value="presetPref || undefined"
            @update:model-value="
              (v: unknown) => setPref('visualizer_preset', String(v))
            "
          >
            <SelectTrigger
              class="w-full shrink-0 sm:w-72"
              :aria-label="$t('visualizer.fixed_preset')"
            >
              <SelectValue :placeholder="$t('visualizer.preset_random')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="name in presetNames" :key="name" :value="name">
                {{ name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="flex items-center justify-between gap-6">
          <div class="min-w-0">
            <div class="font-medium">{{ $t("visualizer.palette_colors") }}</div>
            <div class="text-sm text-muted-foreground">
              {{ $t("visualizer.palette_colors_description") }}
            </div>
          </div>
          <Switch
            :model-value="paletteColorsPref"
            :aria-label="$t('visualizer.palette_colors')"
            @update:model-value="
              (v: boolean) => setPref('visualizer_palette_colors', v)
            "
          />
        </div>

        <div class="flex items-center justify-between gap-6">
          <div class="min-w-0">
            <div class="font-medium">{{ $t("visualizer.beat_switch") }}</div>
            <div class="text-sm text-muted-foreground">
              {{ $t("visualizer.beat_switch_description") }}
            </div>
          </div>
          <Switch
            :model-value="beatSwitchPref"
            :aria-label="$t('visualizer.beat_switch')"
            @update:model-value="
              (v: boolean) => setPref('visualizer_beat_switch', v)
            "
          />
        </div>

        <VisualizerSliderRow
          v-if="beatSwitchPref"
          :value="beatDwellPref"
          :default-value="30"
          :label="$t('visualizer.beat_dwell')"
          :description="$t('visualizer.beat_dwell_description')"
          :min="5"
          :max="120"
          :step="5"
          unit="s"
          @commit="(v) => setPref('visualizer_beat_dwell', v)"
        />
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <div class="flex items-center gap-2">
          <Star class="size-4 text-primary" />
          <CardTitle>{{ $t("visualizer.favorites") }}</CardTitle>
        </div>
        <CardDescription v-if="favoritesPref.length === 0">
          {{ $t("visualizer.no_favorites") }}
        </CardDescription>
      </CardHeader>
      <CardContent v-if="favoritesPref.length > 0">
        <ul class="space-y-1.5">
          <li
            v-for="name in favoritesPref"
            :key="name"
            class="flex items-center justify-between gap-3 rounded-md bg-muted px-3 py-1.5 text-sm"
          >
            <span class="truncate">{{ name }}</span>
            <button
              type="button"
              class="rounded p-1 hover:bg-background"
              :aria-label="$t('visualizer.remove_favorite')"
              @click="removeFavorite(name)"
            >
              <X :size="16" />
            </button>
          </li>
        </ul>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <div class="flex items-center gap-2">
          <Heart class="size-4 text-primary" />
          <CardTitle>{{ $t("visualizer.credits") }}</CardTitle>
        </div>
      </CardHeader>
      <CardContent class="space-y-2 text-sm text-muted-foreground">
        <p>
          {{ $t("visualizer.credits_butterchurn") }}
          <a
            href="https://github.com/jberg/butterchurn"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary underline"
            >github.com/jberg/butterchurn</a
          >
        </p>
        <p>{{ $t("visualizer.credits_milkdrop") }}</p>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  Droplet,
  Heart,
  SlidersHorizontal,
  Star,
  SwatchBook,
  X,
} from "@lucide/vue";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useUserPreferences } from "@/composables/userPreferences";
import {
  VISUALIZER_BLUR_DEFAULT,
  VISUALIZER_OPACITY_DEFAULT,
  VISUALIZER_PALETTE_COLORS_DEFAULT,
  VISUALIZER_PALETTE_RAMP_DEFAULT,
  VISUALIZER_PALETTE_RAMP_STEP,
} from "@/composables/visualizer/state";
import { expertModeSetting } from "@/helpers/expert_mode";
import { listPresetNames } from "@/helpers/visualizer/presetLibrary";
import {
  DEFAULT_QUALITY,
  QUALITY_PROFILES,
} from "@/helpers/visualizer/quality";
import { $t } from "@/plugins/i18n";
import { visualizerProviderAvailable } from "@/plugins/visualizer-relay";
import VisualizerSliderRow from "./VisualizerSliderRow.vue";

const QUALITY_TIERS = Object.keys(QUALITY_PROFILES);
const PRESET_MODES = ["random", "random_favorites", "fixed"];

const { getPreference, setPreference } = useUserPreferences();
const enabledPref = computed(() => expertModeSetting("visualizer_enabled"));
const qualityPref = getPreference<string>(
  "visualizer_quality",
  DEFAULT_QUALITY,
);
const opacityPref = getPreference(
  "visualizer_opacity",
  VISUALIZER_OPACITY_DEFAULT,
);
const blurPref = getPreference("visualizer_blur", VISUALIZER_BLUR_DEFAULT);
const presetModePref = getPreference<string>(
  "visualizer_preset_mode",
  "random",
);
const presetPref = getPreference("visualizer_preset", "");
const paletteColorsPref = getPreference(
  "visualizer_palette_colors",
  VISUALIZER_PALETTE_COLORS_DEFAULT,
);
const paletteRampPref = getPreference(
  "visualizer_palette_ramp",
  VISUALIZER_PALETTE_RAMP_DEFAULT,
);
const beatSwitchPref = getPreference("visualizer_beat_switch", false);
const beatDwellPref = getPreference("visualizer_beat_dwell", 30);
const favoritesPref = getPreference<string[]>("visualizer_favorites", []);

const providerAvailable = computed(() => visualizerProviderAvailable());
const presetNames = ref<string[]>([]);

onMounted(async () => {
  // Nothing to configure when the plugin is absent (the page shows a
  // "provider missing" notice), so skip the multi-MB preset download.
  if (providerAvailable.value) presetNames.value = await listPresetNames();
});

const setPref = (key: string, value: unknown) => {
  void setPreference(key, value);
};

const removeFavorite = (name: string) => {
  setPref(
    "visualizer_favorites",
    favoritesPref.value.filter((f) => f !== name),
  );
};
</script>
