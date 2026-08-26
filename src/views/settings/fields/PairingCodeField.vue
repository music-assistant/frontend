<script setup lang="ts">
import SegmentedCodeInput, {
  type SegmentedCodeCell,
} from "@/components/SegmentedCodeInput.vue";
import { Input } from "@/components/ui/input";
import type { ConfigEntryUI } from "@/helpers/config_entry_ui";
import { sanitizeCode } from "@/helpers/segmented_code";
import type { ConfigValueType } from "@/plugins/api/interfaces";
import { computed, ref, useId, watch } from "vue";

const props = defineProps<{
  entry: ConfigEntryUI;
  label: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{ "update:value": [value: ConfigValueType] }>();

// hard ceiling on rendered boxes; a longer format falls back to the text field
const MAX_SLOTS = 16;

// the format parsed into single-character code boxes and literal separators, in
// render order; null when the format is missing or holds no code slot, which
// switches to the fallback
const layout = computed<SegmentedCodeCell[] | null>(() => {
  const format = props.entry.format;
  if (!format) return null;
  const result: SegmentedCodeCell[] = [];
  let count = 0;
  for (const char of format) {
    if (char === "#" || char === "X") {
      result.push({ length: 1, digitsOnly: char === "#" });
      count++;
    } else {
      // any other character renders as-is between the boxes
      const last = result[result.length - 1];
      if (typeof last === "string") result[result.length - 1] = last + char;
      else result.push(char);
    }
  }
  if (count === 0 || count > MAX_SLOTS) return null;
  return result;
});

const slotCount = computed(
  () => (layout.value ?? []).filter((cell) => typeof cell !== "string").length,
);

const labelId = useId();

// one entered character per code slot
const cells = ref<string[]>([]);
const codeInput = ref<InstanceType<typeof SegmentedCodeInput> | null>(null);
// the value of the last update:value emission; the parent writes it straight back
// to entry.value, so the watch below must not mistake that echo for an external
// reset — compared normalized because the parent rewrites null to default_value
let lastEmitted: ConfigValueType | undefined;

seedCells();

// re-served setup-flow steps reuse this component instance (keyed on entry.key),
// so an externally changed value must resync the boxes instead of keeping stale ones
watch(
  () => props.entry.value,
  (value) => {
    if (!layout.value || normalizeCode(value) === normalizeCode(lastEmitted)) {
      return;
    }
    if (normalizeCode(value) === cells.value.join("")) return;
    seedCells();
    lastEmitted = undefined;
    if (!props.disabled) codeInput.value?.focusFirstEmpty();
  },
);

// a re-served step may carry a different format for the same entry key
watch(slotCount, seedCells);

// all-or-null: an incomplete code emits null so required-value gating keeps
// the submit button disabled until every box is filled
function onCellsUpdate(parts: string[]) {
  cells.value = parts;
  const value = parts.every((cell) => cell) ? parts.join("") : null;
  lastEmitted = value;
  emit("update:value", value);
}

function onFallbackInput(value: string | number) {
  // an emptied input reads as a cleared entry
  emit("update:value", value === "" ? null : String(value));
}

function seedCells() {
  const code = normalizeCode(props.entry.value);
  cells.value = Array.from(
    { length: slotCount.value },
    (_, index) => code[index] ?? "",
  );
}

function normalizeCode(value: unknown): string {
  return sanitizeCode(String(value ?? "")).slice(0, slotCount.value);
}
</script>

<template>
  <div class="flex w-full flex-col gap-2 py-1">
    <span :id="labelId" class="text-muted-foreground text-sm">{{ label }}</span>
    <SegmentedCodeInput
      v-if="layout"
      ref="codeInput"
      :model-value="cells"
      :layout="layout"
      :disabled="disabled"
      otp-autofill
      :aria-label="label"
      :aria-labelledby="labelId"
      cell-class="pairing-code-input"
      separator-class="pairing-code-separator"
      @update:model-value="onCellsUpdate"
    />

    <!-- no (valid) format: plain text input so the entry stays usable -->
    <Input
      v-else
      class="pairing-code-fallback text-center font-mono tracking-wider"
      :model-value="String(entry.value ?? '')"
      :placeholder="entry.default_value?.toString()"
      :disabled="disabled"
      :aria-labelledby="labelId"
      @update:model-value="onFallbackInput"
    />
  </div>
</template>
