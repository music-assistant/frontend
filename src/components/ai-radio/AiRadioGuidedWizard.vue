<template>
  <Dialog v-model:open="guidedWizardOpen">
    <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-[760px]">
      <DialogHeader>
        <DialogTitle>{{ $t("providers.ai_radio.wizard.title") }}</DialogTitle>
        <DialogDescription>
          {{ $t("providers.ai_radio.wizard.description") }}
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4">
        <div class="text-xs text-muted-foreground">
          {{ $t("providers.ai_radio.wizard.step", [guidedWizardStep]) }}
        </div>

        <div v-if="guidedWizardStep === 1" class="space-y-4">
          <div class="space-y-2">
            <Label for="guided-station-name">{{
              $t("providers.ai_radio.fields.station_name")
            }}</Label>
            <Input
              id="guided-station-name"
              v-model="guidedWizardStationName"
              :placeholder="
                $t('providers.ai_radio.wizard.station_name_placeholder')
              "
            />
          </div>

          <div class="space-y-2">
            <Label for="guided-source-playlist">{{
              $t("providers.ai_radio.fields.source_playlist")
            }}</Label>
            <NativeSelect
              id="guided-source-playlist"
              v-model="guidedWizardSourcePlaylistSelectValue"
              class="w-full"
            >
              <NativeSelectOption value="">
                {{ $t("providers.ai_radio.placeholders.select") }}
              </NativeSelectOption>
              <NativeSelectOption
                v-for="playlist in playlists"
                :key="playlistSelectValue(playlist.provider, playlist.item_id)"
                :value="
                  playlistSelectValue(playlist.provider, playlist.item_id)
                "
              >
                {{ playlist.name }} ({{ playlist.provider }}:{{
                  playlist.item_id
                }})
              </NativeSelectOption>
            </NativeSelect>
          </div>

          <div class="space-y-2">
            <Label for="guided-default-player">{{
              $t("providers.ai_radio.fields.default_playback_device")
            }}</Label>
            <Select v-model="guidedDefaultPlayerSelectValue">
              <SelectTrigger id="guided-default-player" class="w-full">
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
        </div>

        <div v-else-if="guidedWizardStep === 2" class="space-y-5">
          <div class="space-y-2">
            <Label>{{
              $t("providers.ai_radio.wizard.choose_existing_sections")
            }}</Label>
            <p class="text-xs text-muted-foreground">
              {{
                $t("providers.ai_radio.wizard.choose_existing_sections_help")
              }}
            </p>
            <div
              class="max-h-[240px] space-y-2 overflow-y-auto rounded-md border p-3"
            >
              <label
                v-for="section in wizardSelectableSections"
                :key="`guided-${section.id}`"
                class="flex items-start gap-2 rounded-md border p-2"
              >
                <Checkbox
                  class="mt-0.5"
                  :model-value="guidedWizardSectionIds.includes(section.id)"
                  @update:model-value="
                    (value) => onGuidedSectionToggle(section.id, value === true)
                  "
                />
                <span class="text-sm">
                  <span class="font-medium">{{ section.name }}</span>
                </span>
              </label>
            </div>
          </div>

          <div class="space-y-2 rounded-md border p-3">
            <Label>{{ $t("providers.ai_radio.wizard.add_new_section") }}</Label>
            <p class="text-xs text-muted-foreground">
              {{ $t("providers.ai_radio.wizard.add_new_section_help") }}
            </p>
            <div class="grid gap-3 md:grid-cols-2">
              <div class="space-y-2">
                <Label for="guided-new-section-name">{{
                  $t("providers.ai_radio.fields.section_name")
                }}</Label>
                <Input
                  id="guided-new-section-name"
                  v-model="guidedNewSectionName"
                  :placeholder="
                    $t('providers.ai_radio.wizard.section_name_placeholder')
                  "
                />
              </div>
              <div class="space-y-2">
                <Label for="guided-new-section-placement">{{
                  $t("providers.ai_radio.fields.insert_at")
                }}</Label>
                <Select v-model="guidedNewSectionPlacement">
                  <SelectTrigger
                    id="guided-new-section-placement"
                    class="w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="start_of_playlist">
                      {{ $t("providers.ai_radio.placement.start") }}
                    </SelectItem>
                    <SelectItem value="between_songs">
                      {{ $t("providers.ai_radio.placement.between") }}
                    </SelectItem>
                    <SelectItem value="end_of_playlist">
                      {{ $t("providers.ai_radio.placement.end") }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div class="space-y-2 md:col-span-2">
                <Label for="guided-new-section-prompt">{{
                  $t("providers.ai_radio.fields.prompt")
                }}</Label>
                <Textarea
                  id="guided-new-section-prompt"
                  v-model="guidedNewSectionPrompt"
                  rows="4"
                />
              </div>
            </div>
            <Button
              class="mt-1"
              variant="outline"
              :disabled="creatingGuidedSection"
              @click="createGuidedSection"
            >
              {{
                creatingGuidedSection
                  ? $t("providers.ai_radio.actions.adding")
                  : $t("providers.ai_radio.actions.add_section")
              }}
            </Button>
          </div>

          <div class="space-y-2">
            <Label>{{
              $t("providers.ai_radio.wizard.selected_sections")
            }}</Label>
            <div
              v-if="guidedWizardSelectedSections.length === 0"
              class="rounded-md border border-dashed p-3 text-xs text-muted-foreground"
            >
              {{ $t("providers.ai_radio.wizard.no_sections_selected") }}
            </div>
            <div v-else class="space-y-2">
              <div
                v-for="section in guidedWizardSelectedSections"
                :key="`guided-placement-${section.id}`"
                class="grid items-center gap-2 rounded-md border p-2 md:grid-cols-[1fr_220px]"
              >
                <div class="text-sm font-medium">{{ section.name }}</div>
                <Select
                  :model-value="
                    guidedWizardSectionPlacements[section.id] || 'between_songs'
                  "
                  @update:model-value="
                    (value) =>
                      setGuidedSectionPlacement(
                        section.id,
                        value as AIRadioPlacement,
                      )
                  "
                >
                  <SelectTrigger class="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="start_of_playlist">
                      {{ $t("providers.ai_radio.placement.start") }}
                    </SelectItem>
                    <SelectItem value="between_songs">
                      {{ $t("providers.ai_radio.placement.between") }}
                    </SelectItem>
                    <SelectItem value="end_of_playlist">
                      {{ $t("providers.ai_radio.placement.end") }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div class="space-y-2">
            <Label for="guided-merge-section">{{
              $t("providers.ai_radio.fields.merge_section")
            }}</Label>
            <Select v-model="guidedMergeSectionSelectValue">
              <SelectTrigger id="guided-merge-section" class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem :value="NONE_SELECT_VALUE">
                  {{ $t("providers.ai_radio.placeholders.none") }}
                </SelectItem>
                <SelectItem
                  v-for="section in guidedWizardMergeSectionOptions"
                  :key="`guided-merge-${section.id}`"
                  :value="section.id"
                >
                  {{ section.name }}
                </SelectItem>
              </SelectContent>
            </Select>
            <p class="text-xs text-muted-foreground">
              {{ $t("providers.ai_radio.wizard.merge_section_help") }}
            </p>
          </div>
        </div>

        <div v-else class="space-y-3 text-sm">
          <div class="rounded-md border p-3">
            <div>
              <span class="font-medium"
                >{{ $t("providers.ai_radio.wizard.summary_name") }}:</span
              >
              {{ guidedWizardStationName }}
            </div>
            <div>
              <span class="font-medium"
                >{{ $t("providers.ai_radio.wizard.summary_source") }}:</span
              >
              {{ guidedWizardSourcePlaylistLabel }}
            </div>
            <div>
              <span class="font-medium"
                >{{ $t("providers.ai_radio.wizard.summary_sections") }}:</span
              >
              {{
                guidedWizardSelectedSectionNames.join(", ") ||
                $t("providers.ai_radio.placeholders.none")
              }}
            </div>
            <div v-if="guidedWizardSectionPlacementSummary.length">
              <span class="font-medium"
                >{{ $t("providers.ai_radio.wizard.summary_placement") }}:</span
              >
              {{ guidedWizardSectionPlacementSummary.join(" | ") }}
            </div>
            <div v-if="guidedWizardMergeSectionName">
              <span class="font-medium"
                >{{
                  $t("providers.ai_radio.wizard.summary_merge_section")
                }}:</span
              >
              {{ guidedWizardMergeSectionName }}
            </div>
          </div>
          <p class="text-xs text-muted-foreground">
            {{ $t("providers.ai_radio.wizard.summary_help") }}
          </p>
        </div>
      </div>

      <DialogFooter class="gap-2">
        <Button variant="outline" @click="guidedWizardOpen = false">
          {{ $t("providers.ai_radio.actions.cancel") }}
        </Button>
        <Button
          v-if="guidedWizardStep > 1"
          variant="outline"
          @click="guidedWizardStep = guidedWizardStep - 1"
        >
          {{ $t("providers.ai_radio.actions.back") }}
        </Button>
        <Button
          v-if="guidedWizardStep < 3"
          :disabled="!canProceedGuidedWizardStep"
          @click="guidedWizardStep = guidedWizardStep + 1"
        >
          {{ $t("providers.ai_radio.actions.next") }}
        </Button>
        <Button
          v-else
          :disabled="creatingGuidedStation"
          @click="onCreateStation"
        >
          {{
            creatingGuidedStation
              ? $t("providers.ai_radio.actions.creating")
              : $t("providers.ai_radio.actions.create_station")
          }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useAiRadioWizard } from "@/composables/ai-radio/useAiRadioWizard";
import { NONE_SELECT_VALUE, playlistSelectValue } from "@/helpers/ai_radio";
import type {
  AIRadioPlacement,
  AIRadioStation,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";

const emit = defineEmits<{
  created: [station: AIRadioStation];
}>();

const { players, playlists } = useAiRadioEditor();
const {
  guidedWizardOpen,
  guidedWizardStep,
  creatingGuidedStation,
  guidedWizardStationName,
  guidedWizardSourcePlaylistSelectValue,
  guidedWizardDefaultPlayerId,
  guidedWizardSectionIds,
  guidedWizardMergeSectionId,
  guidedWizardSectionPlacements,
  creatingGuidedSection,
  guidedNewSectionName,
  guidedNewSectionPrompt,
  guidedNewSectionPlacement,
  wizardSelectableSections,
  guidedWizardSelectedSections,
  guidedWizardMergeSectionOptions,
  guidedWizardSelectedSectionNames,
  guidedWizardMergeSectionName,
  guidedWizardSectionPlacementSummary,
  guidedWizardSourcePlaylistLabel,
  canProceedGuidedWizardStep,
  onGuidedSectionToggle,
  setGuidedSectionPlacement,
  createGuidedSection,
  createGuidedStation,
} = useAiRadioWizard();

const guidedDefaultPlayerSelectValue = computed({
  get: () => guidedWizardDefaultPlayerId.value || NONE_SELECT_VALUE,
  set: (value: string) => {
    guidedWizardDefaultPlayerId.value =
      value === NONE_SELECT_VALUE ? "" : value;
  },
});

const guidedMergeSectionSelectValue = computed({
  get: () => guidedWizardMergeSectionId.value || NONE_SELECT_VALUE,
  set: (value: string) => {
    guidedWizardMergeSectionId.value = value === NONE_SELECT_VALUE ? "" : value;
  },
});

const onCreateStation = async () => {
  const saved = await createGuidedStation();
  if (saved) {
    emit("created", saved);
  }
};
</script>
