<!--
  Visualizer popout for the player overflow menus: per-player on/off switch,
  preset picker, blur and opacity sliders; persisted as user preferences.
-->
<template>
  <div ref="menuEl" class="visualizer-menu" @pointerdown.stop @click.stop>
    <div class="visualizer-menu__row">
      <Droplet
        :size="20"
        class="visualizer-menu__icon"
        :fill="enabledPref ? 'currentColor' : 'none'"
      />
      <span class="visualizer-menu__label">{{ $t("visualizer.enabled") }}</span>
      <Switch
        :model-value="enabledPref"
        @update:model-value="toggleVisualizer"
      />
    </div>
    <div class="visualizer-menu__row">
      <Focus :size="20" class="visualizer-menu__icon" />
      <Slider
        :model-value="[blurDraft]"
        :min="0"
        :max="30"
        :step="1"
        class="visualizer-menu__slider"
        @update:model-value="onBlurChange"
        @value-commit="onBlurCommit"
      />
      <span class="visualizer-menu__value">{{ blurDraft }}px</span>
    </div>
    <div class="visualizer-menu__row">
      <Contrast :size="20" class="visualizer-menu__icon" />
      <Slider
        :model-value="[opacityDraft]"
        :min="10"
        :max="100"
        :step="5"
        class="visualizer-menu__slider"
        @update:model-value="onOpacityChange"
        @value-commit="onOpacityCommit"
      />
      <span class="visualizer-menu__value">{{ opacityDraft }}%</span>
    </div>
    <!-- preset packs only load while enabled, so the list would be empty -->
    <template v-if="enabledPref">
      <DropdownMenuSeparator />
      <!-- header folds the list; the star acts on the showing preset without
           toggling the fold -->
      <div
        class="visualizer-menu__row visualizer-menu__preset-header"
        role="button"
        :aria-expanded="presetsExpanded"
        @click="toggleExpanded"
      >
        <SwatchBook :size="20" class="visualizer-menu__icon" />
        <span class="visualizer-menu__preset-label">{{ showingLabel }}</span>
        <button
          type="button"
          class="visualizer-menu__star"
          :class="{ 'visualizer-menu__star--active': showingIsFavorite }"
          :aria-label="$t('visualizer.toggle_favorite')"
          @click.stop="toggleFavorite"
        >
          <Star
            :size="18"
            :fill="showingIsFavorite ? 'currentColor' : 'none'"
          />
        </button>
        <ChevronDown
          :size="18"
          class="visualizer-menu__chevron"
          :class="{ 'visualizer-menu__chevron--open': presetsExpanded }"
        />
      </div>
      <!-- inline list (like the AI DJ submenu); the only scrolling part, the
           rows above stay as a static header -->
      <div
        v-if="presetsExpanded"
        class="visualizer-menu__list"
        :style="
          listMaxHeight !== null
            ? { maxHeight: `${listMaxHeight}px` }
            : undefined
        "
        @pointerleave="clearPreview"
      >
        <DropdownMenuItem
          @select.prevent="onPresetChange(RANDOM_VALUE)"
          @pointerenter="clearPreview"
        >
          <span class="flex-1 truncate min-w-0">
            {{ $t("visualizer.preset_random") }}
          </span>
          <Check v-if="selectValue === RANDOM_VALUE" class="ml-auto size-4" />
        </DropdownMenuItem>
        <DropdownMenuItem
          v-if="favoritesPref.length > 0"
          @select.prevent="onPresetChange(RANDOM_FAVORITES_VALUE)"
          @pointerenter="clearPreview"
        >
          <span class="flex-1 truncate min-w-0">
            {{ $t("visualizer.preset_random_favorites") }}
          </span>
          <Check
            v-if="selectValue === RANDOM_FAVORITES_VALUE"
            class="ml-auto size-4"
          />
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          v-for="name in sortedPresetNames"
          :key="name"
          @select.prevent="onPresetChange(name)"
          @pointerenter="(e: PointerEvent) => onPresetHover(name, e)"
        >
          <span class="flex-1 truncate min-w-0">
            {{ favoritesPref.includes(name) ? `★ ${name}` : name }}
          </span>
          <Check v-if="selectValue === name" class="ml-auto size-4" />
        </DropdownMenuItem>
      </div>
    </template>
    <PresetHoverPreview :preset="previewPreset" :anchor="previewAnchor" live />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  Check,
  ChevronDown,
  Contrast,
  Droplet,
  Focus,
  Star,
  SwatchBook,
} from "@lucide/vue";
import PresetHoverPreview from "@/components/PresetHoverPreview.vue";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useUserPreferences } from "@/composables/userPreferences";
import {
  currentVisualizerPreset,
  VISUALIZER_BLUR_DEFAULT,
  VISUALIZER_OPACITY_DEFAULT,
} from "@/composables/visualizer/state";
import { usePresetHoverPreview } from "@/composables/visualizer/usePresetHoverPreview";
import { useVisualizer } from "@/composables/visualizer/useVisualizer";
import { listPresetNames } from "@/helpers/visualizer/presetLibrary";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";

