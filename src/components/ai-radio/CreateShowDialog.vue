<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-[560px]">
      <DialogHeader>
        <DialogTitle>{{ $t("providers.ai_radio.create.title") }}</DialogTitle>
        <DialogDescription>
          {{ $t("providers.ai_radio.create.description") }}
        </DialogDescription>
      </DialogHeader>

      <div
        class="flex max-h-[60vh] flex-col gap-5 overflow-x-hidden overflow-y-auto -mx-6 px-6 py-1"
      >
        <Tabs
          :model-value="mode"
          @update:model-value="(value) => (mode = value as CreateMode)"
        >
          <TabsList class="grid grid-cols-2">
            <TabsTrigger value="preset">
              {{ $t("providers.ai_radio.create.mode_preset") }}
            </TabsTrigger>
            <TabsTrigger value="import">
              {{ $t("providers.ai_radio.create.mode_import") }}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div class="flex flex-col gap-2">
          <Label>{{ $t("providers.ai_radio.create.playlist_label") }}</Label>
          <AiRadioPlaylistPicker v-model="selectedPlaylist" />
        </div>

        <template v-if="mode === 'import'">
          <Alert variant="warning">
            <TriangleAlert class="h-4 w-4" />
            <AlertTitle>
              {{ $t("providers.ai_radio.create.import_warning_title") }}
            </AlertTitle>
            <AlertDescription>
              {{ $t("providers.ai_radio.create.import_warning_description") }}
            </AlertDescription>
          </Alert>

          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between gap-2">
              <Label for="ai-radio-import-json">
                {{ $t("providers.ai_radio.create.import_label") }}
              </Label>
              <Button variant="outline" size="sm" @click="fileInput?.click()">
                <Upload class="h-4 w-4" />
                {{ $t("providers.ai_radio.create.import_file") }}
              </Button>
              <input
                ref="fileInput"
                type="file"
                accept="application/json,.json"
                class="hidden"
                :aria-label="$t('providers.ai_radio.create.import_file')"
                @change="onFileSelected"
              />
            </div>
            <Textarea
              id="ai-radio-import-json"
              v-model="importText"
              rows="8"
              class="font-mono text-xs"
              :placeholder="$t('providers.ai_radio.create.import_placeholder')"
            />
            <p v-if="importError" class="text-xs text-destructive">
              {{ importError }}
            </p>
            <p v-else-if="importedShow" class="text-xs text-muted-foreground">
              {{
                $t("providers.ai_radio.create.import_summary", [
                  importedShow.name,
                  importedShow.segments.length,
                ])
              }}
            </p>
          </div>
        </template>

        <div v-else class="flex flex-col gap-2">
          <Label>{{ $t("providers.ai_radio.create.preset_label") }}</Label>
          <div class="grid grid-cols-2 gap-3">
            <button
              v-for="preset in PRESETS"
              :key="preset.key"
              type="button"
              class="flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors hover:bg-accent"
              :class="
                selectedPresetKey === preset.key
                  ? 'border-primary ring-1 ring-primary'
                  : 'border-border'
              "
              @click="selectedPresetKey = preset.key"
            >
              <component :is="getLucideIcon(preset.icon)" class="h-5 w-5" />
              <span class="text-sm font-medium">{{
                $t(presetNameKey(preset.key))
              }}</span>
              <span class="line-clamp-2 text-xs text-muted-foreground">
                {{ $t(presetDescriptionKey(preset.key)) }}
              </span>
            </button>
          </div>
        </div>

        <div v-if="mode === 'preset'" class="flex flex-col gap-2">
          <Label>{{ $t("providers.ai_radio.create.talk_label") }}</Label>
          <Slider
            :model-value="[talkLevelIndex]"
            :min="0"
            :max="2"
            :step="1"
            @update:model-value="onTalkSlider"
          />
          <div class="flex justify-between text-xs text-muted-foreground">
            <span
              v-for="level in TALK_LEVELS"
              :key="level"
              :class="{ 'font-medium text-foreground': talkLevel === level }"
            >
              {{ $t(`providers.ai_radio.talk.${level}`) }}
            </span>
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <Label for="ai-radio-show-name">
            {{ $t("providers.ai_radio.create.name_label") }}
          </Label>
          <Input
            id="ai-radio-show-name"
            v-model="showName"
            @input="nameManuallyEdited = true"
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="emit('update:open', false)">
          {{ $t("cancel") }}
        </Button>
        <Button variant="outline" :disabled="isBusy" @click="doCreate(false)">
          {{
            creating
              ? $t("providers.ai_radio.create.creating")
              : $t("providers.ai_radio.create.create")
          }}
        </Button>
        <Button :disabled="isBusy" @click="doCreate(true)">
          {{
            creatingAndPlaying
              ? $t("providers.ai_radio.create.creating")
              : $t("providers.ai_radio.create.create_and_play")
          }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import AiRadioPlaylistPicker, {
  type PlaylistSelection,
} from "@/components/ai-radio/AiRadioPlaylistPicker.vue";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useShows } from "@/composables/ai-radio/useShows";
import {
  applyTalkativeness,
  asGeneralDefaults,
  compileShow,
  errorMessage,
  parseSharedShow,
  PRESETS,
  resolveShowPlayerId,
  type SharedShow,
  sharedShowToDraft,
  type ShowDraft,
  type ShowPresetKey,
  slugify,
  type TalkativenessLevel,
} from "@/helpers/ai_radio";
import { getLucideIcon } from "@/helpers/icon";
import type { AIRadioStation } from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { TriangleAlert, Upload } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { toast } from "vue-sonner";

