<!--
  Favorites curator: live preview plus the searchable preset list; click or
  hover previews, the star curates. Side by side in a wide host, stacked in
  the sheet.
-->
<template>
  <div
    class="flex flex-col gap-4"
    :class="sideBySide ? 'xl:flex-row' : 'min-h-0 flex-1'"
  >
    <div
      class="w-full shrink-0"
      :class="{ 'xl:w-[480px] 2xl:w-[560px]': sideBySide }"
    >
      <div class="aspect-video w-full overflow-hidden rounded-md border">
        <PresetPreviewCanvas :preset="previewName" />
      </div>
    </div>
    <div
      class="flex min-w-0 flex-col gap-2"
      :class="
        sideBySide
          ? 'h-64 xl:h-[270px] 2xl:h-[315px] xl:flex-1'
          : 'min-h-0 flex-1'
      "
    >
      <Input
        v-model="filter"
        :placeholder="$t('search')"
        class="h-8 shrink-0"
      />
      <div
        data-test="preset-list"
        class="min-h-0 flex-1 overflow-y-auto rounded-md border p-1"
        @pointerleave="onRowHover(null)"
      >
        <div
          v-for="name in filteredNames"
          :key="name"
          data-test="preset-row"
          class="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 text-sm hover:bg-accent hover:text-accent-foreground"
          :class="[
            sideBySide ? 'py-1' : 'py-2',
            { 'bg-accent text-accent-foreground': name === previewedPreset },
          ]"
          @click="previewPreset(name)"
          @pointerenter="onRowHover(name)"
        >
          <button
            type="button"
            class="shrink-0 rounded p-1.5"
            :class="{ 'text-yellow-500': favorites.includes(name) }"
            :aria-label="$t('visualizer.toggle_favorite')"
            :aria-pressed="favorites.includes(name)"
            @click.stop="emit('toggle-favorite', name)"
          >
            <Star
              :size="16"
              :fill="favorites.includes(name) ? 'currentColor' : 'none'"
            />
          </button>
          <button
            type="button"
            data-test="preset-name"
            class="min-w-0 flex-1 break-words text-left"
            :aria-current="name === previewedPreset"
          >
            {{ name }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { Star } from "@lucide/vue";
import PresetPreviewCanvas from "@/components/PresetPreviewCanvas.vue";
import { Input } from "@/components/ui/input";
import { sortFavoritesFirst } from "@/helpers/visualizer/presetLibrary";
import { isHoverCapablePointer } from "@/helpers/visualizer/pointer";
import { $t } from "@/plugins/i18n";

const props = defineProps<{
  presetNames: string[];
  favorites: string[];
  // Preview left of the list (wide embedded host) instead of above it.
  sideBySide?: boolean;
}>();

const emit = defineEmits<{
  "toggle-favorite": [name: string];
  "update:previewed": [name: string | null];
}>();

// Dwell before previewing a hovered row, so pointer travel doesn't thrash
// preset (shader) compiles.
const HOVER_DWELL_MS = 150;

const previewedPreset = ref<string | null>(null);

// Only a pick by the user is reported; the initial seed is not one.
const previewPreset = (name: string) => {
  previewedPreset.value = name;
  emit("update:previewed", name);
};

const hoveredPreset = ref<string | null>(null);
let hoverTimer: number | null = null;

// Touch fires pointerenter too; previews there stay tap-driven.
const hoverCapable = isHoverCapablePointer();

const clearHoverTimer = () => {
  if (hoverTimer !== null) window.clearTimeout(hoverTimer);
  hoverTimer = null;
};

const onRowHover = (name: string | null) => {
  if (!hoverCapable) return;
  clearHoverTimer();
  if (name === null) {
    hoveredPreset.value = null;
    return;
  }
  hoverTimer = window.setTimeout(() => {
    hoverTimer = null;
    hoveredPreset.value = name;
  }, HOVER_DWELL_MS);
};

onBeforeUnmount(clearHoverTimer);

const orderedNames = ref<string[]>([]);

// Snapshotted so starring doesn't reshuffle mid-browse; the names can load
// after mount, so order (and seed the preview) when they land.
watch(
  () => props.presetNames,
  (names) => {
    if (names.length === 0) return;
    orderedNames.value = sortFavoritesFirst(names, props.favorites);
    previewedPreset.value ??= orderedNames.value[0];
  },
  { immediate: true },
);

const filter = ref("");

const filteredNames = computed(() => {
  const query = filter.value.trim().toLowerCase();
  if (!query) return orderedNames.value;
  return orderedNames.value.filter((name) =>
    name.toLowerCase().includes(query),
  );
});

// Hovered row, else the clicked one.
const previewName = computed(
  () => hoveredPreset.value ?? previewedPreset.value,
);
</script>
