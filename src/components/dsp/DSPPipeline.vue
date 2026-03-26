<template>
  <div class="dsp-timeline">
    <!-- Input -->
    <div class="dsp-timeline-item" @click="handleSelect('input')">
      <div class="dsp-timeline-dot" :class="getDotClass('input')" />
      <div class="dsp-timeline-line" />
      <button
        :class="['dsp-pipeline-card', getButtonClass('input')]"
        :style="getButtonStyle('input')"
      >
        <span class="px-3 py-1">{{ $t("settings.dsp.input") }}</span>
      </button>
    </div>

    <!-- Spacer -->
    <div class="dsp-timeline-item">
      <div class="dsp-timeline-dot dsp-timeline-dot--hidden" />
      <div class="dsp-timeline-line" />
    </div>

    <!-- DSP Filters -->
    <div
      v-for="(filter, index) in dsp.filters"
      :key="index"
      class="dsp-timeline-item"
      @click="handleSelect(index)"
      @contextmenu.prevent="(e: MouseEvent) => openFilterContextMenu(e, index)"
    >
      <div
        class="dsp-timeline-dot"
        :class="[getDotClass(index), isDisabled(index) ? 'dsp-timeline-dot--hidden' : '']"
      />
      <div class="dsp-timeline-line" />
      <button
        :class="['dsp-pipeline-card', getButtonClass(index)]"
        :style="getButtonStyle(index)"
      >
        <span class="px-3 py-1">{{ $t(`settings.dsp.types.${filter.type}`) }}</span>
      </button>
    </div>

    <!-- Add Filter Button -->
    <div class="dsp-timeline-item">
      <div class="dsp-timeline-dot dsp-timeline-dot--hidden" />
      <div class="dsp-timeline-line" />
      <button
        class="dsp-pipeline-card add-filter-btn"
        @click="emit('onAddFilter')"
      >
        <span class="py-1 flex items-center">
          <Plus class="h-4 w-4 mr-1" />
          {{ $t("settings.dsp.filter.add") }}
        </span>
      </button>
    </div>

    <!-- Spacer -->
    <div class="dsp-timeline-item">
      <div class="dsp-timeline-dot dsp-timeline-dot--hidden" />
      <div class="dsp-timeline-line" />
    </div>

    <!-- Output -->
    <div class="dsp-timeline-item" @click="handleSelect('output')">
      <div class="dsp-timeline-dot" :class="getDotClass('output')" />
      <button
        :class="['dsp-pipeline-card', getButtonClass('output')]"
        :style="getButtonStyle('output')"
      >
        <span class="px-3 py-1">{{ $t("settings.dsp.output") }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useIsDark } from "@/composables/useIsDark";
import { DSPConfig } from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { Plus } from "lucide-vue-next";

const { isDark } = useIsDark();

type SelectionType = number | "input" | "output";

const props = defineProps<{
  dsp: DSPConfig;
  selected: SelectionType | null;
}>();

const emit = defineEmits<{
  (e: "onSelect", selected: SelectionType): void;
  (e: "onAddFilter"): void;
  (e: "onMoveFilter", data: { index: number; direction: "up" | "down" }): void;
  (e: "onDeleteFilter", index: number): void;
}>();

const getDotClass = (value: SelectionType) => ({
  'dsp-timeline-dot--primary': props.selected === value,
  'dsp-timeline-dot--secondary': props.selected !== value,
});

const isDisabled = (value: SelectionType): boolean => {
  if (value === "input" || value === "output") {
    return false;
  } else {
    return !props.dsp.filters[value].enabled;
  }
};

const getButtonStyle = (value: SelectionType) => {
  if (props.selected === value) {
    return { background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' };
  }
  return {
    background: isDark.value ? 'hsl(var(--muted))' : 'hsl(var(--muted))',
    color: 'hsl(var(--foreground))',
  };
};

const getButtonClass = (value: SelectionType) => ({
  "filter-selected": props.selected === value,
});

const handleSelect = (value: SelectionType): void => {
  emit("onSelect", value);
};

const moveFilter = (index: number, direction: "up" | "down"): void => {
  emit("onMoveFilter", { index, direction });
};

const deleteFilter = (index: number): void => {
  emit("onDeleteFilter", index);
};

const openFilterContextMenu = function (evt: Event, index: number) {
  const menuItems = [
    {
      label: "settings.dsp.move_up",
      labelArgs: [],
      action: () => {
        moveFilter(index, "up");
      },
      disabled: index === 0,
      icon: "mdi-arrow-up",
    },
    {
      label: "settings.dsp.move_down",
      labelArgs: [],
      action: () => {
        moveFilter(index, "down");
      },
      disabled: index === props.dsp.filters.length - 1,
      icon: "mdi-arrow-down",
    },
    {
      label: "settings.dsp.delete_filter",
      labelArgs: [],
      action: () => {
        deleteFilter(index);
      },
      icon: "mdi-delete",
    },
  ];
  eventbus.emit("contextmenu", {
    items: menuItems,
    posX: (evt as PointerEvent).clientX,
    posY: (evt as PointerEvent).clientY,
  });
};
</script>

<style scoped>
.dsp-timeline {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding-left: 16px;
}

.dsp-timeline-item {
  display: flex;
  align-items: center;
  position: relative;
  padding-left: 24px;
  min-height: 32px;
  cursor: pointer;
}

.dsp-timeline-dot {
  position: absolute;
  left: 0;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  z-index: 1;
}

.dsp-timeline-dot--primary {
  background: hsl(var(--primary));
}

.dsp-timeline-dot--secondary {
  background: hsl(var(--muted-foreground));
}

.dsp-timeline-dot--hidden {
  visibility: hidden;
}

.dsp-timeline-line {
  position: absolute;
  left: 4px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: hsl(var(--border));
}

.dsp-timeline-item:first-child .dsp-timeline-line {
  top: 50%;
}

.dsp-timeline-item:last-child .dsp-timeline-line {
  bottom: 50%;
}

.dsp-pipeline-card {
  min-width: 160px;
  transition: transform 0.2s ease;
  border: none;
  border-radius: 9999px;
  padding: 0;
  cursor: pointer;
  font-size: 0.875rem;
}

.dsp-pipeline-card:hover,
.filter-selected {
  transform: translateX(4px);
}

.add-filter-btn {
  background: transparent !important;
  border: 1px dashed hsl(var(--muted-foreground) / 0.5) !important;
  color: hsl(var(--foreground)) !important;
  cursor: pointer;
}

.add-filter-btn:hover {
  border-color: hsl(var(--primary)) !important;
  transform: none;
}
</style>
