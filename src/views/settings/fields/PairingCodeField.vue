<script setup lang="ts">
import type { ConfigEntryUI } from "@/helpers/config_entry_ui";
import type { ConfigValueType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import {
  computed,
  nextTick,
  onMounted,
  ref,
  watch,
  type ComponentPublicInstance,
} from "vue";

const props = defineProps<{
  entry: ConfigEntryUI;
  label: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{ "update:value": [value: ConfigValueType] }>();

// hard ceiling on rendered boxes; a longer format falls back to the text field
const MAX_SLOTS = 16;

type LayoutCell =
  | { type: "slot"; digit: boolean; index: number }
  | { type: "separator"; text: string };

// the format parsed into code boxes and literal separators, in render order;
// null when the format is missing or holds no code slot, which switches to the fallback
const layout = computed<LayoutCell[] | null>(() => {
  const format = props.entry.format;
  if (!format) return null;
  const result: LayoutCell[] = [];
  let index = 0;
  for (const char of format) {
    if (char === "#" || char === "X") {
      result.push({ type: "slot", digit: char === "#", index });
      index++;
    } else {
      // any other character renders as-is between the boxes
      const last = result[result.length - 1];
      if (last?.type === "separator") last.text += char;
      else result.push({ type: "separator", text: char });
    }
  }
  if (index === 0 || index > MAX_SLOTS) return null;
  return result;
});

// digit-only flag per code slot, in code order
const slotIsDigit = computed(() =>
  (layout.value ?? []).flatMap((cell) =>
    cell.type === "slot" ? [cell.digit] : [],
  ),
);

const slotCount = computed(() => slotIsDigit.value.length);
const isNumeric = computed(() => slotIsDigit.value.every(Boolean));

// one entered character per code slot
const cells = ref<string[]>([]);
const inputRefs = ref<(HTMLInputElement | null)[]>([]);
// the value of the last update:value emission; the parent writes it straight back
// to entry.value, so the watch below must not mistake that echo for an external reset
let lastEmitted: ConfigValueType | undefined;

seedCells();

onMounted(() => {
  if (layout.value && !props.disabled) focusFirstEmpty();
});

// re-served setup-flow steps reuse this component instance (keyed on entry.key),
// so an externally changed value must resync the boxes instead of keeping stale ones
watch(
  () => props.entry.value,
  (value) => {
    if (!layout.value || value === lastEmitted) return;
    if (normalizeCode(value) === cells.value.join("")) return;
    seedCells();
    lastEmitted = undefined;
    if (!props.disabled) focusFirstEmpty();
  },
);

function onCellInput(index: number, event: Event) {
  const input = event.target as HTMLInputElement;
  // an emptied input (cut, delete over a selection) clears the cell
  if (input.value === "") {
    cells.value[index] = "";
    emitCode();
    return;
  }
  const next = distribute(input.value, index);
  // the DOM may hold a rejected or overflowing char Vue has no patch for
  input.value = cells.value[index];
  emitCode();
  if (next > index) focusCell(Math.min(next, slotCount.value - 1));
}

function onCellKeydown(index: number, event: KeyboardEvent) {
  if (event.key === "Backspace") {
    event.preventDefault();
    if (cells.value[index]) {
      cells.value[index] = "";
      emitCode();
    } else if (index > 0) {
      cells.value[index - 1] = "";
      emitCode();
      focusCell(index - 1);
    }
  } else if (event.key === "ArrowLeft" && index > 0) {
    event.preventDefault();
    focusCell(index - 1);
  } else if (event.key === "ArrowRight" && index < slotCount.value - 1) {
    event.preventDefault();
    focusCell(index + 1);
  }
}

function onCellPaste(index: number, event: ClipboardEvent) {
  const pasted = event.clipboardData?.getData("text") || "";
  const clean = pasted.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!clean) return;
  // a paste into the first box, or one holding a full code, replaces everything
  const start = index === 0 || clean.length >= slotCount.value ? 0 : index;
  if (start === 0) cells.value = cells.value.map(() => "");
  const next = distribute(clean, start);
  emitCode();
  focusCell(Math.min(next, slotCount.value - 1));
}

function onCellFocus(event: FocusEvent) {
  // select the content so typing overwrites instead of appending
  (event.target as HTMLInputElement).select();
}

function setInputRef(index: number) {
  return (el: Element | ComponentPublicInstance | null) => {
    inputRefs.value[index] = el as HTMLInputElement | null;
  };
}

function seedCells() {
  const code = normalizeCode(props.entry.value);
  cells.value = Array.from(
    { length: slotCount.value },
    (_, index) => code[index] ?? "",
  );
}

function normalizeCode(value: unknown): string {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, slotCount.value);
}

