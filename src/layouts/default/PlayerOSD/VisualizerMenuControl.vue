<!--
  Inline visualizer options for the fullscreen player's overflow menu:
  preset picker (full butterchurn library, "random" default) and blur slider.
  Rendered as a non-selectable menu row; changes persist as user preferences.
-->
<template>
  <div v-if="enabledPref" class="visualizer-menu" @pointerdown.stop @click.stop>
    <div class="visualizer-menu__row">
      <Sparkles :size="20" class="visualizer-menu__icon" />
      <Select :model-value="selectValue" @update:model-value="onPresetChange">
        <SelectTrigger class="visualizer-menu__select" size="sm">
          <span class="visualizer-menu__trigger-label">{{ triggerLabel }}</span>
        </SelectTrigger>
        <SelectContent class="visualizer-menu__dropdown">
          <SelectItem :value="RANDOM_VALUE">
            {{ $t("visualizer.preset_random") }}
          </SelectItem>
          <SelectItem
            v-if="favoritesPref.length > 0"
            :value="RANDOM_FAVORITES_VALUE"
          >
            {{ $t("visualizer.preset_random_favorites") }}
          </SelectItem>
          <SelectItem
            v-for="name in sortedPresetNames"
            :key="name"
            :value="name"
          >
            {{ favoritesPref.includes(name) ? `★ ${name}` : name }}
          </SelectItem>
        </SelectContent>
      </Select>
      <button
        type="button"
        class="visualizer-menu__star"
        :class="{ 'visualizer-menu__star--active': showingIsFavorite }"
        :aria-label="$t('visualizer.toggle_favorite')"
        @click.stop="toggleFavorite"
      >
        <Star :size="18" :fill="showingIsFavorite ? 'currentColor' : 'none'" />
      </button>
    </div>
    <div class="visualizer-menu__row">
      <Focus :size="20" class="visualizer-menu__icon" />
      <Slider
        :model-value="[blurPref]"
        :min="0"
        :max="30"
        :step="1"
        class="visualizer-menu__slider"
        @update:model-value="onBlurChange"
      />
      <span class="visualizer-menu__value">{{ blurPref }}px</span>
    </div>
    <div class="visualizer-menu__row">
      <Blend :size="20" class="visualizer-menu__icon" />
      <Slider
        :model-value="[opacityPref]"
        :min="10"
        :max="100"
        :step="5"
        class="visualizer-menu__slider"
        @update:model-value="onOpacityChange"
      />
      <span class="visualizer-menu__value">{{ opacityPref }}%</span>
    </div>
    <DropdownMenuItem class="px-0" @select="openSettings">
      <SettingsIcon class="visualizer-menu__icon size-5" />
      <span>{{ $t("visualizer.open_settings") }}</span>
    </DropdownMenuItem>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  Blend,
  Focus,
  Settings as SettingsIcon,
  Sparkles,
  Star,
} from "@lucide/vue";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useUserPreferences } from "@/composables/userPreferences";
import { currentVisualizerPreset } from "@/composables/visualizer/state";
import { listPresetNames } from "@/helpers/visualizer/presetLibrary";
import { $t } from "@/plugins/i18n";
import router from "@/plugins/router";
import { store } from "@/plugins/store";

// Sentinels because SelectItem values must be non-empty.
const RANDOM_VALUE = "__random__";
const RANDOM_FAVORITES_VALUE = "__random_favorites__";

const { getPreference, setPreference } = useUserPreferences();
const enabledPref = getPreference("visualizer_enabled", false);
const presetPref = getPreference("visualizer_preset", "");
const blurPref = getPreference("visualizer_blur", 0);
const opacityPref = getPreference("visualizer_opacity", 100);
const favoritesPref = getPreference<string[]>("visualizer_favorites", []);
const presetModePref = getPreference<string>(
  "visualizer_preset_mode",
  "random",
);

const presetNames = ref<string[]>([]);

