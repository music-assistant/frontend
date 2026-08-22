<template>
  <div class="flex flex-col gap-2 rounded-md border p-2">
    <div class="flex items-center gap-2">
      <NativeSelect
        v-model="fieldModel"
        class="w-36 shrink-0"
        :aria-label="$t('providers.library_automations.form.conditions_label')"
      >
        <option v-for="field in CONDITION_FIELDS" :key="field" :value="field">
          {{
            $t(`providers.library_automations.form.condition_field_${field}`)
          }}
        </option>
      </NativeSelect>

      <NativeSelect
        v-if="showOperatorSelect"
        v-model="operatorModel"
        class="w-32 shrink-0"
      >
        <option value="eq">
          {{ $t("providers.library_automations.form.condition_operator_eq") }}
        </option>
        <option value="contains">
          {{
            $t("providers.library_automations.form.condition_operator_contains")
          }}
        </option>
        <option value="in">
          {{ $t("providers.library_automations.form.condition_operator_in") }}
        </option>
      </NativeSelect>

      <NativeSelect
        v-if="condition.field === 'provider'"
        v-model="scalarValueModel"
        class="flex-1"
      >
        <option value="" disabled>
          {{
            $t(
              "providers.library_automations.form.condition_provider_placeholder",
            )
          }}
        </option>
        <option
          v-for="provider in musicProviders"
          :key="provider.instance_id"
          :value="provider.instance_id"
        >
          {{ provider.name }}
        </option>
      </NativeSelect>

      <NativeSelect
        v-else-if="condition.field === 'explicit'"
        v-model="explicitValueModel"
        class="flex-1"
      >
        <option value="true">{{ $t("yes") }}</option>
        <option value="false">{{ $t("no") }}</option>
      </NativeSelect>

      <Input
        v-else-if="condition.field !== 'in_playlist'"
        v-model="scalarValueModel"
        class="flex-1"
        :placeholder="
          $t('providers.library_automations.form.condition_value_placeholder')
        "
      />

      <div v-else class="flex-1"></div>

      <Button
        variant="ghost-icon"
        size="icon-sm"
        :aria-label="$t('remove')"
        @click="emit('remove')"
      >
        <Trash2 class="h-4 w-4" />
      </Button>
    </div>

    <p v-if="fieldHint" class="text-xs text-muted-foreground">
      {{ fieldHint }}
    </p>

    <div v-if="condition.field === 'in_playlist'" class="flex flex-col gap-1.5">
      <p v-if="playlists.length === 0" class="text-xs text-muted-foreground">
        {{ $t("providers.library_automations.form.condition_playlists_empty") }}
      </p>
      <div v-else class="flex flex-wrap gap-x-4 gap-y-1.5">
        <label
          v-for="playlist in playlists"
          :key="playlist.item_id"
          class="flex items-center gap-2 text-sm"
        >
          <Checkbox
            :model-value="
              selectedPlaylistIds.includes(String(playlist.item_id))
            "
            @update:model-value="
              (checked) => togglePlaylist(String(playlist.item_id), !!checked)
            "
          />
          {{ playlist.name }}
        </label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type {
  LibraryAutomationCondition,
  Playlist,
  ProviderInstance,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { Trash2 } from "@lucide/vue";
import { computed } from "vue";

// Mirrors music_assistant/providers/library_automations/conditions.py::SUPPORTED_CONDITION_FIELDS
// on the server - not exposed via an API command, so the list is duplicated here.
const CONDITION_FIELDS = [
  "name",
  "genre",
  "provider",
  "explicit",
  "in_playlist",
] as const;
// Fields with a dedicated value picker (dropdown/checkboxes) instead of the operator + free-text
// input pair; these always evaluate as an exact/membership match, so the operator is hidden and
// hardcoded when the field changes (see fieldModel's setter below).
const PICKER_FIELDS = new Set(["provider", "explicit", "in_playlist"]);

const props = defineProps<{
  condition: LibraryAutomationCondition;
  musicProviders: ProviderInstance[];
  playlists: Playlist[];
}>();

const emit = defineEmits<{
  update: [condition: LibraryAutomationCondition];
  remove: [];
}>();

const showOperatorSelect = computed(
  () => !PICKER_FIELDS.has(props.condition.field),
);

const fieldHint = computed(() => {
  if (props.condition.field === "name") {
    return $t("providers.library_automations.form.condition_field_hint_name");
  }
  if (props.condition.field === "genre") {
    return $t("providers.library_automations.form.condition_field_hint_genre");
  }
  return "";
});

const fieldModel = computed({
  get: () => props.condition.field,
  set: (value: string) => {
    // switching field resets value/operator to a sensible default for the new field's
    // input type, instead of e.g. carrying a free-text string over into the playlist picker
    const operator = PICKER_FIELDS.has(value) ? "in" : "contains";
    const initialValue =
      value === "in_playlist" ? [] : value === "explicit" ? true : "";
    emit("update", { field: value, operator, value: initialValue });
  },
});

const operatorModel = computed({
  get: () => props.condition.operator,
  set: (value: string) =>
    emit("update", {
      ...props.condition,
      operator: value as LibraryAutomationCondition["operator"],
    }),
});

const scalarValueModel = computed({
  get: () => String(props.condition.value ?? ""),
  set: (value: string) => emit("update", { ...props.condition, value }),
});

const explicitValueModel = computed({
  get: () => (props.condition.value === true ? "true" : "false"),
  set: (value: string) =>
    emit("update", { ...props.condition, value: value === "true" }),
});

const selectedPlaylistIds = computed(() =>
  Array.isArray(props.condition.value) ? props.condition.value.map(String) : [],
);

function togglePlaylist(playlistId: string, checked: boolean) {
  const current = selectedPlaylistIds.value;
  const next = checked
    ? [...current, playlistId]
    : current.filter((id) => id !== playlistId);
  emit("update", { ...props.condition, value: next });
}
</script>