// all-or-null: an incomplete code emits null so required-value gating keeps
// the submit button disabled until every box is filled
function emitCode() {
  const value = cells.value.every((cell) => cell) ? cells.value.join("") : null;
  lastEmitted = value;
  emit("update:value", value);
}

// writes text into the cells from startIndex, dropping chars a cell does not
// accept; returns the index just after the last cell written
function distribute(text: string, startIndex: number): number {
  let index = startIndex;
  for (const char of text) {
    if (index >= slotCount.value) break;
    const accepted = acceptChar(char, index);
    if (accepted === null) continue;
    cells.value[index] = accepted;
    index++;
  }
  return index;
}

function acceptChar(char: string, index: number): string | null {
  const upper = char.toUpperCase();
  const pattern = slotIsDigit.value[index] ? /^[0-9]$/ : /^[A-Z0-9]$/;
  return pattern.test(upper) ? upper : null;
}

function focusCell(index: number) {
  nextTick(() => {
    const input = inputRefs.value[index];
    input?.focus();
    input?.select();
  });
}

function focusFirstEmpty() {
  const first = cells.value.findIndex((cell) => !cell);
  focusCell(first === -1 ? slotCount.value - 1 : first);
}
</script>

<template>
  <div v-if="layout" class="pairing-code-field">
    <v-label class="pairing-code-label">
      {{ label }}
    </v-label>
    <div class="pairing-code-boxes">
      <template v-for="(cell, position) of layout" :key="position">
        <span v-if="cell.type === 'separator'" class="pairing-code-separator">
          {{ cell.text }}
        </span>
        <input
          v-else
          :ref="setInputRef(cell.index)"
          class="pairing-code-input"
          type="text"
          :value="cells[cell.index]"
          :inputmode="isNumeric ? 'numeric' : 'text'"
          :autocomplete="cell.index === 0 ? 'one-time-code' : 'off'"
          autocapitalize="characters"
          spellcheck="false"
          :disabled="disabled"
          :aria-label="`${label} ${cell.index + 1}/${slotCount}`"
          @input="onCellInput(cell.index, $event)"
          @keydown="onCellKeydown(cell.index, $event)"
          @paste.prevent="onCellPaste(cell.index, $event)"
          @focus="onCellFocus"
        />
      </template>
    </div>
  </div>

  <!-- no (valid) format: plain text input so the entry stays usable -->
  <v-text-field
    v-else
    :model-value="entry.value"
    :placeholder="entry.default_value?.toString()"
    clearable
    :disabled="disabled"
    :label="label"
    :required="entry.required"
    :rules="[(v) => !(!v && entry.required) || $t('settings.invalid_input')]"
    variant="outlined"
    density="comfortable"
    class="pairing-code-fallback"
    @update:model-value="emit('update:value', $event)"
    @click:clear="emit('update:value', null)"
  />
</template>

<style scoped>
.pairing-code-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px 0 8px;
}

.pairing-code-label {
  font-size: 0.875rem;
  color: rgba(var(--v-theme-on-surface), 0.7);
}

.pairing-code-boxes {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.pairing-code-input {
  width: 44px;
  height: 48px;
  min-width: 0;
  text-align: center;
  font-family: monospace;
  font-size: 1.25rem;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 10px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  caret-color: rgb(var(--v-theme-primary));
  outline: none;
}

.pairing-code-input:focus {
  border-color: rgb(var(--v-theme-primary));
  outline: 1px solid rgb(var(--v-theme-primary));
}

.pairing-code-input:disabled {
  opacity: 0.5;
}

.pairing-code-separator {
  font-family: monospace;
  font-size: 1.25rem;
  color: rgba(var(--v-theme-on-surface), 0.5);
  user-select: none;
}

.pairing-code-fallback :deep(input) {
  text-align: center;
  font-family: monospace;
  letter-spacing: 0.05em;
}

@media (max-width: 500px) {
  .pairing-code-boxes {
    gap: 4px;
  }

  .pairing-code-input {
    width: 36px;
    height: 44px;
    font-size: 1.1rem;
  }
}
</style>
