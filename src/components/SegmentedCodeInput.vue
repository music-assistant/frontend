<script setup lang="ts">
import { sanitizeCode } from "@/helpers/segmented_code";
import { computed, nextTick, ref, type ComponentPublicInstance } from "vue";

/** A code box holding `length` characters, or a literal rendered between boxes. */
export type SegmentedCodeCell =
  | string
  | { length: number; digitsOnly?: boolean };

const props = defineProps<{
  /** one entry per code box, in box order */
  modelValue: string[];
  /** code boxes and literal separators, in render order */
  layout: SegmentedCodeCell[];
  disabled?: boolean;
  /** render the value as static boxes instead of inputs */
  readonly?: boolean;
  /** offer the platform's OTP autofill on the first box */
  otpAutofill?: boolean;
  /** base for the per-box aria labels, numbered "label i/n" */
  ariaLabel?: string;
  /** extra class on every code box */
  cellClass?: string;
  /** extra class on every separator */
  separatorClass?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string[]];
  submit: [];
}>();

defineExpose({ focusFirstEmpty });

type Segment = { length: number; digitsOnly: boolean };
type RenderCell =
  | { type: "box"; index: number; segment: Segment }
  | { type: "separator"; text: string };
type CaretPosition = { segment: number; offset: number };

const renderCells = computed<RenderCell[]>(() => {
  let index = 0;
  return props.layout.map((cell) =>
    typeof cell === "string"
      ? { type: "separator" as const, text: cell }
      : {
          type: "box" as const,
          index: index++,
          segment: {
            length: cell.length,
            digitsOnly: cell.digitsOnly ?? false,
          },
        },
  );
});

const segments = computed<Segment[]>(() =>
  renderCells.value.flatMap((cell) =>
    cell.type === "box" ? [cell.segment] : [],
  ),
);
const lastIndex = computed(() => segments.value.length - 1);
const totalLength = computed(() =>
  segments.value.reduce((sum, segment) => sum + segment.length, 0),
);
const isNumeric = computed(() =>
  segments.value.every((segment) => segment.digitsOnly),
);

const boxValues = computed(() =>
  segments.value.map((_, index) => props.modelValue[index] ?? ""),
);

const inputRefs = ref<(HTMLInputElement | null)[]>([]);

function onBoxInput(index: number, event: Event) {
  const input = event.target as HTMLInputElement;
  // an emptied input (cut, delete over a selection) clears the box
  if (input.value === "") {
    update(withValue(index, ""));
    return;
  }
  const segment = segments.value[index];
  if (segment.length === 1) {
    // single-char box: distribute what the DOM holds over this and later boxes
    const { updated, end } = distribute(input.value, index, currentValues());
    // the DOM may hold a rejected or overflowing char Vue has no patch for
    input.value = updated[index];
    update(updated);
    const next = end.offset > 0 ? end.segment + 1 : index;
    if (next > index) focusBox(Math.min(next, lastIndex.value));
    return;
  }
  // multi-char box: its DOM value replaces the content, overflow spills onward
  const clean = sanitizeCode(input.value, segment.digitsOnly);
  const updated = currentValues();
  updated[index] = clean.slice(0, segment.length);
  const overflow = clean.slice(segment.length);
  if (input.value !== updated[index]) input.value = updated[index];
  if (overflow && index < lastIndex.value) {
    const spilled = distribute(overflow, index + 1, updated);
    update(spilled.updated);
    moveCaret(spilled.end);
  } else {
    update(updated);
    // auto-advance when the box was typed exactly full
    if (updated[index].length === segment.length && index < lastIndex.value) {
      nextTick(() => inputRefs.value[index + 1]?.focus());
    }
  }
}

function onBoxKeydown(index: number, event: KeyboardEvent) {
  if (event.key === "Enter") {
    emit("submit");
    return;
  }
  if (segments.value[index].length === 1) {
    // single-char box: whole-box navigation, backspace clears
    if (event.key === "Backspace") {
      event.preventDefault();
      if (boxValues.value[index]) {
        update(withValue(index, ""));
      } else if (index > 0) {
        update(withValue(index - 1, ""));
        focusBox(index - 1);
      }
    } else if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      focusBox(index - 1);
    } else if (event.key === "ArrowRight" && index < lastIndex.value) {
      event.preventDefault();
      focusBox(index + 1);
    }
    return;
  }
  // multi-char box: move between boxes only when the caret sits at an edge
  const input = event.target as HTMLInputElement;
  const previousEnd = () => ({
    segment: index - 1,
    offset: boxValues.value[index - 1].length,
  });
  if (
    event.key === "Backspace" &&
    input.selectionStart === 0 &&
    input.selectionEnd === 0 &&
    index > 0
  ) {
    event.preventDefault();
    moveCaret(previousEnd());
  } else if (
    event.key === "ArrowLeft" &&
    input.selectionStart === 0 &&
    index > 0
  ) {
    event.preventDefault();
    moveCaret(previousEnd());
  } else if (
    event.key === "ArrowRight" &&
    input.selectionStart === input.value.length &&
    index < lastIndex.value
  ) {
    event.preventDefault();
    moveCaret({ segment: index + 1, offset: 0 });
  }
}

function onBoxPaste(index: number, event: ClipboardEvent) {
  const pasted = event.clipboardData?.getData("text") || "";
  const clean = sanitizeCode(pasted);
  if (!clean) return;
  // a paste into the first box, or one holding a full code, replaces everything
  const start = index === 0 || clean.length >= totalLength.value ? 0 : index;
  const base = start === 0 ? segments.value.map(() => "") : currentValues();
  const { updated, end } = distribute(clean, start, base);
  update(updated);
  if (segments.value[end.segment].length === 1) {
    const next = end.offset > 0 ? end.segment + 1 : start;
    focusBox(Math.min(next, lastIndex.value));
  } else {
    moveCaret(end);
  }
}