// Favourites float to the top of the picker.
const sortedPresetNames = computed(() => {
  const favorites = favoritesPref.value;
  return [...presetNames.value].sort((a, b) => {
    const favDiff =
      Number(favorites.includes(b)) - Number(favorites.includes(a));
    return favDiff !== 0
      ? favDiff
      : a.localeCompare(b, undefined, { sensitivity: "base" });
  });
});

// The star acts on whatever preset is currently showing (random modes pick
// presets the dropdown does not reflect).
const showingPreset = computed(
  () => currentVisualizerPreset.value || presetPref.value || null,
);
const showingIsFavorite = computed(
  () =>
    showingPreset.value !== null &&
    favoritesPref.value.includes(showingPreset.value),
);

const toggleFavorite = () => {
  const name = showingPreset.value;
  if (!name) return;
  const favorites = favoritesPref.value.includes(name)
    ? favoritesPref.value.filter((f) => f !== name)
    : [...favoritesPref.value, name];
  void setPreference("visualizer_favorites", favorites);
};

// Loading the names pulls in the multi-megabyte preset packs, so defer it until
// the visualizer is actually enabled rather than on every menu open.
watch(
  enabledPref,
  async (enabled) => {
    if (enabled && presetNames.value.length === 0)
      presetNames.value = await listPresetNames();
  },
  { immediate: true },
);

// The dropdown reflects and controls the full selection: concrete preset
// switches to fixed mode; the Random entries switch the mode back.
const selectValue = computed(() => {
  if (presetModePref.value === "fixed" && presetPref.value)
    return presetPref.value;
  if (presetModePref.value === "random_favorites")
    return RANDOM_FAVORITES_VALUE;
  return RANDOM_VALUE;
});

// The trigger shows what is actually on screen right now, marked with ⟳ when
// that is not the user's own pick. Beat switching overrides fixed mode too, so
// even a fixed selection can be showing something else.
const triggerLabel = computed(() => {
  const showing = currentVisualizerPreset.value;
  if (presetModePref.value === "fixed" && presetPref.value) {
    return showing && showing !== presetPref.value
      ? `⟳ ${showing}`
      : presetPref.value;
  }
  if (showing) return `⟳ ${showing}`;
  return presetModePref.value === "random_favorites"
    ? $t("visualizer.preset_random_favorites")
    : $t("visualizer.preset_random");
});

const onPresetChange = (value: unknown) => {
  if (value === RANDOM_VALUE) {
    void setPreference("visualizer_preset_mode", "random");
    return;
  }
  if (value === RANDOM_FAVORITES_VALUE) {
    void setPreference("visualizer_preset_mode", "random_favorites");
    return;
  }
  void setPreference("visualizer_preset", String(value ?? ""));
  void setPreference("visualizer_preset_mode", "fixed");
};

const onBlurChange = (value: number[] | undefined) => {
  if (!value) return;
  void setPreference("visualizer_blur", value[0] ?? 0);
};

const onOpacityChange = (value: number[] | undefined) => {
  if (!value) return;
  void setPreference("visualizer_opacity", value[0] ?? 100);
};

const openSettings = () => {
  store.showFullscreenPlayer = false;
  void router.push({ name: "visualizer" });
};
</script>

<style scoped>
.visualizer-menu {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 6px 8px;
  font-size: 0.875rem;
  min-width: 260px;
}

.visualizer-menu__row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.visualizer-menu__icon {
  flex: 0 0 auto;
}

.visualizer-menu__star {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 6px;
  color: inherit;
  flex: 0 0 auto;
  transition: background-color 0.12s ease;
}

.visualizer-menu__star:hover {
  background: var(--accent);
}

.visualizer-menu__star--active {
  color: #f5c518;
}

.visualizer-menu__select {
  flex: 1 1 auto;
  min-width: 0;
}

.visualizer-menu__trigger-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.visualizer-menu__slider {
  flex: 1 1 auto;
}

.visualizer-menu__value {
  min-width: 4ch;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
</style>
