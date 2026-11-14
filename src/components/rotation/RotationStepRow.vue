<template>
  <div
    :class="
      cn(
        'flex items-start gap-2 rounded-lg border bg-card p-2',
        grouped && 'ml-6',
      )
    "
  >
    <!-- the list owns the drag; it reads pointer and arrow keys from here -->
    <button
      v-if="index > 0"
      type="button"
      data-drag-handle
      class="mt-1 cursor-grab touch-none rounded-sm text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      :title="$t('rotation.step.drag')"
      :aria-label="$t('rotation.step.drag')"
    >
      <GripVertical class="h-4 w-4" />
    </button>
    <span v-else class="w-4 shrink-0"></span>

    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <div class="flex flex-wrap items-center gap-2 text-sm">
        <i18n-t
          v-if="step.type === 'source'"
          keypath="rotation.step.source"
          scope="global"
        >
          <template #kind>
            <RotationChipSelect
              :model-value="step.media_type"
              :options="kindOptions"
              :label="$t('rotation.step.chip.kind')"
              :error="errorTextAt(errors, 'media_type')"
              @update:model-value="onSourceKind"
            />
          </template>
        </i18n-t>

        <RotationFilterSentence
          v-else-if="step.type === 'filter'"
          :step="step"
          :fields="fields"
          :providers="describe.providers"
          :errors="errors"
          @update="emit('update', $event)"
        />

        <RotationSortSentence
          v-else-if="step.type === 'sort'"
          :step="step"
          :sort-fields="sortKeyFields"
          :errors="errors"
          @update="emit('update', $event)"
        />

        <i18n-t
          v-else-if="step.type === 'limit'"
          keypath="rotation.step.limit"
          scope="global"
        >
          <template #count>
            <NumberField
              class="w-20"
              :model-value="limitValue"
              :min="1"
              :aria-label="$t('rotation.step.only_first')"
              @update:model-value="onLimitValue"
            >
              <NumberFieldContent>
                <NumberFieldInput class="h-7" />
              </NumberFieldContent>
            </NumberField>
          </template>
          <template #unit>
            <RotationChipSelect
              :model-value="limitUnit"
              :options="limitUnitOptions"
              :label="$t('rotation.step.chip.limit_unit')"
              @update:model-value="onLimitUnit"
            />
          </template>
        </i18n-t>

        <i18n-t
          v-else-if="step.type === 'expand' && step.to === 'album'"
          :keypath="expandKey"
          scope="global"
          tag="span"
          data-testid="rotation-expand-phrase"
          :class="
            cn(
              'flex flex-wrap items-center gap-2',
              expandError && 'text-destructive',
            )
          "
          :aria-invalid="expandError ? 'true' : undefined"
          :title="expandError"
        >
          <template #scope>
            <RotationChipSelect
              :model-value="step.scope ?? 'library'"
              :options="scopeOptions"
              :label="$t('rotation.step.chip.scope')"
              :error="errorTextAt(errors, 'scope')"
              @update:model-value="onScope"
            />
          </template>
        </i18n-t>

        <span
          v-else-if="step.type === 'expand'"
          data-testid="rotation-expand-phrase"
          :class="expandError && 'text-destructive'"
          :aria-invalid="expandError ? 'true' : undefined"
          :title="expandError"
        >
          {{ $t(expandKey) }}
        </span>

        <span v-else>{{ $t("rotation.step.flatten") }}</span>
      </div>
      <p
        v-for="(error, i) in errors"
        :key="i"
        class="text-xs text-destructive"
        role="alert"
      >
        {{ error.message }}
      </p>
      <RotationLibraryHint
        v-if="step.type === 'filter'"
        :step="step"
        :albums-from-library="albumsFromLibrary"
      />
    </div>

    <span
      v-if="countText"
      class="mt-1 shrink-0 text-xs whitespace-nowrap text-muted-foreground"
    >
      {{ countText }}
    </span>
    <Button
      v-if="index > 0"
      variant="ghost"
      size="icon"
      class="h-7 w-7 shrink-0"
      :aria-label="$t('rotation.step.remove_step')"
      @click="emit('remove')"
    >
      <X class="h-4 w-4" />
    </Button>
  </div>
</template>

