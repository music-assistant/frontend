<template>
  <div class="grid gap-4 lg:grid-cols-[300px_1fr]">
    <Card>
      <CardHeader>
        <CardTitle>{{ $t("providers.ai_radio.sections.title") }}</CardTitle>
        <CardDescription>{{
          $t("providers.ai_radio.sections.description")
        }}</CardDescription>
      </CardHeader>
      <CardContent class="space-y-3">
        <div class="flex flex-wrap gap-2">
          <Button size="sm" @click="createNewSectionDraft">{{
            $t("providers.ai_radio.actions.new")
          }}</Button>
          <Button size="sm" variant="outline" @click="triggerSectionImport">
            {{ $t("providers.ai_radio.actions.import") }}
          </Button>
        </div>
        <input
          ref="sectionImportInput"
          type="file"
          accept="application/json"
          class="hidden"
          @change="onSectionImport"
        />

        <div
          class="max-h-[560px] space-y-1 overflow-y-auto rounded-md border p-2"
        >
          <button
            v-for="section in sections"
            :key="section.id"
            class="w-full rounded-md px-3 py-2 text-left text-sm transition"
            :class="
              selectedEditorSectionId === section.id
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted'
            "
            @click="selectSectionForEdit(section.id)"
          >
            <div class="font-medium">{{ section.name }}</div>
            <div class="text-xs opacity-80">{{ section.id }}</div>
          </button>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>{{
          $t("providers.ai_radio.section_editor.title")
        }}</CardTitle>
        <CardDescription>
          {{ $t("providers.ai_radio.section_editor.description") }}
        </CardDescription>
      </CardHeader>
      <CardContent v-if="sectionDraft" class="space-y-4">
        <div class="grid gap-4 md:grid-cols-2">
          <div class="space-y-2 md:col-span-2">
            <Label for="section-name">{{
              $t("providers.ai_radio.fields.section_name")
            }}</Label>
            <Input id="section-name" v-model="sectionDraft.name" />
          </div>

          <div class="space-y-2">
            <Label for="section-type">{{
              $t("providers.ai_radio.fields.section_type")
            }}</Label>
            <Select
              :model-value="sectionDraft.type"
              @update:model-value="
                (value) => {
                  if (sectionDraft) {
                    sectionDraft.type = value as AIRadioSectionType;
                  }
                }
              "
            >
              <SelectTrigger id="section-type" class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ai_text">ai_text</SelectItem>
                <SelectItem value="ai_meta">ai_meta</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div
            class="space-y-2"
            :class="{ 'opacity-60': sectionDraft.type !== 'ai_text' }"
          >
            <Label for="section-web-search">{{
              $t("providers.ai_radio.fields.web_search_mode")
            }}</Label>
            <Select
              :model-value="sectionDraft.web_search || 'disabled'"
              :disabled="sectionDraft.type !== 'ai_text'"
              @update:model-value="
                (value) => {
                  if (sectionDraft) {
                    sectionDraft.web_search = value as AIRadioWebSearchMode;
                  }
                }
              "
            >
              <SelectTrigger id="section-web-search" class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="disabled">
                  {{ $t("providers.ai_radio.web_search.disabled") }}
                </SelectItem>
                <SelectItem value="allow">
                  {{ $t("providers.ai_radio.web_search.allow") }}
                </SelectItem>
                <SelectItem value="force">
                  {{ $t("providers.ai_radio.web_search.force") }}
                </SelectItem>
              </SelectContent>
            </Select>
            <p class="text-xs text-muted-foreground">
              {{ $t("providers.ai_radio.web_search.help") }}
            </p>
          </div>

          <div
            class="space-y-2"
            :class="{ 'opacity-60': sectionDraft.type !== 'ai_text' }"
          >
            <Label for="section-max-chars">{{
              $t("providers.ai_radio.fields.character_limit")
            }}</Label>
            <Input
              id="section-max-chars"
              :model-value="String(sectionDraft.constraints?.max_chars ?? 0)"
              :disabled="sectionDraft.type !== 'ai_text'"
              type="number"
              min="0"
              step="1"
              @update:model-value="onSectionMaxCharsChange"
            />
          </div>

          <div class="space-y-2 md:col-span-2">
            <Label for="section-prompt">{{
              $t("providers.ai_radio.fields.prompt")
            }}</Label>
            <Textarea
              id="section-prompt"
              v-model="sectionDraft.prompt"
              rows="8"
            />
          </div>
        </div>

        <details class="rounded-md border p-4">
          <summary class="cursor-pointer select-none text-sm font-medium">
            {{ $t("providers.ai_radio.section_editor.advanced") }}
          </summary>
          <div class="mt-4 space-y-2">
            <Label for="section-id">{{
              $t("providers.ai_radio.fields.section_id")
            }}</Label>
            <Input
              id="section-id"
              v-model="sectionDraft.id"
              :disabled="Boolean(selectedEditorSectionId)"
            />
            <p
              v-if="selectedEditorSectionId"
              class="text-xs text-muted-foreground"
            >
              {{ $t("providers.ai_radio.misc.id_locked") }}
            </p>
          </div>
        </details>

        <div class="flex flex-wrap gap-2">
          <Button :disabled="savingSection" @click="saveSectionDraft">
            {{
              savingSection
                ? $t("providers.ai_radio.actions.saving")
                : $t("providers.ai_radio.actions.save_section")
            }}
          </Button>
          <Button variant="outline" @click="exportSectionDraft">{{
            $t("providers.ai_radio.actions.export")
          }}</Button>
          <Button
            variant="destructive"
            :disabled="!selectedEditorSectionId || deletingSection"
            @click="removeSelectedSection"
          >
            {{
              deletingSection
                ? $t("providers.ai_radio.actions.deleting")
                : $t("providers.ai_radio.actions.delete")
            }}
          </Button>
        </div>
      </CardContent>
      <CardContent v-else>
        <p class="text-sm text-muted-foreground">
          {{ $t("providers.ai_radio.section_editor.empty") }}
        </p>
      </CardContent>
    </Card>
  </div>
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
import { Textarea } from "@/components/ui/textarea";
import { useAiRadioEditor } from "@/composables/ai-radio/useAiRadioEditor";
import { useAiRadioSectionDraft } from "@/composables/ai-radio/useAiRadioSectionDraft";
import { safeInteger } from "@/helpers/ai_radio";
import type {
  AIRadioSectionType,
  AIRadioWebSearchMode,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { ref } from "vue";

const { sections, savingSection, deletingSection } = useAiRadioEditor();
const {
  selectedEditorSectionId,
  sectionDraft,
  createNewSectionDraft,
  selectSectionForEdit,
  saveSectionDraft,
  removeSelectedSection,
  importSectionFile,
  exportSectionDraft,
} = useAiRadioSectionDraft();

const sectionImportInput = ref<HTMLInputElement | null>(null);

const triggerSectionImport = () => {
  sectionImportInput.value?.click();
};

const onSectionImport = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) {
    return;
  }
  try {
    await importSectionFile(file);
  } finally {
    target.value = "";
  }
};

const onSectionMaxCharsChange = (value: string | number) => {
  if (!sectionDraft.value) {
    return;
  }
  if (!sectionDraft.value.constraints) {
    sectionDraft.value.constraints = { max_chars: 0 };
  }
  sectionDraft.value.constraints.max_chars = safeInteger(String(value), 0, 0);
};
</script>