function onBoxFocus(index: number, event: FocusEvent) {
  // single-char boxes select their content so typing overwrites
  if (segments.value[index].length === 1) {
    (event.target as HTMLInputElement).select();
  }
}

// focuses the first box that still misses characters, or the last when complete;
// deferred so that a caller which just changed modelValue picks the box from the
// updated value rather than the one still bound at call time
function focusFirstEmpty() {
  nextTick(() => {
    const values = boxValues.value;
    const first = segments.value.findIndex(
      (segment, index) => values[index].length < segment.length,
    );
    const target = first === -1 ? lastIndex.value : first;
    applyFocus({ segment: target, offset: values[target].length });
  });
}

function setInputRef(index: number) {
  return (el: Element | ComponentPublicInstance | null) => {
    inputRefs.value[index] = el as HTMLInputElement | null;
  };
}

// multi-char boxes share the row proportionally to their capacity
function boxStyle(segment: Segment) {
  return segment.length > 1
    ? { flexGrow: segment.length, flexBasis: "0" }
    : undefined;
}

// writes text into the boxes from startIndex, dropping characters a box does
// not accept; a box that receives anything is replaced whole. Returns the
// updated values and the position just after the last written character.
function distribute(text: string, startIndex: number, base: string[]) {
  const updated = [...base];
  let index = startIndex;
  let written = "";
  let end: CaretPosition = { segment: startIndex, offset: 0 };
  for (const char of text) {
    if (index >= segments.value.length) break;
    const segment = segments.value[index];
    const accepted = sanitizeCode(char, segment.digitsOnly);
    if (!accepted) continue;
    written += accepted;
    updated[index] = written;
    end = { segment: index, offset: written.length };
    if (written.length === segment.length) {
      index++;
      written = "";
    }
  }
  return { updated, end };
}

function currentValues(): string[] {
  return [...boxValues.value];
}

function withValue(index: number, value: string): string[] {
  const updated = currentValues();
  updated[index] = value;
  return updated;
}

function update(updated: string[]) {
  emit("update:modelValue", updated);
}

function focusBox(index: number) {
  focusAt({ segment: index, offset: 0 });
}

function moveCaret(position: CaretPosition) {
  focusAt(position);
}

function focusAt(position: CaretPosition) {
  nextTick(() => applyFocus(position));
}

// a single-character box selects its content so typing overwrites it; a longer
// one takes a caret, since it behaves as an ordinary text field
function applyFocus(position: CaretPosition) {
  const input = inputRefs.value[position.segment];
  input?.focus();
  if (segments.value[position.segment].length === 1) input?.select();
  else input?.setSelectionRange(position.offset, position.offset);
}
</script>

<template>
  <div
    :role="readonly ? undefined : 'group'"
    :aria-label="readonly ? undefined : ariaLabel"
    class="flex w-full flex-wrap items-center gap-2 max-[500px]:gap-1"
  >
    <template v-for="(cell, position) of renderCells" :key="position">
      <span
        v-if="cell.type === 'separator'"
        class="text-muted-foreground font-mono text-xl select-none max-[500px]:text-lg"
        :class="separatorClass"
      >
        {{ cell.text }}
      </span>
      <div
        v-else-if="readonly"
        class="border-input dark:bg-input/30 flex h-12 min-w-0 items-center justify-center rounded-lg border bg-transparent px-1"
        :class="cellClass"
        :style="boxStyle(cell.segment)"
      >
        <!-- shrinks with the viewport so a long code keeps fitting its box -->
        <code
          class="text-foreground font-mono text-base tracking-wider whitespace-nowrap max-[768px]:text-[0.85rem] max-[768px]:tracking-[0.02em] max-[500px]:text-xs max-[500px]:tracking-normal"
        >
          {{ boxValues[cell.index] }}
        </code>
      </div>
      <input
        v-else
        :ref="setInputRef(cell.index)"
        class="border-input text-foreground selection:bg-primary selection:text-primary-foreground caret-primary dark:bg-input/30 focus:border-ring focus:ring-ring/50 h-12 min-w-0 rounded-lg border bg-transparent text-center font-mono shadow-xs transition-[color,box-shadow] outline-none focus:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 max-[500px]:h-11"
        :class="[
          cell.segment.length === 1
            ? 'w-11 text-xl max-[500px]:w-9 max-[500px]:text-lg'
            : 'px-1 text-base tracking-wider max-[500px]:px-0.5 max-[500px]:text-sm',
          cellClass,
        ]"
        :style="boxStyle(cell.segment)"
        type="text"
        :value="boxValues[cell.index]"
        :maxlength="cell.segment.length > 1 ? cell.segment.length : undefined"
        :inputmode="isNumeric ? 'numeric' : 'text'"
        :autocomplete="
          otpAutofill && cell.index === 0 ? 'one-time-code' : 'off'
        "
        autocapitalize="characters"
        autocorrect="off"
        spellcheck="false"
        :disabled="disabled"
        :aria-label="
          ariaLabel
            ? `${ariaLabel} ${cell.index + 1}/${segments.length}`
            : undefined
        "
        @input="onBoxInput(cell.index, $event)"
        @keydown="onBoxKeydown(cell.index, $event)"
        @paste.prevent="onBoxPaste(cell.index, $event)"
        @focus="onBoxFocus(cell.index, $event)"
      />
    </template>
  </div>
</template>