// Sentinels so the random modes can't collide with real preset names.
const RANDOM_VALUE = "__random__";
const RANDOM_FAVORITES_VALUE = "__random_favorites__";

const props = defineProps<{
  // player whose on/off switch this controls; defaults to the active player
  playerId?: string;
}>();

const { getPreference, setPreference } = useUserPreferences();
const { visualizerEnabledPref: enabledPref, toggleVisualizer } = useVisualizer(
  () => props.playerId || store.activePlayer?.player_id,
);
const presetPref = getPreference("visualizer_preset", "");
const blurPref = getPreference("visualizer_blur", VISUALIZER_BLUR_DEFAULT);
const opacityPref = getPreference(
  "visualizer_opacity",
  VISUALIZER_OPACITY_DEFAULT,
);
const favoritesPref = getPreference<string[]>("visualizer_favorites", []);
const presetModePref = getPreference<string>(
  "visualizer_preset_mode",
  "random",
);

const presetNames = ref<string[]>([]);

// Folded by default so the popout stays compact; per menu open, not persisted.
const presetsExpanded = ref(false);
const menuEl = ref<HTMLElement | null>(null);
const listMaxHeight = ref<number | null>(null);

// Cap the list to the free space below the popout, measured when expanding.
// The popper's available-height allows for relocating the popout, so growing
// to it makes the whole popout visibly jump (mainly on phones); growing only
// into the space that is really free below never triggers a reposition. The
// small floor keeps the fold usable when the popout sits near the bottom, at
// the cost of a shift of at most that amount in that rare case.
const { previewPreset, previewAnchor, onPresetHover, clearPreview } =
  usePresetHoverPreview("[data-slot='dropdown-menu-sub-content']");

const toggleExpanded = () => {
  if (!presetsExpanded.value && menuEl.value) {
    const panel =
      menuEl.value.closest("[data-slot='dropdown-menu-sub-content']") ??
      menuEl.value;
    const free = window.innerHeight - panel.getBoundingClientRect().bottom - 8;
    listMaxHeight.value = Math.max(96, free);
  }
  presetsExpanded.value = !presetsExpanded.value;
  // Folding removes the list; no pointerleave fires for it.
  if (!presetsExpanded.value) clearPreview();
};

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
// presets the list does not reflect).
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

// The list reflects and controls the full selection: concrete preset
// switches to fixed mode; the Random entries switch the mode back.
const selectValue = computed(() => {
  if (presetModePref.value === "fixed" && presetPref.value)
    return presetPref.value;
  if (presetModePref.value === "random_favorites")
    return RANDOM_FAVORITES_VALUE;
  return RANDOM_VALUE;
});

// The label row shows what is actually on screen right now, marked with ⟳ when
// that is not the user's own pick. Beat switching overrides fixed mode too, so
// even a fixed selection can be showing something else.
const showingLabel = computed(() => {
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

// Track drags locally so the labels stay live; the preference is persisted
// only on commit (drag end) — every write is a full api.updateUser round-trip
// that replaces the whole preferences object.
const blurDraft = ref(blurPref.value);
watch(blurPref, (value) => (blurDraft.value = value));
const opacityDraft = ref(opacityPref.value);
watch(opacityPref, (value) => (opacityDraft.value = value));

const onBlurChange = (value: number[] | undefined) => {
  if (!value) return;
  blurDraft.value = value[0] ?? VISUALIZER_BLUR_DEFAULT;
};

const onBlurCommit = (value: number[]) => {
  void setPreference("visualizer_blur", value[0] ?? VISUALIZER_BLUR_DEFAULT);
};

const onOpacityChange = (value: number[] | undefined) => {
  if (!value) return;
  opacityDraft.value = value[0] ?? VISUALIZER_OPACITY_DEFAULT;
};

const onOpacityCommit = (value: number[]) => {
  void setPreference(
    "visualizer_opacity",
    value[0] ?? VISUALIZER_OPACITY_DEFAULT,
  );
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
  min-height: 0;
}

.visualizer-menu__list {
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
}

.visualizer-menu__row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.visualizer-menu__icon {
  flex: 0 0 auto;
}

.visualizer-menu__label {
  flex: 1 1 auto;
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

.visualizer-menu__preset-header {
  cursor: pointer;
  border-radius: 6px;
}

.visualizer-menu__preset-header:hover {
  background: var(--accent);
}

.visualizer-menu__chevron {
  flex: 0 0 auto;
  transition: transform 0.15s ease;
}

.visualizer-menu__chevron--open {
  transform: rotate(180deg);
}

.visualizer-menu__preset-label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
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
