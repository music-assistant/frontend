<template>
  <Card>
    <CardHeader>
      <CardTitle>{{ $t("providers.ai_radio.station_editor.title") }}</CardTitle>
      <CardDescription>
        {{ $t("providers.ai_radio.station_editor.description") }}
      </CardDescription>
    </CardHeader>
    <CardContent v-if="stationDraft" class="space-y-6">
      <div class="grid gap-4 md:grid-cols-2">
        <div class="space-y-2 md:col-span-2">
          <Label for="station-name">{{
            $t("providers.ai_radio.fields.station_name")
          }}</Label>
          <Input id="station-name" v-model="stationDraft.name" />
        </div>

        <div class="space-y-2">
          <Label for="station-source-select">{{
            $t("providers.ai_radio.fields.source_playlist")
          }}</Label>
          <NativeSelect
            id="station-source-select"
            v-model="stationSourcePlaylistSelectValue"
            class="w-full"
          >
            <NativeSelectOption value="">
              {{ $t("providers.ai_radio.placeholders.select") }}
            </NativeSelectOption>
            <NativeSelectOption
              v-for="playlist in playlists"
              :key="playlistSelectValue(playlist.provider, playlist.item_id)"
              :value="playlistSelectValue(playlist.provider, playlist.item_id)"
            >
              {{ playlist.name }} ({{ playlist.provider }}:{{
                playlist.item_id
              }})
            </NativeSelectOption>
            <NativeSelectOption value="__custom__">
              {{
                $t("providers.ai_radio.station_editor.custom_source_playlist")
              }}
            </NativeSelectOption>
          </NativeSelect>
        </div>

        <div class="space-y-2">
          <Label for="station-default-player">{{
            $t("providers.ai_radio.fields.default_playback_device")
          }}</Label>
          <Select v-model="stationDefaultPlayerSelectValue">
            <SelectTrigger id="station-default-player" class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem :value="NONE_SELECT_VALUE">
                {{ $t("providers.ai_radio.placeholders.none") }}
              </SelectItem>
              <SelectItem
                v-for="player in players"
                :key="player.player_id"
                :value="player.player_id"
              >
                {{ player.name
                }}{{
                  player.available === false
                    ? ` (${$t("providers.ai_radio.misc.not_available")})`
                    : ""
                }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div
          v-if="stationSourcePlaylistSelectValue === '__custom__'"
          class="space-y-2"
        >
          <Label for="station-source-provider">{{
            $t("providers.ai_radio.fields.source_playlist_provider")
          }}</Label>
          <Input
            id="station-source-provider"
            v-model="stationDraft.source_playlist_provider"
          />
        </div>

        <div
          v-if="stationSourcePlaylistSelectValue === '__custom__'"
          class="space-y-2"
        >
          <Label for="station-source-id">{{
            $t("providers.ai_radio.fields.source_playlist_id")
          }}</Label>
          <Input
            id="station-source-id"
            v-model="stationDraft.source_playlist_id"
          />
        </div>

        <div class="space-y-2">
          <Label for="station-duration-cap">{{
            $t("providers.ai_radio.fields.source_playtime_cap")
          }}</Label>
          <Input
            id="station-duration-cap"
            v-model="stationMaxDurationInput"
            type="number"
            min="0"
            step="1"
          />
        </div>

        <div class="space-y-2">
          <Label for="station-target-provider">{{
            $t("providers.ai_radio.fields.target_playlist_provider")
          }}</Label>
          <Input
            id="station-target-provider"
            v-model="stationDraft.target_playlist_provider"
          />
        </div>

        <div class="space-y-2 md:col-span-2">
          <Label>{{ $t("providers.ai_radio.fields.selected_sections") }}</Label>
          <div
            class="max-h-[240px] space-y-2 overflow-y-auto rounded-md border p-3"
          >
            <label
              v-for="section in sections"
              :key="section.id"
              class="flex items-start gap-2 rounded-md border p-2"
            >
              <Checkbox
                class="mt-0.5"
                :model-value="stationDraft.section_ids?.includes(section.id)"
                @update:model-value="
                  (value) => onSectionToggle(section.id, value === true)
                "
              />
              <span class="text-sm">
                <span class="font-medium">{{ section.name }}</span>
              </span>
            </label>
          </div>
        </div>

        <div class="space-y-2 md:col-span-2">
          <Label for="station-merge-section">{{
            $t("providers.ai_radio.fields.merge_section")
          }}</Label>
          <Select v-model="stationMergeSectionSelectValue">
            <SelectTrigger id="station-merge-section" class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem :value="NONE_SELECT_VALUE">
                {{ $t("providers.ai_radio.placeholders.none") }}
              </SelectItem>
              <SelectItem
                v-for="option in mergeSectionOptions"
                :key="option.id"
                :value="option.id"
              >
                {{ option.name }}
              </SelectItem>
            </SelectContent>
          </Select>
          <p class="text-xs text-muted-foreground">
            {{ $t("providers.ai_radio.station_editor.merge_section_help") }}
          </p>
        </div>
      </div>

      <AiRadioFlowEditor />

      <details class="rounded-md border p-4">
        <summary class="cursor-pointer select-none text-sm font-medium">
          {{ $t("providers.ai_radio.station_editor.advanced") }}
        </summary>
        <div
          class="mt-5 grid gap-x-6 gap-y-5 md:grid-cols-2 md:gap-x-8 [&>div]:min-w-0"
        >
          <div class="space-y-2">
            <Label for="station-id">{{
              $t("providers.ai_radio.fields.station_id")
            }}</Label>
            <Input
              id="station-id"
              v-model="stationDraft.id"
              :disabled="Boolean(selectedEditorStationId)"
            />
            <p
              v-if="selectedEditorStationId"
              class="text-xs text-muted-foreground"
            >
              {{ $t("providers.ai_radio.misc.id_locked") }}
            </p>
          </div>
          <div class="space-y-2">
            <Label for="station-clear-queue">{{
              $t("providers.ai_radio.fields.clear_queue_on_dynamic_start")
            }}</Label>
            <div class="flex h-10 items-center rounded-md border px-3">
              <Checkbox
                id="station-clear-queue"
                :model-value="stationDraft.clear_queue_on_start"
                @update:model-value="
                  (value) => {
                    if (stationDraft) {
                      stationDraft.clear_queue_on_start = value === true;
                    }
                  }
                "
              />
            </div>
          </div>

          <div class="space-y-2">
            <Label for="station-dynamic-batch">{{
              $t("providers.ai_radio.fields.dynamic_batch_size")
            }}</Label>
            <Input
              id="station-dynamic-batch"
              v-model="stationDynamicBatchSizeInput"
              type="number"
              min="1"
              step="1"
            />
          </div>
          <div class="space-y-2">
            <Label for="station-dynamic-prefetch">{{
              $t("providers.ai_radio.fields.dynamic_prefetch_remaining")
            }}</Label>
            <Input
              id="station-dynamic-prefetch"
              v-model="stationDynamicPrefetchInput"
              type="number"
              min="1"
              step="1"
            />
          </div>

          <div class="space-y-2">
            <Label for="station-dynamic-poll">{{
              $t("providers.ai_radio.fields.dynamic_poll_seconds")
            }}</Label>
            <Input
              id="station-dynamic-poll"
              v-model="stationDynamicPollInput"
              type="number"
              min="1"
              step="1"
            />
          </div>

          <div class="space-y-2">
            <Label for="station-general-timezone">{{
              $t("providers.ai_radio.fields.timezone")
            }}</Label>
            <Input
              id="station-general-timezone"
              v-model="stationDraft.general.timezone"
            />
          </div>
          <div class="space-y-2">
            <Label for="station-general-city">{{
              $t("providers.ai_radio.fields.weather_city")
            }}</Label>
            <Input
              id="station-general-city"
              v-model="stationDraft.general.location.city"
            />
          </div>
          <div class="space-y-2">
            <Label for="station-general-country">{{
              $t("providers.ai_radio.fields.weather_country")
            }}</Label>
            <Input
              id="station-general-country"
              v-model="stationDraft.general.location.country"
            />
          </div>
          <div class="space-y-2">
            <Label for="station-general-weather-provider">{{
              $t("providers.ai_radio.fields.weather_provider")
            }}</Label>
            <Input
              id="station-general-weather-provider"
              v-model="stationDraft.general.weather_provider"
            />
          </div>
          <div class="space-y-2">
            <Label for="station-general-weather-timeout">{{
              $t("providers.ai_radio.fields.weather_timeout_seconds")
            }}</Label>
            <Input
              id="station-general-weather-timeout"
              v-model="stationWeatherTimeoutInput"
              type="number"
              min="1"
              step="1"
            />
          </div>
          <div class="space-y-2 md:col-span-2">
            <Label for="station-general-instructions">{{
              $t("providers.ai_radio.fields.instructions")
            }}</Label>
            <Textarea
              id="station-general-instructions"
              v-model="stationDraft.general.instructions"
              rows="6"
            />
          </div>
        </div>
      </details>

      <div class="flex flex-wrap gap-2">
        <Button :disabled="savingStation" @click="saveStationDraft">
          {{
            savingStation
              ? $t("providers.ai_radio.actions.saving")
              : $t("providers.ai_radio.actions.save_station")
          }}
        </Button>
        <Button variant="outline" @click="validateStationDraftOnServer">
          {{ $t("providers.ai_radio.actions.validate") }}
        </Button>
        <Button variant="outline" @click="exportStationDraft">{{
          $t("providers.ai_radio.actions.export")
        }}</Button>
        <Button
          variant="destructive"
          :disabled="!selectedEditorStationId || deletingStation"
          @click="removeSelectedStation"
        >
          {{
            deletingStation
              ? $t("providers.ai_radio.actions.deleting")
              : $t("providers.ai_radio.actions.delete")
          }}
        </Button>
      </div>
    </CardContent>
    <CardContent v-else>
      <p class="text-sm text-muted-foreground">
        {{ $t("providers.ai_radio.station_editor.empty") }}
      </p>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import AiRadioFlowEditor from "@/components/ai-radio/AiRadioFlowEditor.vue";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAiRadioEditor } from "@/composables/ai-radio/useAiRadioEditor";