<script setup lang="ts">
import RotationChipSelect from "@/components/rotation/RotationChipSelect.vue";
import RotationFilterSentence from "@/components/rotation/RotationFilterSentence.vue";
import RotationLibraryHint from "@/components/rotation/RotationLibraryHint.vue";
import RotationSortSentence from "@/components/rotation/RotationSortSentence.vue";
import { Button } from "@/components/ui/button";
import {
  NumberField,
  NumberFieldContent,
  NumberFieldInput,
} from "@/components/ui/number-field";
import type { ListState } from "@/helpers/rotation";
import { conditionFields, sortFields } from "@/helpers/rotation_conditions";
import { errorTextAt } from "@/helpers/rotation_errors";
import { cn } from "@/lib/utils";
import type {
  RotationDescribe,
  RotationMediaType,
  RotationStep,
  RotationStepError,
} from "@/plugins/api/interfaces";
import { $t, i18n } from "@/plugins/i18n";
import { GripVertical, X } from "@lucide/vue";
import { computed } from "vue";

const KINDS: RotationMediaType[] = ["artist", "album", "track"];
const DEFAULT_LIMIT = 10;

const props = defineProps<{
  step: RotationStep;
  index: number;
  state: ListState;
  describe: RotationDescribe;
  count?: { count: number; exact: boolean };
  errors: RotationStepError[];
  grouped: boolean;
  // the step works on albums taken from the library
  albumsFromLibrary?: boolean;
}>();

const emit = defineEmits<{
  update: [step: RotationStep];
  remove: [];
}>();

const fields = computed(() =>
  conditionFields(props.state.kind, props.describe),
);
const sortKeyFields = computed(() =>
  sortFields(props.state.kind, props.describe),
);

const kindOptions = computed(() =>
  KINDS.map((kind) => ({
    value: kind,
    label: $t(`rotation.kind_plural.${kind}`),
  })),
);
const scopeOptions = computed(() => [
  { value: "library", label: $t("rotation.step.scope_library") },
  { value: "providers", label: $t("rotation.step.scope_providers") },
]);
const limitUnitOptions = computed(() => [
  { value: "items", label: $t("rotation.step.items", limitValue.value) },
  { value: "minutes", label: $t("rotation.step.minutes", limitValue.value) },
]);

// a move can leave an expand on a list it cannot expand; it still needs a sentence
const expandKey = computed(() => {
  if (props.step.type !== "expand") return "";
  const key = `rotation.step.expand.${props.state.kind}_${props.step.to}`;
  return i18n.global.te(key, "en")
    ? key
    : `rotation.step.expand.any_${props.step.to}`;
});
const expandError = computed(() => errorTextAt(props.errors, "to"));

const outputKind = computed<RotationMediaType>(() => {
  if (props.step.type === "source") return props.step.media_type;
  if (props.step.type === "expand") return props.step.to;
  return props.state.kind;
});

const countText = computed(() => {
  if (!props.count) return "";
  const key = props.count.exact ? "count" : "count_at_least";
  return $t(
    `rotation.${key}.${outputKind.value}`,
    { count: props.count.count },
    props.count.count,
  );
});

const limitUnit = computed(() =>
  props.step.type === "limit" && props.step.minutes != null
    ? "minutes"
    : "items",
);
const limitValue = computed(() => {
  if (props.step.type !== "limit") return DEFAULT_LIMIT;
  return props.step.minutes ?? props.step.count ?? DEFAULT_LIMIT;
});

function onSourceKind(kind: string) {
  emit("update", {
    type: "source",
    media_type: kind as RotationMediaType,
    from: "library",
  });
}

function onLimitValue(value: number | undefined) {
  const next =
    value === undefined || Number.isNaN(value) ? DEFAULT_LIMIT : value;
  emit(
    "update",
    limitUnit.value === "minutes"
      ? { type: "limit", minutes: next }
      : { type: "limit", count: next },
  );
}

function onLimitUnit(unit: string) {
  emit(
    "update",
    unit === "minutes"
      ? { type: "limit", minutes: limitValue.value }
      : { type: "limit", count: limitValue.value },
  );
}

function onScope(scope: string) {
  if (props.step.type !== "expand") return;
  emit("update", { ...props.step, scope: scope as "library" | "providers" });
}
</script>
