<template>
  <Dialog :open="open" @update:open="onOpenChange">
    <DialogContent class="sm:max-w-[560px]">
      <DialogHeader>
        <DialogTitle>
          {{
            isEditing
              ? $t("providers.library_automations.form.edit_title")
              : $t("providers.library_automations.form.create_title")
          }}
        </DialogTitle>
      </DialogHeader>

      <div
        class="-mx-6 flex max-h-[65vh] flex-col gap-5 overflow-x-hidden overflow-y-auto px-6 py-1"
      >
        <div class="flex flex-col gap-2">
          <Label for="la-rule-name">
            {{ $t("providers.library_automations.form.name_label") }}
          </Label>
          <Input
            id="la-rule-name"
            v-model="name"
            :placeholder="
              $t('providers.library_automations.form.name_placeholder')
            "
          />
        </div>

        <div class="flex flex-col gap-2">
          <Label for="la-trigger-type">
            {{ $t("providers.library_automations.form.trigger_label") }}
          </Label>
          <NativeSelect
            id="la-trigger-type"
            v-model="triggerType"
            class="w-full"
          >
            <option
              v-for="triggerOption in triggerTypes"
              :key="triggerOption.id"
              :value="triggerOption.id"
            >
              {{ localizedTriggerTitle(triggerOption.id, triggerOption.label) }}
            </option>
          </NativeSelect>
          <p v-if="triggerDescription" class="text-xs text-muted-foreground">
            {{ triggerDescription }}
          </p>
        </div>

        <div class="flex flex-col gap-2">
          <Label>
            {{ $t("providers.library_automations.form.media_types_label") }}
          </Label>
          <div class="flex flex-wrap gap-4">
            <label
              v-for="mediaType in MEDIA_TYPE_OPTIONS"
              :key="mediaType"
              class="flex items-center gap-2 text-sm"
            >
              <Checkbox
                :model-value="mediaTypes.includes(mediaType)"
                @update:model-value="
                  (checked) => toggleMediaType(mediaType, !!checked)
                "
              />
              {{
                $t(`providers.library_automations.form.media_type_${mediaType}`)
              }}
            </label>
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <Label for="la-action-type">
            {{ $t("providers.library_automations.form.action_label") }}
          </Label>
          <NativeSelect id="la-action-type" v-model="actionType" class="w-full">
            <option
              v-for="actionOption in actionTypes"
              :key="actionOption.id"
              :value="actionOption.id"
            >
              {{ localizedActionTitle(actionOption.id, actionOption.label) }}
            </option>
          </NativeSelect>
          <p v-if="actionDescription" class="text-xs text-muted-foreground">
            {{ actionDescription }}
          </p>
        </div>

        <div v-if="actionNeedsPlaylistName" class="flex flex-col gap-2">
          <Label for="la-playlist-name">
            {{ $t("providers.library_automations.form.playlist_name_label") }}
          </Label>
          <Input
            id="la-playlist-name"
            v-model="playlistName"
            :placeholder="
              $t('providers.library_automations.form.playlist_name_placeholder')
            "
          />
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <Label>
              {{ $t("providers.library_automations.form.conditions_label") }}
            </Label>
            <Button variant="outline" size="sm" @click="addCondition">
              <Plus class="mr-1 h-3.5 w-3.5" />
              {{ $t("providers.library_automations.form.conditions_add") }}
            </Button>
          </div>
          <NativeSelect
            v-if="conditions.length > 1"
            v-model="conditionLogic"
            class="w-full"
          >
            <option value="AND">
              {{ $t("providers.library_automations.form.condition_logic_and") }}
            </option>
            <option value="OR">
              {{ $t("providers.library_automations.form.condition_logic_or") }}
            </option>
          </NativeSelect>
          <LibraryAutomationConditionRow
            v-for="(condition, index) in conditions"
            :key="index"
            :condition="condition"
            :music-providers="musicProviders"
            :playlists="playlists"
            @update="(updated) => updateCondition(index, updated)"
            @remove="removeCondition(index)"
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="onOpenChange(false)">
          {{ $t("providers.library_automations.form.cancel") }}
        </Button>
        <Button :disabled="!canSave || saving" @click="onSave">
          {{
            saving
              ? $t("providers.library_automations.form.saving")
              : isEditing
                ? $t("providers.library_automations.form.save")
                : $t("providers.library_automations.form.create")
          }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import LibraryAutomationConditionRow from "@/components/library-automations/LibraryAutomationConditionRow.vue";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useLibraryAutomationRules } from "@/composables/library-automations/useLibraryAutomationRules";
