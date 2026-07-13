<template>
  <Card>
    <CardHeader>
      <CardTitle>{{ $t("providers.ai_radio.run.title") }}</CardTitle>
      <CardDescription>
        {{ $t("providers.ai_radio.run.description") }}
      </CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="space-y-2">
        <Label for="ai-radio-run-station">{{
          $t("providers.ai_radio.fields.station")
        }}</Label>
        <Select
          :model-value="selectedRunStationId"
          @update:model-value="(value) => onSelectRunStation(value as string)"
        >
          <SelectTrigger id="ai-radio-run-station" class="w-full">
            <SelectValue
              :placeholder="$t('providers.ai_radio.placeholders.station')"
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="station in stations"
              :key="station.id"
              :value="station.id"
            >
              {{ station.name }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div
        v-if="hasSourcePlaylistOverride"
        class="space-y-2 rounded-md border border-dashed p-3"
      >
        <div class="text-sm font-medium">
          {{ $t("providers.ai_radio.run.source_playlist_override") }}
        </div>
        <p class="text-xs text-muted-foreground">
          {{ $t("providers.ai_radio.run.source_playlist_override_help") }}
        </p>
        <div class="text-sm">
          {{ sourcePlaylistOverrideName || sourcePlaylistOverrideId }}
        </div>
        <div class="text-xs text-muted-foreground">
          {{ sourcePlaylistOverrideProvider }}:{{ sourcePlaylistOverrideId }}
        </div>
        <Button
          variant="ghost"
          size="sm"
          class="h-auto justify-start px-0"
          @click="clearSourcePlaylistOverride"
        >
          {{ $t("providers.ai_radio.run.use_station_source_playlist") }}
        </Button>
      </div>

      <div class="space-y-2">
        <Label for="ai-radio-run-player">{{
          $t("providers.ai_radio.run.playback_device_override")
        }}</Label>
        <Select
          :model-value="selectedRunPlayerSelectValue"
          @update:model-value="(value) => onSelectRunPlayer(value as string)"
        >
          <SelectTrigger id="ai-radio-run-player" class="w-full">
            <SelectValue
              :placeholder="
                $t('providers.ai_radio.placeholders.use_station_default')
              "
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem :value="DEFAULT_PLAYER_SELECT_VALUE">
              {{ $t("providers.ai_radio.placeholders.use_station_default") }}
            </SelectItem>
            <SelectItem
              v-for="player in availableRunPlayers"
              :key="player.player_id"
              :value="player.player_id"
            >
              {{ player.name }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <details class="rounded-md border p-3">
        <summary class="cursor-pointer select-none text-sm font-medium">
          {{ $t("providers.ai_radio.run.advanced") }}
        </summary>
        <div class="mt-3 grid gap-4 md:grid-cols-2">
          <div class="space-y-2">
            <Label for="ai-radio-run-source-cap">{{
              $t("providers.ai_radio.run.source_playtime_cap_override")
            }}</Label>
            <Input
              id="ai-radio-run-source-cap"
              v-model="runSourcePlaytimeCapOverrideInput"
              type="number"
              min="0"
              step="1"
              :placeholder="
                $t('providers.ai_radio.placeholders.use_station_default')
              "
            />
          </div>
          <div class="space-y-2">
            <Label for="ai-radio-run-batch-size">{{
              $t("providers.ai_radio.run.dynamic_batch_size_override")
            }}</Label>
            <Input
              id="ai-radio-run-batch-size"
              v-model="runDynamicBatchSizeOverrideInput"
              type="number"
              min="1"
              step="1"
              :placeholder="
                $t('providers.ai_radio.placeholders.use_station_default')
              "
            />
          </div>
        </div>
      </details>

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="space-y-1">
          <Button
            class="w-full"
            :disabled="!selectedRunStationId || startingRun"
            @click="runStart('playlist')"
          >
            <ListMusic class="mr-1 h-4 w-4" />
            {{
              startingRun
                ? $t("providers.ai_radio.actions.starting")
                : $t("providers.ai_radio.actions.create_playlist")
            }}
          </Button>
          <p class="text-xs text-muted-foreground">
            {{ $t("providers.ai_radio.run.create_playlist_hint") }}
          </p>
        </div>
        <div class="space-y-1">
          <Button
            class="w-full"
            :disabled="!selectedRunStationId || startingRun"
            @click="runStart('dynamic')"
          >
            <Radio class="mr-1 h-4 w-4" />
            {{
              startingRun
                ? $t("providers.ai_radio.actions.starting")
                : $t("providers.ai_radio.actions.start_live_radio")
            }}
          </Button>
          <p class="text-xs text-muted-foreground">
            {{ $t("providers.ai_radio.run.start_live_hint") }}
          </p>
        </div>
      </div>

      <div class="border-t pt-3">
        <Button variant="outline" @click="openGuidedStationCreator">
          {{ $t("providers.ai_radio.actions.create_station_guided") }}
        </Button>
        <p class="mt-2 text-xs text-muted-foreground">
          {{ $t("providers.ai_radio.run.guided_hint") }}
        </p>
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAiRadio } from "@/composables/ai-radio/useAiRadio";
import { useAiRadioEditor } from "@/composables/ai-radio/useAiRadioEditor";
import {
  DEFAULT_PLAYER_SELECT_VALUE,
  useAiRadioRun,
} from "@/composables/ai-radio/useAiRadioRun";
import { useAiRadioWizard } from "@/composables/ai-radio/useAiRadioWizard";
import { $t } from "@/plugins/i18n";
import { ListMusic, Radio } from "@lucide/vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();

const { startingRun } = useAiRadio();
const { stations } = useAiRadioEditor();
const {
  selectedRunStationId,
  runSourcePlaytimeCapOverrideInput,
  runDynamicBatchSizeOverrideInput,
  sourcePlaylistOverrideId,
  sourcePlaylistOverrideProvider,
  sourcePlaylistOverrideName,
  hasSourcePlaylistOverride,
  selectedRunPlayerSelectValue,
  availableRunPlayers,
  resetSourcePlaylistOverride,
  onSelectRunStation,
  onSelectRunPlayer,
  runStart,
} = useAiRadioRun();
const { openGuidedStationCreator } = useAiRadioWizard();

const clearSourcePlaylistOverride = async () => {
  resetSourcePlaylistOverride();

  const query = { ...route.query };
  delete query.source_playlist_id;
  delete query.source_playlist_provider;
  delete query.source_playlist_name;
  await router.replace({ query });
};
</script>
