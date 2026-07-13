<template>
  <div class="grid gap-4 lg:grid-cols-[300px_1fr]">
    <Card>
      <CardHeader>
        <CardTitle>{{ $t("providers.ai_radio.stations.title") }}</CardTitle>
        <CardDescription>{{
          $t("providers.ai_radio.stations.description")
        }}</CardDescription>
      </CardHeader>
      <CardContent class="space-y-3">
        <div class="flex flex-wrap gap-2">
          <Button size="sm" @click="createNewStationDraft">{{
            $t("providers.ai_radio.actions.new")
          }}</Button>
          <Button size="sm" variant="outline" @click="openGuidedStationCreator">
            {{ $t("providers.ai_radio.actions.guided") }}
          </Button>
          <Button size="sm" variant="outline" @click="triggerStationImport">
            {{ $t("providers.ai_radio.actions.import") }}
          </Button>
        </div>
        <input
          ref="stationImportInput"
          type="file"
          accept="application/json"
          class="hidden"
          @change="onStationImport"
        />

        <div
          class="max-h-[560px] space-y-1 overflow-y-auto rounded-md border p-2"
        >
          <button
            v-for="station in stations"
            :key="station.id"
            class="w-full rounded-md px-3 py-2 text-left text-sm transition"
            :class="
              selectedEditorStationId === station.id
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted'
            "
            @click="selectStationForEdit(station.id)"
          >
            <div class="font-medium">{{ station.name }}</div>
            <div class="text-xs opacity-80">{{ station.id }}</div>
          </button>
        </div>
      </CardContent>
    </Card>

    <AiRadioStationEditor />
  </div>
</template>

<script setup lang="ts">
import AiRadioStationEditor from "@/components/ai-radio/AiRadioStationEditor.vue";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAiRadioEditor } from "@/composables/ai-radio/useAiRadioEditor";
import { useAiRadioStationDraft } from "@/composables/ai-radio/useAiRadioStationDraft";
import { useAiRadioWizard } from "@/composables/ai-radio/useAiRadioWizard";
import { $t } from "@/plugins/i18n";
import { ref } from "vue";

const { stations } = useAiRadioEditor();
const {
  selectedEditorStationId,
  createNewStationDraft,
  selectStationForEdit,
  importStationFile,
} = useAiRadioStationDraft();
const { openGuidedStationCreator } = useAiRadioWizard();

const stationImportInput = ref<HTMLInputElement | null>(null);

const triggerStationImport = () => {
  stationImportInput.value?.click();
};

const onStationImport = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) {
    return;
  }
  try {
    await importStationFile(file);
  } finally {
    target.value = "";
  }
};
</script>