const props = defineProps<{
  open: boolean;
  initialPlaylist?: PlaylistSelection;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const TALK_LEVELS: TalkativenessLevel[] = ["rarely", "normal", "chatty"];

type CreateMode = "preset" | "import";

const { shows, saveShow, startShow, reportStartError } = useShows();

const mode = ref<CreateMode>("preset");
const selectedPlaylist = ref<PlaylistSelection | undefined>();
const selectedPresetKey = ref<ShowPresetKey>("morning_show");
const talkLevel = ref<TalkativenessLevel>("normal");
const showName = ref("");
const nameManuallyEdited = ref(false);
const creating = ref(false);
const creatingAndPlaying = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const importText = ref("");
const importError = ref("");
const importedShow = ref<SharedShow | null>(null);

const isBusy = computed(() => creating.value || creatingAndPlaying.value);
const talkLevelIndex = computed(() => TALK_LEVELS.indexOf(talkLevel.value));

function presetNameKey(key: ShowPresetKey) {
  return `providers.ai_radio.presets.${key}.name`;
}
function presetDescriptionKey(key: ShowPresetKey) {
  return `providers.ai_radio.presets.${key}.description`;
}

function onTalkSlider(value: number[] | undefined) {
  talkLevel.value = TALK_LEVELS[value?.[0] ?? 1] ?? "normal";
}

function defaultShowName(): string {
  if (mode.value === "import") {
    return importedShow.value?.name || "";
  }
  const presetName = $t(presetNameKey(selectedPresetKey.value));
  if (!selectedPlaylist.value) return presetName;
  return $t("providers.ai_radio.create.default_name", [
    presetName,
    selectedPlaylist.value.name,
  ]);
}

function resetForm(initialPlaylist?: PlaylistSelection) {
  mode.value = "preset";
  selectedPlaylist.value = initialPlaylist;
  selectedPresetKey.value = "morning_show";
  talkLevel.value = "normal";
  nameManuallyEdited.value = false;
  importText.value = "";
  importError.value = "";
  importedShow.value = null;
  showName.value = defaultShowName();
}

/** Re-parses the pasted/loaded document on every change so Create reflects it. */
function parseImportText() {
  importedShow.value = null;
  if (!importText.value.trim()) {
    importError.value = "";
    return;
  }
  try {
    importedShow.value = parseSharedShow(importText.value);
    importError.value = "";
  } catch (error) {
    importError.value = errorMessage(error);
  }
}

async function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  // reset first, so picking the same file twice still fires a change event
  input.value = "";
  if (!file) return;
  importText.value = await file.text();
}

