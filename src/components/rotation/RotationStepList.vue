<template>
  <div class="flex min-w-0 flex-col gap-3">
    <div ref="listEl" class="relative flex min-w-0 flex-col">
      <div
        v-for="(step, idx) in steps"
        :key="idx"
        class="min-w-0 pb-2"
        :data-drag-index="idx"
        :style="slotStyle(idx)"
        @pointerdown="onPointerDown($event, idx)"
        @keydown.up="onArrow($event, idx, idx - 1)"
        @keydown.down="onArrow($event, idx, idx + 1)"
      >
        <p
          v-if="headerKey(idx)"
          class="mb-2 ml-6 text-xs font-medium tracking-wide text-muted-foreground uppercase"
        >
          {{ $t(headerKey(idx)!) }}
        </p>
        <RotationStepRow
          :class="cn(draggingIndex === idx && 'opacity-40')"
          :step="step"
          :index="idx"
          :state="states[idx]!"
          :describe="describe"
          :count="counts[idx]"
          :errors="errors.get(idx + 1) ?? []"
          :grouped="isGrouped(idx, steps)"
          :albums-from-library="albumsFromLibrary(idx)"
          @update="emit('update', idx, $event)"
          @remove="emit('remove', idx)"
        />
      </div>

      <div
        v-if="draggingIndex != null"
        class="pointer-events-none absolute inset-x-0 z-10 flex items-center gap-2 rounded-lg border bg-card p-2 text-sm shadow-lg"
        :style="{ top: `${ghostY}px` }"
      >
        <GripVertical class="h-4 w-4 text-muted-foreground" />
        {{ $t("rotation.step.step_number", { number: draggingIndex + 1 }) }}
      </div>
    </div>

    <div v-if="canAdd">
      <RotationAddStepMenu
        :allowed="allowed"
        :kind="lastKind"
        @add="(type, to) => emit('add', type, to)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import RotationAddStepMenu from "@/components/rotation/RotationAddStepMenu.vue";
import RotationStepRow from "@/components/rotation/RotationStepRow.vue";
import { useListDragReorder } from "@/composables/useListDragReorder";
import {
  addableStepTypes,
  groupLabelKey,
  isGrouped,
  listStates,
  type ListState,
} from "@/helpers/rotation";
import { cn } from "@/lib/utils";
import type {
  RotationDescribe,
  RotationStep,
  RotationStepError,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { GripVertical } from "@lucide/vue";
import { computed, nextTick, ref } from "vue";

type ExpandTarget = Extract<RotationStep, { type: "expand" }>["to"];

const props = defineProps<{
  steps: RotationStep[];
  // per row, the list the step works on (the source row: its own output)
  states: ListState[];
  describe: RotationDescribe;
  // per row, the number of items the step passed on in the last preview
  counts: ({ count: number; exact: boolean } | undefined)[];
  // validation errors keyed by the 1-based step number
  errors: Map<number, RotationStepError[]>;
  canAdd: boolean;
}>();

const emit = defineEmits<{
  update: [index: number, step: RotationStep];
  remove: [index: number];
  move: [from: number, to: number];
  add: [type: RotationStep["type"], to?: ExpandTarget];
}>();

const listEl = ref<HTMLElement | null>(null);

const allowed = computed(() => addableStepTypes(props.steps));
const lastKind = computed(() => listStates(props.steps).at(-1)?.kind);

const {
  startItemDrag,
  draggingIndex,
  dropIndex,
  ghostY,
  dragRowHeight,
  rowOffset,
} = useListDragReorder({
  listEl,
  count: () => props.steps.length,
  onCommit: move,
});

// the lifted row travels to the slot the others opened up, as in RowsEditor
const dropGapOffset = computed(() => {
  const source = draggingIndex.value;
  const drop = dropIndex.value;
  if (source == null || drop == null) return 0;
  return ((drop > source ? drop - 1 : drop) - source) * dragRowHeight.value;
});

/** True when the step at index works on albums taken from the library. */
function albumsFromLibrary(index: number): boolean {
  const source = props.steps[0];
  return (
    index > 0 &&
    source?.type === "source" &&
    source.media_type === "album" &&
    props.states[index]?.kind === "album"
  );
}

/** The group header shown above the first row after an expand, if any. */
function headerKey(index: number): string | undefined {
  if (index < 1 || props.steps[index - 1]?.type !== "expand") return undefined;
  if (!isGrouped(index, props.steps)) return undefined;
  const expanded = props.states[index - 1];
  return expanded ? groupLabelKey(expanded) : undefined;
}

function move(from: number, to: number): boolean {
  const last = props.steps.length - 1;
  if (from < 1 || to < 1 || from > last || to > last || from === to) {
    return false;
  }
  emit("move", from, to);
  return true;
}

function fromHandle(event: Event): boolean {
  return (
    event.target instanceof Element &&
    event.target.closest("[data-drag-handle]") !== null
  );
}

function onPointerDown(event: PointerEvent, index: number) {
  if (index < 1 || !fromHandle(event)) return;
  event.preventDefault();
  startItemDrag(event, index);
}

async function onArrow(event: KeyboardEvent, from: number, to: number) {
  if (!fromHandle(event)) return;
  event.preventDefault();
  if (!move(from, to)) return;
  // rows are keyed by position, so the focus has to follow the moved step
  await nextTick();
  listEl.value
    ?.querySelector<HTMLElement>(`[data-drag-index="${to}"] [data-drag-handle]`)
    ?.focus();
}

function slotStyle(index: number) {
  if (draggingIndex.value == null) return undefined;
  const offset =
    index === draggingIndex.value ? dropGapOffset.value : rowOffset(index);
  return {
    transform: `translateY(${offset}px)`,
    transition: "transform 200ms ease-out",
  };
}
</script>
