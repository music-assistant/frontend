<template>
  <div class="dsp-chain">
    <!-- Input -->
    <div class="dsp-chain-stage dsp-chain-stage--start">
      <span class="dsp-chain-connector" aria-hidden="true">
        <span class="dsp-chain-tick" />
        <span class="dsp-chain-dot" :class="dotClass('input')" />
      </span>
      <button
        type="button"
        class="dsp-chain-item"
        :class="{ 'dsp-chain-item--selected': selected === 'input' }"
        :aria-current="selected === 'input' ? 'true' : undefined"
        @click="handleSelect('input')"
      >
        <AudioLines :size="18" class="dsp-chain-icon" />
        <span class="dsp-chain-title">{{ $t("settings.dsp.input") }}</span>
      </button>
    </div>

    <!-- DSP Filters -->
    <div
      v-for="(filter, index) in dsp.filters"
      :key="index"
      v-hold="(e: Event) => onHold(e, index)"
      class="dsp-chain-stage"
      @click.capture="swallowClickAfterHold"
      @contextmenu.prevent="(e: MouseEvent) => openFilterContextMenu(e, index)"
      @touchstart.passive="onTouchStart"
    >
      <!-- A deactivated filter leaves the chain: the rail runs past it with no
           dot and no tick. -->
      <span class="dsp-chain-connector" aria-hidden="true">
        <template v-if="!isDisabled(index)">
          <span class="dsp-chain-tick" />
          <span class="dsp-chain-dot" :class="dotClass(index)" />
        </template>
      </span>
      <button
        type="button"
        class="dsp-chain-item"
        :class="{
          'dsp-chain-item--selected': selected === index,
          'dsp-chain-item--off': isDisabled(index),
        }"
        :aria-current="selected === index ? 'true' : undefined"
        @click="handleSelect(index)"
      >
        <component
          :is="dspFilterIcon(filter)"
          :size="18"
          class="dsp-chain-icon"
        />
        <span class="dsp-chain-title">
          {{ $t(`settings.dsp.types.${filter.type}`) }}
        </span>
      </button>
    </div>

    <!-- Add Filter -->
    <div class="dsp-chain-stage">
      <span class="dsp-chain-connector" aria-hidden="true" />
      <button
        type="button"
        class="dsp-chain-item dsp-chain-item--add"
        @click="emit('onAddFilter')"
      >
        <Plus :size="18" class="dsp-chain-icon" />
        <span class="dsp-chain-title">{{ $t("settings.dsp.filter.add") }}</span>
      </button>
    </div>

    <!-- Output -->
    <div class="dsp-chain-stage dsp-chain-stage--end">
      <span class="dsp-chain-connector" aria-hidden="true">
        <span class="dsp-chain-tick" />
        <span class="dsp-chain-dot" :class="dotClass('output')" />
      </span>
      <button
        type="button"
        class="dsp-chain-item"
        :class="{ 'dsp-chain-item--selected': selected === 'output' }"
        :aria-current="selected === 'output' ? 'true' : undefined"
        @click="handleSelect('output')"
      >
        <Speaker :size="18" class="dsp-chain-icon" />
        <span class="dsp-chain-title">{{ $t("settings.dsp.output") }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  getEventPosition,
  useHoldToOpenMenu,
} from "@/composables/useHoldToOpenMenu";
import { DSPConfig } from "@/plugins/api/interfaces";
import { dspFilterIcon } from "@/helpers/audioProcessing";
import { eventbus } from "@/plugins/eventbus";
import { AudioLines, Plus, Speaker } from "@lucide/vue";

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

const dotClass = (value: SelectionType) =>
  props.selected === value ? "dsp-chain-dot--active" : "";

const isDisabled = (value: SelectionType): boolean => {
  if (value === "input" || value === "output") {
    return false;
  } else {
    return !props.dsp.filters[value].enabled;
  }
};

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
  const pos = getEventPosition(evt);
  eventbus.emit("contextmenu", {
    items: menuItems,
    posX: pos.x,
    posY: pos.y,
  });
};

const { onHold, onTouchStart, swallowClickAfterHold } = useHoldToOpenMenu(
  openFilterContextMenu,
);
</script>

<style scoped>
.dsp-chain {
  min-width: 220px;
}

.dsp-chain-stage {
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr);
  column-gap: 6px;
  align-items: stretch;
}

.dsp-chain-connector {
  position: relative;
  grid-column: 1;
  width: 18px;
  margin-left: 8px;
}

/* Split into halves so the node lands on the row's centre whatever its height. */
.dsp-chain-connector::before,
.dsp-chain-connector::after {
  position: absolute;
  left: 0;
  border-left: 2px solid var(--border);
  content: "";
}

.dsp-chain-connector::before {
  top: 0;
  height: 50%;
}

.dsp-chain-connector::after {
  top: 50%;
  bottom: 0;
}

.dsp-chain-stage--start .dsp-chain-connector::before,
.dsp-chain-stage--end .dsp-chain-connector::after {
  display: none;
}

.dsp-chain-tick {
  position: absolute;
  top: 50%;
  left: 0;
  width: 18px;
  border-top: 2px solid var(--border);
}

.dsp-chain-dot {
  position: absolute;
  top: 50%;
  left: -2.5px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--muted-foreground);
  opacity: 0.7;
  transform: translateY(-50%);
}

.dsp-chain-dot--active {
  background: var(--primary);
  opacity: 1;
}

.dsp-chain-item {
  grid-column: 2;
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  width: 100%;
  /* Spacing lives on the item, not the row, so the rail stays unbroken. */
  margin-block: 3px;
  padding: 6px 8px;
  border-radius: var(--radius-md);
  font-size: 1.25rem;
  line-height: 1.3;
  text-align: left;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}

.dsp-chain-item:hover {
  background: var(--accent);
}

.dsp-chain-item:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: -2px;
}

.dsp-chain-item--selected {
  background: var(--accent);
  color: var(--accent-foreground);
  font-weight: 500;
}

.dsp-chain-item--selected .dsp-chain-icon {
  color: var(--primary);
}

.dsp-chain-item--off {
  opacity: 0.55;
}

.dsp-chain-item--add {
  color: var(--muted-foreground);
}

.dsp-chain-item--add:hover {
  color: var(--foreground);
}

.dsp-chain-icon {
  flex: 0 0 auto;
  color: var(--muted-foreground);
}

.dsp-chain-title {
  min-width: 0;
  overflow-wrap: anywhere;
}
</style>
