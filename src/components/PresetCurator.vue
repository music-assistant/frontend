<!--
  Favorites curator: preview pane plus the preset list; click/hover previews,
  the star curates. Side by side on the settings page, stacked in the sheet.
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
        class="min-h-0 flex-1 overflow-y-auto rounded-md border p-1"
        @pointerleave="onRowHover(null)"
      >
        <div
          v-for="name in filteredNames"
          :key="name"
          class="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 text-sm hover:bg-accent hover:text-accent-foreground"
          :class="[
            sideBySide ? 'py-1' : 'py-2',
            { 'bg-accent text-accent-foreground': name === previewedPreset },
          ]"
          @click="previewedPreset = name"
          @pointerenter="onRowHover(name)"
        >
          <button
            type="button"
            class="shrink-0 rounded p-1.5"
            :class="{ 'text-[#f5c518]': favorites.includes(name) }"
            :aria-label="$t('visualizer.toggle_favorite')"
            @click.stop="emit('toggle-favorite', name)"
          >
            <Star
              :size="16"
              :fill="favorites.includes(name) ? 'currentColor' : 'none'"
            />
          </button>
          <span class="min-w-0 flex-1 break-words">{{ name }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Star } from "@lucide/vue";
import PresetPreviewCanvas from "@/components/PresetPreviewCanvas.vue";
import { Input } from "@/components/ui/input";
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

const previewedPreset = ref<string | null>(null);
watch(previewedPreset, (name) => emit("update:previewed", name));
const hoveredPreset = ref<string | null>(null);
let hoverTimer: number | null = null;

// Dwell before previewing a hovered row, so pointer travel doesn't thrash
// preset (shader) compiles.
const HOVER_DWELL_MS = 150;

const onRowHover = (name: string | null) => {
  if (hoverTimer !== null) window.clearTimeout(hoverTimer);
  hoverTimer = null;
  if (name === null) {
    hoveredPreset.value = null;
    return;
  }
  hoverTimer = window.setTimeout(() => {
    hoverTimer = null;
    hoveredPreset.value = name;
  }, HOVER_DWELL_MS);
};

const orderedNames = ref<string[]>([]);

// Favorites first, snapshotted once so starring doesn't reshuffle mid-browse;
// the names can load after mount, so order (and seed the pane) when they land.
watch(
  () => props.presetNames,
  (names) => {
    if (names.length === 0) return;
    const favorites = props.favorites;
    orderedNames.value = [...names].sort((a, b) => {
      const favDiff =
        Number(favorites.includes(b)) - Number(favorites.includes(a));
      return favDiff !== 0
        ? favDiff
        : a.localeCompare(b, undefined, { sensitivity: "base" });
    });
    previewedPreset.value ??= favorites[0] ?? names[0] ?? null;
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
