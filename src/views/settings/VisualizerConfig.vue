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
            @update:model-value="
              (v: boolean) => setPref('visualizer_enabled', v)
            "
          />
        </div>

        <div class="flex items-center justify-between gap-6">
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
            <SelectTrigger class="w-56 shrink-0">
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

        <div class="flex items-center justify-between gap-6">
          <div class="min-w-0">
            <div class="font-medium">
              {{ $t("settings.visualizer_opacity.label") }}
            </div>
            <div class="text-sm text-muted-foreground">
              {{ $t("settings.visualizer_opacity.description") }}
            </div>
          </div>
          <div class="flex w-64 shrink-0 items-center gap-3">
            <Slider
              :model-value="[opacityPref]"
              :min="10"
              :max="100"
              :step="5"
              @update:model-value="
                (v: number[] | undefined) =>
                  setPref('visualizer_opacity', v?.[0] ?? 100)
              "
            />
            <span class="w-12 text-right text-sm tabular-nums"
              >{{ opacityPref }}%</span
            >
          </div>
        </div>

        <div class="flex items-center justify-between gap-6">
          <div class="min-w-0">
            <div class="font-medium">
              {{ $t("settings.visualizer_blur.label") }}
            </div>
            <div class="text-sm text-muted-foreground">
              {{ $t("settings.visualizer_blur.description") }}
            </div>
          </div>
          <div class="flex w-64 shrink-0 items-center gap-3">
            <Slider
              :model-value="[blurPref]"
              :min="0"
              :max="30"
              :step="1"
              @update:model-value="
                (v: number[] | undefined) =>
                  setPref('visualizer_blur', v?.[0] ?? 0)
              "
            />
            <span class="w-12 text-right text-sm tabular-nums"
              >{{ blurPref }}px</span
            >
          </div>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <div class="flex items-center gap-2">
          <Sparkles class="size-4 text-primary" />
          <CardTitle>{{ $t("visualizer.section_presets") }}</CardTitle>
        </div>
      </CardHeader>
      <CardContent class="space-y-5">
        <div class="flex items-center justify-between gap-6">
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
            <SelectTrigger class="w-56 shrink-0">
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
          class="flex items-center justify-between gap-6"
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
            <SelectTrigger class="w-72 shrink-0">
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
            <div class="font-medium">{{ $t("visualizer.beat_switch") }}</div>
            <div class="text-sm text-muted-foreground">
              {{ $t("visualizer.beat_switch_description") }}
            </div>
          </div>
          <Switch
            :model-value="beatSwitchPref"
            @update:model-value="
              (v: boolean) => setPref('visualizer_beat_switch', v)
            "
          />
        </div>

        <div
          v-if="beatSwitchPref"
          class="flex items-center justify-between gap-6"
        >
          <div class="min-w-0">
            <div class="font-medium">{{ $t("visualizer.beat_dwell") }}</div>
            <div class="text-sm text-muted-foreground">
              {{ $t("visualizer.beat_dwell_description") }}
            </div>
          </div>
          <div class="flex w-64 shrink-0 items-center gap-3">
            <Slider
              :model-value="[beatDwellPref]"
              :min="5"
              :max="120"
              :step="5"
              @update:model-value="
                (v: number[] | undefined) =>
                  setPref('visualizer_beat_dwell', v?.[0] ?? 30)
              "
            />
            <span class="w-12 text-right text-sm tabular-nums"
              >{{ beatDwellPref }}s</span
            >
          </div>
        </div>
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
  Sparkles,
  Star,
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
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useUserPreferences } from "@/composables/userPreferences";
import { listPresetNames } from "@/helpers/visualizer/presetLibrary";
import {
  DEFAULT_QUALITY,
  QUALITY_PROFILES,
} from "@/helpers/visualizer/quality";
import { $t } from "@/plugins/i18n";
import { visualizerProviderAvailable } from "@/plugins/visualizer-relay";

const QUALITY_TIERS = Object.keys(QUALITY_PROFILES);
const PRESET_MODES = ["random", "random_favorites", "fixed"];

const { getPreference, setPreference } = useUserPreferences();
const enabledPref = getPreference("visualizer_enabled", false);
const qualityPref = getPreference<string>(
  "visualizer_quality",
  DEFAULT_QUALITY,
);
const opacityPref = getPreference("visualizer_opacity", 100);
const blurPref = getPreference("visualizer_blur", 0);
const presetModePref = getPreference<string>(
  "visualizer_preset_mode",
  "random",
);
const presetPref = getPreference("visualizer_preset", "");
const beatSwitchPref = getPreference("visualizer_beat_switch", false);
const beatDwellPref = getPreference("visualizer_beat_dwell", 30);
const favoritesPref = getPreference<string[]>("visualizer_favorites", []);

const providerAvailable = computed(() => visualizerProviderAvailable());
const presetNames = ref<string[]>([]);

onMounted(async () => {
  presetNames.value = await listPresetNames();
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