import { useAiRadioStationDraft } from "@/composables/ai-radio/useAiRadioStationDraft";
import {
  NONE_SELECT_VALUE,
  playlistSelectValue,
  safeInteger,
  safeNumber,
  splitPlaylistSelectValue,
} from "@/helpers/ai_radio";
import type { AIRadioSection } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";

const { sections, players, playlists, savingStation, deletingStation } =
  useAiRadioEditor();
const {
  selectedEditorStationId,
  stationDraft,
  saveStationDraft,
  validateStationDraftOnServer,
  removeSelectedStation,
  exportStationDraft,
} = useAiRadioStationDraft();

const stationSourcePlaylistSelectValue = computed({
  get: () => {
    if (!stationDraft.value) {
      return "";
    }
    const provider = String(
      stationDraft.value.source_playlist_provider || "",
    ).trim();
    const itemId = String(stationDraft.value.source_playlist_id || "").trim();
    if (!provider || !itemId) {
      return "";
    }
    const value = playlistSelectValue(provider, itemId);
    const inList = playlists.value.some(
      (item) => playlistSelectValue(item.provider, item.item_id) === value,
    );
    return inList ? value : "__custom__";
  },
  set: (value: string) => {
    if (!stationDraft.value || !value) {
      return;
    }
    if (value === "__custom__") {
      if (!stationDraft.value.source_playlist_provider) {
        stationDraft.value.source_playlist_provider = "library";
      }
      return;
    }
    const { provider, itemId } = splitPlaylistSelectValue(value);
    stationDraft.value.source_playlist_provider = provider;
    stationDraft.value.source_playlist_id = itemId;
  },
});