watch(
  () => props.open,
  (isOpen) => {
    store.dialogActive = isOpen;
    if (isOpen) {
      resetForm(props.initialPlaylist);
    }
  },
);

watch([selectedPresetKey, selectedPlaylist, mode, importedShow], () => {
  if (!nameManuallyEdited.value) {
    showName.value = defaultShowName();
  }
});

watch(importText, parseImportText);

function buildDraft(): ShowDraft {
  if (mode.value === "import") {
    if (!importedShow.value) {
      throw new Error($t("providers.ai_radio.validation.invalid_import_file"));
    }
    const draft = sharedShowToDraft(importedShow.value, selectedPlaylist.value);
    draft.basics.name = showName.value.trim();
    return draft;
  }
  const preset = PRESETS.find((item) => item.key === selectedPresetKey.value);
  if (!preset) {
    throw new Error(`Unknown preset: ${selectedPresetKey.value}`);
  }
  const general = asGeneralDefaults(undefined);
  general.instructions = preset.instructions;
  return {
    basics: {
      name: showName.value.trim(),
      sourcePlaylistId: selectedPlaylist.value?.itemId || "",
      sourcePlaylistProvider: selectedPlaylist.value?.provider || "library",
      defaultPlayerId: "",
      maxDurationMinutes: 0,
      shuffleSourceTracks: true,
      general,
    },
    segments: applyTalkativeness(preset.segments, talkLevel.value),
  };
}

function validate(): string | null {
  if (!selectedPlaylist.value) {
    return $t("providers.ai_radio.create.validation.playlist_required");
  }
  if (!showName.value.trim()) {
    return $t("providers.ai_radio.create.validation.name_required");
  }
  if (mode.value === "import" && !importedShow.value) {
    return (
      importError.value ||
      $t("providers.ai_radio.create.validation.import_required")
    );
  }
  return null;
}

/**
 * The show a save would replace, if any: compileShow derives the station id
 * from the name, and saving under an existing id overwrites it server-side.
 */
function showToBeOverwritten(): AIRadioStation | undefined {
  const targetId = slugify(showName.value.trim());
  return shows.value.find((show) => show.id === targetId);
}

async function doCreate(andPlay: boolean) {
  if (isBusy.value) return;
  const validationError = validate();
  if (validationError) {
    toast.error(validationError);
    return;
  }
  const existing = showToBeOverwritten();
  if (!existing) {
    await saveAndClose(andPlay);
    return;
  }
  eventbus.emit("deleteConfirmationDialog", {
    title: $t("providers.ai_radio.confirm.overwrite_show_title"),
    message: $t("providers.ai_radio.confirm.overwrite_show", [existing.name]),
    confirmLabel: $t("providers.ai_radio.confirm.overwrite_show_label"),
    onConfirm: () => saveAndClose(andPlay),
  });
}

async function saveAndClose(andPlay: boolean) {
  const busyRef = andPlay ? creatingAndPlaying : creating;
  busyRef.value = true;
  try {
    const station = compileShow(buildDraft());
    const saved = await saveShow(station);
    emit("update:open", false);
    if (andPlay) {
      await playAfterCreate(saved.id, saved.default_player_id);
    }
  } catch (error) {
    toast.error(errorMessage(error));
  } finally {
    busyRef.value = false;
  }
}

async function playAfterCreate(stationId: string, defaultPlayerId?: string) {
  const playerId = resolveShowPlayerId(
    { default_player_id: defaultPlayerId },
    store.activePlayerId,
  );
  if (!playerId) {
    toast.error($t("providers.ai_radio.card.no_player"));
    return;
  }
  try {
    await startShow(stationId, { playerIdOverride: playerId });
  } catch (error) {
    const message = errorMessage(error);
    toast.error($t("providers.ai_radio.card.start_failed", [message]));
    reportStartError(message);
  }
}
</script>