import {
  errorMessage,
  localizedActionDescription,
  localizedActionTitle,
  localizedTriggerDescription,
  localizedTriggerTitle,
} from "@/helpers/library_automations";
import api from "@/plugins/api";
import type {
  LibraryAutomationCondition,
  LibraryAutomationRule,
  LibraryAutomationTypeInfo,
  Playlist,
  ProviderInstance,
} from "@/plugins/api/interfaces";
import { ProviderType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { Plus } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { toast } from "vue-sonner";

const MEDIA_TYPE_OPTIONS = ["track", "album", "artist"] as const;
// Actions whose params include a target playlist name (see
// music_assistant/providers/library_automations/models.py::ACTION_ADD_TO_PLAYLIST /
// ACTION_REMOVE_FROM_PLAYLIST on the server).
const PLAYLIST_ACTION_TYPES = new Set([
  "add_to_playlist",
  "remove_from_playlist",
]);

const props = defineProps<{
  open: boolean;
  rule: LibraryAutomationRule | null;
  triggerTypes: LibraryAutomationTypeInfo[];
  actionTypes: LibraryAutomationTypeInfo[];
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const {
  createRule,
  updateRule,
  savingRule: saving,
} = useLibraryAutomationRules();

const isEditing = computed(() => props.rule !== null);

const name = ref("");
const triggerType = ref("");
const mediaTypes = ref<string[]>(["track"]);
const actionType = ref("");
const playlistName = ref("");
const conditions = ref<LibraryAutomationCondition[]>([]);
const conditionLogic = ref<"AND" | "OR">("AND");
const musicProviders = ref<ProviderInstance[]>([]);
const playlists = ref<Playlist[]>([]);

function resetForm() {
  if (props.rule) {
    name.value = props.rule.name;
    triggerType.value = props.rule.trigger.type;
    mediaTypes.value = [...props.rule.trigger.media_types];
    actionType.value = props.rule.action.type;
    playlistName.value =
      (props.rule.action.params?.playlist_name as string | undefined) || "";
    conditions.value = props.rule.conditions.map((condition) => ({
      ...condition,
    }));
    conditionLogic.value = props.rule.condition_logic;
  } else {
    name.value = "";
    triggerType.value = props.triggerTypes[0]?.id || "";
    mediaTypes.value = ["track"];
    actionType.value = props.actionTypes[0]?.id || "";
    playlistName.value = "";
    conditions.value = [];
    conditionLogic.value = "AND";
  }
}

async function loadConditionPickerData() {
  musicProviders.value = Object.values(api.providers).filter(
    (provider) => provider.type === ProviderType.MUSIC && provider.available,
  );
  try {
    playlists.value = await api.getLibraryPlaylists(undefined, undefined, 500);
  } catch (error) {
    toast.error(errorMessage(error));
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      resetForm();
      void loadConditionPickerData();
    }
  },
);

const triggerDescription = computed(() => {
  if (!triggerType.value) return "";
  const fallback =
    props.triggerTypes.find((t) => t.id === triggerType.value)?.description ||
    "";
  return localizedTriggerDescription(triggerType.value, fallback);
});
const actionDescription = computed(() => {
  if (!actionType.value) return "";
  const fallback =
    props.actionTypes.find((t) => t.id === actionType.value)?.description || "";
  return localizedActionDescription(actionType.value, fallback);
});
const actionNeedsPlaylistName = computed(() =>
  PLAYLIST_ACTION_TYPES.has(actionType.value),
);

const canSave = computed(
  () =>
    name.value.trim().length > 0 &&
    triggerType.value.length > 0 &&
    mediaTypes.value.length > 0 &&
    actionType.value.length > 0 &&
    (!actionNeedsPlaylistName.value || playlistName.value.trim().length > 0),
);

function toggleMediaType(mediaType: string, checked: boolean) {
  if (checked) {
    if (!mediaTypes.value.includes(mediaType)) mediaTypes.value.push(mediaType);
  } else {
    mediaTypes.value = mediaTypes.value.filter((mt) => mt !== mediaType);
  }
}

function addCondition() {
  conditions.value.push({ field: "name", operator: "contains", value: "" });
}

function updateCondition(index: number, condition: LibraryAutomationCondition) {
  conditions.value[index] = condition;
}

function removeCondition(index: number) {
  conditions.value.splice(index, 1);
}

function onOpenChange(value: boolean) {
  emit("update:open", value);
}

async function onSave() {
  // Keep the server-cached playlist_id (see actions.py::_resolve_target_playlist)
  // only when the action type and playlist name are unchanged from the stored
  // rule - otherwise the server would keep adding to the old playlist despite
  // the rename.
  const existingParams =
    isEditing.value &&
    props.rule &&
    props.rule.action.type === actionType.value &&
    (props.rule.action.params?.playlist_name as string | undefined) ===
      playlistName.value.trim()
      ? props.rule.action.params
      : {};
  const actionParams = actionNeedsPlaylistName.value
    ? { ...existingParams, playlist_name: playlistName.value.trim() }
    : {};

  const payload = {
    name: name.value.trim(),
    trigger: {
      type: triggerType.value,
      media_types: mediaTypes.value,
      params: {},
    },
    action: { type: actionType.value, params: actionParams },
    conditions: conditions.value,
    condition_logic: conditionLogic.value,
  };

  try {
    if (isEditing.value && props.rule) {
      await updateRule(props.rule.id, payload);
    } else {
      await createRule(payload);
    }
    onOpenChange(false);
  } catch (error) {
    toast.error(errorMessage(error));
  }
}
</script>