const stationDefaultPlayerSelectValue = computed({
  get: () => stationDraft.value?.default_player_id || NONE_SELECT_VALUE,
  set: (value: string) => {
    if (!stationDraft.value) {
      return;
    }
    stationDraft.value.default_player_id =
      value === NONE_SELECT_VALUE ? "" : value;
  },
});

const stationMergeSectionSelectValue = computed({
  get: () => stationDraft.value?.merge_section_id || NONE_SELECT_VALUE,
  set: (value: string) => {
    if (!stationDraft.value) {
      return;
    }
    stationDraft.value.merge_section_id =
      value === NONE_SELECT_VALUE ? "" : value;
  },
});

const stationSelectedSections = computed<AIRadioSection[]>(() => {
  if (!stationDraft.value) {
    return [];
  }
  const selected = new Set(stationDraft.value.section_ids || []);
  return sections.value.filter((section) => selected.has(section.id));
});

const mergeSectionOptions = computed(() => {
  return stationSelectedSections.value.filter(
    (section) => section.type === "ai_meta",
  );
});

const stationMaxDurationInput = computed({
  get: () => String(stationDraft.value?.max_duration_minutes ?? 0),
  set: (value: string) => {
    if (!stationDraft.value) {
      return;
    }
    stationDraft.value.max_duration_minutes = safeNumber(value, 0, 0);
  },
});

const stationDynamicBatchSizeInput = computed({
  get: () => String(stationDraft.value?.dynamic_batch_size ?? 1),
  set: (value: string) => {
    if (!stationDraft.value) {
      return;
    }
    stationDraft.value.dynamic_batch_size = safeNumber(value, 1, 1);
  },
});

const stationDynamicPrefetchInput = computed({
  get: () => String(stationDraft.value?.dynamic_prefetch_remaining_tracks ?? 2),
  set: (value: string) => {
    if (!stationDraft.value) {
      return;
    }
    stationDraft.value.dynamic_prefetch_remaining_tracks = safeNumber(
      value,
      1,
      1,
    );
  },
});

const stationDynamicPollInput = computed({
  get: () => String(stationDraft.value?.dynamic_poll_seconds ?? 5),
  set: (value: string) => {
    if (!stationDraft.value) {
      return;
    }
    stationDraft.value.dynamic_poll_seconds = safeNumber(value, 1, 1);
  },
});

const stationWeatherTimeoutInput = computed({
  get: () => String(stationDraft.value?.general?.weather_timeout_seconds ?? 8),
  set: (value: string) => {
    if (!stationDraft.value) {
      return;
    }
    stationDraft.value.general.weather_timeout_seconds = safeInteger(
      value,
      1,
      8,
    );
  },
});

const onSectionToggle = (sectionId: string, checked: boolean) => {
  if (!stationDraft.value) {
    return;
  }
  const selected = new Set(stationDraft.value.section_ids || []);
  if (checked) {
    selected.add(sectionId);
  } else {
    selected.delete(sectionId);
  }
  // Keep the stored order aligned with the section library order.
  stationDraft.value.section_ids = sections.value
    .filter((section) => selected.has(section.id))
    .map((section) => section.id);
  if (
    stationDraft.value.merge_section_id &&
    !stationDraft.value.section_ids.includes(
      stationDraft.value.merge_section_id,
    )
  ) {
    stationDraft.value.merge_section_id = "";
  }
};
</script>
