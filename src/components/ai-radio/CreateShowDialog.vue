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
        <div class="flex flex-col gap-2">
          <Label>{{ $t("providers.ai_radio.create.playlist_label") }}</Label>
          <AiRadioPlaylistPicker v-model="selectedPlaylist" />
        </div>

        <div class="flex flex-col gap-2">
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

        <div class="flex flex-col gap-2">
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
import { useShows } from "@/composables/ai-radio/useShows";
import {
  applyTalkativeness,
  asGeneralDefaults,
  compileShow,
  errorMessage,
  PRESETS,
  resolveShowPlayerId,
  type ShowDraft,
  type ShowPresetKey,
  type TalkativenessLevel,
} from "@/helpers/ai_radio";
import { getLucideIcon } from "@/helpers/icon";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
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

const { saveShow, startShow, reportStartError } = useShows();

const selectedPlaylist = ref<PlaylistSelection | undefined>();
const selectedPresetKey = ref<ShowPresetKey>("morning_show");
const talkLevel = ref<TalkativenessLevel>("normal");
const showName = ref("");
const nameManuallyEdited = ref(false);
const creating = ref(false);
const creatingAndPlaying = ref(false);

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
  const presetName = $t(presetNameKey(selectedPresetKey.value));
  if (!selectedPlaylist.value) return presetName;
  return $t("providers.ai_radio.create.default_name", [
    presetName,
    selectedPlaylist.value.name,
  ]);
}

function resetForm(initialPlaylist?: PlaylistSelection) {
  selectedPlaylist.value = initialPlaylist;
  selectedPresetKey.value = "morning_show";
  talkLevel.value = "normal";
  nameManuallyEdited.value = false;
  showName.value = defaultShowName();
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

watch([selectedPresetKey, selectedPlaylist], () => {
  if (!nameManuallyEdited.value) {
    showName.value = defaultShowName();
  }
});

function buildDraft(): ShowDraft {
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
      targetPlaylistProvider: "builtin",
      defaultPlayerId: "",
      maxDurationMinutes: 0,
      dynamicBatchSize: 1,
      dynamicPollSeconds: 5,
      dynamicPrefetchRemainingTracks: 2,
      clearQueueOnStart: true,
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
  return null;
}

async function doCreate(andPlay: boolean) {
  if (isBusy.value) return;
  const validationError = validate();
  if (validationError) {
    toast.error(validationError);
    return;
  }
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
    await startShow(stationId, "dynamic", { playerIdOverride: playerId });
  } catch (error) {
    const message = errorMessage(error);
    toast.error($t("providers.ai_radio.card.start_failed", [message]));
    reportStartError(message);
  }
}
</script>
