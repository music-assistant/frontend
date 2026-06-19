<template>
  <!-- Stable wrapper carries the outer layout margin so neither inner element
       needs a horizontal margin of its own — a margin combined with the
       input's width:100% would push it past the container edge. -->
  <div class="recordings-filter-root">
    <!-- Editable state: free-text filter the user can type into. -->
    <input
      v-if="!committed"
      ref="inputEl"
      :value="modelValue"
      type="search"
      :placeholder="$t('classical_filter_recordings_placeholder')"
      :aria-label="$t('classical_filter_recordings_placeholder')"
      class="recordings-filter-input"
      @input="onInput"
      @keydown.enter.prevent="$emit('commit')"
    />
    <!-- Committed state: status banner driven by a performer context arrival or
         a user-committed term. Clicking the text returns to the input. -->
    <div v-else class="filter-banner">
      <button type="button" class="filter-banner-text" @click="$emit('edit')">
        <i18n-t v-if="count > 0" :keypath="bannerKey" tag="span">
          <template #count>
            <strong>{{ count }}</strong>
          </template>
          <template #noun>
            {{
              count === 1
                ? $t("classical_recording")
                : $t("classical_recordings_lower")
            }}
          </template>
          <template v-if="performerName" #performer>
            <strong>{{ performerName }}</strong>
          </template>
          <template v-else #term>
            <strong>{{ term }}</strong>
          </template>
        </i18n-t>
        <i18n-t v-else keypath="classical_filter_no_match" tag="span">
          <template #term>
            <strong>{{ displayTerm }}</strong>
          </template>
        </i18n-t>
      </button>
      <button type="button" class="filter-banner-clear" @click="$emit('clear')">
        {{ $t("classical_filter_show_all") }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";

defineOptions({ name: "RecordingsFilter" });

const props = defineProps<{
  modelValue: string;
  committed: boolean;
  count: number;
  performerName?: string;
  term?: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
  (e: "commit"): void;
  (e: "edit"): void;
  (e: "clear"): void;
}>();

const inputEl = ref<HTMLInputElement | null>(null);

const bannerKey = computed(() =>
  props.performerName
    ? "classical_filter_showing_by"
    : "classical_filter_showing_matching",
);

// The no-match line names whatever drove the filter — the performer for a
// context arrival, otherwise the typed term.
const displayTerm = computed(() => props.performerName || props.term || "");

const onInput = (e: Event) =>
  emit("update:modelValue", (e.target as HTMLInputElement).value);

// Focus the field when returning from a banner to the editable state so the
// pre-filled term can be edited straight away. preventScroll stops the browser
// from scrolling the input into view, which would jump the layout.
watch(
  () => props.committed,
  (committed, was) => {
    if (was && !committed)
      nextTick(() => inputEl.value?.focus({ preventScroll: true }));
  },
);
</script>

<style scoped>
.recordings-filter-input {
  width: 100%;
  padding: 0.45rem 0.7rem;
  border-radius: 6px;
  border: 1px solid var(--border, #444);
  background: var(--card, transparent);
  color: inherit;
  font: inherit;
}

.filter-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.6rem 0.9rem;
  border-radius: 8px;
  background: var(--muted, rgba(255, 255, 255, 0.05));
  border: 1px solid var(--border, #2a2a2a);
  font-size: 0.9rem;
}

.filter-banner-text {
  flex: 1;
  min-width: 0;
  text-align: left;
  background: transparent;
  border: 0;
  padding: 0;
  font: inherit;
  color: inherit;
  cursor: pointer;
}

.filter-banner-clear {
  background: transparent;
  border: 1px solid var(--border, #444);
  border-radius: 6px;
  padding: 0.3rem 0.7rem;
  font: inherit;
  color: inherit;
  cursor: pointer;
  white-space: nowrap;
}

.filter-banner-clear:hover {
  background: var(--accent, rgba(255, 255, 255, 0.08));
}
</style>
