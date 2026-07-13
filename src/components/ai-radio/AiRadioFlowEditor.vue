<template>
  <div v-if="stationDraft" class="space-y-3 rounded-md border p-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 class="text-base font-semibold">
          {{ $t("providers.ai_radio.flow.title") }}
        </h3>
        <p class="text-xs text-muted-foreground">
          {{ $t("providers.ai_radio.flow.description") }}
        </p>
      </div>
      <Button size="sm" variant="outline" @click="addOrderRule">{{
        $t("providers.ai_radio.flow.add_rule")
      }}</Button>
    </div>

    <div
      v-if="!stationDraft.section_order?.length"
      class="rounded-md border border-dashed p-3 text-sm text-muted-foreground"
    >
      {{ $t("providers.ai_radio.flow.empty") }}
    </div>

    <div
      v-for="(rule, ruleIndex) in stationDraft.section_order"
      :key="`rule-${ruleIndex}`"
      class="space-y-3 rounded-md border p-3"
    >
      <div class="flex flex-wrap items-center gap-2">
        <Label class="sr-only">{{
          $t("providers.ai_radio.flow.placement")
        }}</Label>
        <Select
          :model-value="rule.when"
          @update:model-value="
            (value) =>
              onOrderPlacementChange(ruleIndex, value as AIRadioPlacement)
          "
        >
          <SelectTrigger>
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
        <Button
          size="sm"
          variant="outline"
          @click="moveOrderRule(ruleIndex, -1)"
        >
          {{ $t("providers.ai_radio.actions.up") }}
        </Button>
        <Button
          size="sm"
          variant="outline"
          @click="moveOrderRule(ruleIndex, 1)"
        >
          {{ $t("providers.ai_radio.actions.down") }}
        </Button>
        <Button size="sm" variant="outline" @click="addFlowItem(ruleIndex)">
          {{ $t("providers.ai_radio.flow.add_item") }}
        </Button>
        <Button
          size="sm"
          variant="destructive"
          @click="removeOrderRule(ruleIndex)"
        >
          {{ $t("providers.ai_radio.flow.remove_rule") }}
        </Button>
      </div>

      <div class="space-y-2">
        <div
          v-for="(flowItem, flowIndex) in rule.flow"
          :key="`flow-${ruleIndex}-${flowIndex}`"
          class="space-y-2 rounded-md border border-dashed p-3"
        >
          <div class="flex flex-wrap items-center gap-2">
            <Select
              :model-value="getFlowType(flowItem)"
              @update:model-value="
                (value) =>
                  onFlowTypeChange(
                    ruleIndex,
                    flowIndex,
                    value as AIRadioFlowType,
                  )
              "
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MUST">
                  {{ $t("providers.ai_radio.flow.type_must") }}
                </SelectItem>
                <SelectItem value="ALTERNATIVE">
                  {{ $t("providers.ai_radio.flow.type_alternative") }}
                </SelectItem>
                <SelectItem value="OPTIONAL">
                  {{ $t("providers.ai_radio.flow.type_optional") }}
                </SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              @click="removeFlowItem(ruleIndex, flowIndex)"
            >
              {{ $t("providers.ai_radio.actions.remove") }}
            </Button>
          </div>

          <div v-if="getFlowType(flowItem) === 'MUST'" class="space-y-2">
            <Label class="text-xs">{{
              $t("providers.ai_radio.fields.section")
            }}</Label>
            <Select
              :model-value="getMustSection(flowItem) || undefined"
              @update:model-value="
                (value) =>
                  onMustSectionChange(ruleIndex, flowIndex, value as string)
              "
            >
              <SelectTrigger class="w-full">
                <SelectValue
                  :placeholder="
                    $t('providers.ai_radio.placeholders.select_section')
                  "
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="section in stationSelectedSections"
                  :key="`must-${section.id}`"
                  :value="section.id"
                >
                  {{ section.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div
            v-else-if="getFlowType(flowItem) === 'ALTERNATIVE'"
            class="space-y-2"
          >
            <div class="flex items-center justify-between gap-2">
              <Label class="text-xs">{{
                $t("providers.ai_radio.flow.weighted_choices")
              }}</Label>
              <Button
                size="sm"
                variant="outline"
                @click="addAlternativeChoice(ruleIndex, flowIndex)"
              >
                {{ $t("providers.ai_radio.flow.add_choice") }}
              </Button>
            </div>
            <div
              v-for="(choice, choiceIndex) in getAlternativeChoices(flowItem)"
              :key="`choice-${ruleIndex}-${flowIndex}-${choiceIndex}`"
              class="grid gap-2 md:grid-cols-[1fr_160px_auto]"
            >
              <Select
                :model-value="choice.section || undefined"
                @update:model-value="
                  (value) =>
                    onAlternativeChoiceSectionChange(
                      ruleIndex,
                      flowIndex,
                      choiceIndex,
                      value as string,
                    )
                "
              >
                <SelectTrigger class="w-full">
                  <SelectValue
                    :placeholder="
                      $t('providers.ai_radio.placeholders.select_section')
                    "
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="section in stationSelectedSections"
                    :key="`alt-${section.id}`"
                    :value="section.id"
                  >
                    {{ section.name }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Input
                :model-value="String(choice.weight ?? 1)"
                type="number"
                min="0"
                step="1"
                @update:model-value="
                  (value) =>
                    onAlternativeChoiceWeightChange(
                      ruleIndex,
                      flowIndex,
                      choiceIndex,
                      value,
                    )
                "
              />
              <Button
                size="sm"
                variant="outline"
                @click="
                  removeAlternativeChoice(ruleIndex, flowIndex, choiceIndex)
                "
              >
                {{ $t("providers.ai_radio.actions.remove") }}
              </Button>
            </div>
          </div>

          <div v-else class="grid gap-2 md:grid-cols-2">
            <div class="space-y-2">
              <Label class="text-xs">{{
                $t("providers.ai_radio.fields.section")
              }}</Label>
              <Select
                :model-value="getOptionalSection(flowItem) || undefined"
                @update:model-value="
                  (value) =>
                    onOptionalSectionChange(
                      ruleIndex,
                      flowIndex,
                      value as string,
                    )
                "
              >
                <SelectTrigger class="w-full">
                  <SelectValue
                    :placeholder="
                      $t('providers.ai_radio.placeholders.select_section')
                    "
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="section in stationSelectedSections"
                    :key="`opt-${section.id}`"
                    :value="section.id"
                  >
                    {{ section.name }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="space-y-2">
              <Label class="text-xs">{{
                $t("providers.ai_radio.fields.chance_percent")
              }}</Label>
              <Input
                :model-value="String(getOptionalChancePercent(flowItem))"
                type="number"
                min="0"
                max="100"
                step="1"
                @update:model-value="
                  (value) => onOptionalChanceChange(ruleIndex, flowIndex, value)
                "
              />
            </div>
            <div class="space-y-2">
              <Label class="text-xs">{{
                $t("providers.ai_radio.fields.guard_min_song_gap")
              }}</Label>
              <Input
                :model-value="String(getOptionalMinGap(flowItem))"
                type="number"
                min="0"
                step="1"
                @update:model-value="
                  (value) => onOptionalMinGapChange(ruleIndex, flowIndex, value)
                "
              />
            </div>
            <div class="space-y-2">
              <Label class="text-xs">{{
                $t("providers.ai_radio.fields.guard_max_per_60")
              }}</Label>
              <Input
                :model-value="String(getOptionalMaxPer60(flowItem))"
                type="number"
                min="0"
                step="1"
                @update:model-value="
                  (value) => onOptionalMaxPerChange(ruleIndex, flowIndex, value)
                "
              />
            </div>
            <div class="space-y-2 md:col-span-2">
              <Label class="text-xs">{{
                $t("providers.ai_radio.fields.guard_placeholders")
              }}</Label>
              <Input
                :model-value="getOptionalPlaceholders(flowItem)"
                @update:model-value="
                  (value) =>
                    onOptionalPlaceholdersChange(ruleIndex, flowIndex, value)
                "
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAiRadioEditor } from "@/composables/ai-radio/useAiRadioEditor";
import { useAiRadioStationDraft } from "@/composables/ai-radio/useAiRadioStationDraft";
import {
  getAlternativeChoices,
  getFlowType,
  getMustSection,
  getOptionalChancePercent,
  getOptionalMaxPer60,
  getOptionalMinGap,
  getOptionalPayload,
  getOptionalPlaceholders,
  getOptionalSection,
  makeDefaultFlowItem,
  safeInteger,
  safeNumber,
  type AIRadioFlowType,
} from "@/helpers/ai_radio";
import type {
  AIRadioPlacement,
  AIRadioSection,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";

const { sections } = useAiRadioEditor();
const { stationDraft } = useAiRadioStationDraft();

const stationSelectedSections = computed<AIRadioSection[]>(() => {
  if (!stationDraft.value) {
    return [];
  }
  const selected = new Set(stationDraft.value.section_ids || []);
  return sections.value.filter((section) => selected.has(section.id));
});

const addOrderRule = () => {
  if (!stationDraft.value) {
    return;
  }
  if (!stationDraft.value.section_order) {
    stationDraft.value.section_order = [];
  }
  stationDraft.value.section_order.push({
    when: "between_songs",
    flow: [{ MUST: "" }],
  });
};

const moveOrderRule = (index: number, direction: -1 | 1) => {
  if (!stationDraft.value?.section_order) {
    return;
  }
  const target = index + direction;
  if (target < 0 || target >= stationDraft.value.section_order.length) {
    return;
  }
  const current = stationDraft.value.section_order[index];
  stationDraft.value.section_order[index] =
    stationDraft.value.section_order[target];
  stationDraft.value.section_order[target] = current;
};

const removeOrderRule = (index: number) => {
  stationDraft.value?.section_order?.splice(index, 1);
};

const onOrderPlacementChange = (
  ruleIndex: number,
  placement: AIRadioPlacement,
) => {
  if (!stationDraft.value?.section_order) {
    return;
  }
  stationDraft.value.section_order[ruleIndex].when = placement;
};

const addFlowItem = (ruleIndex: number) => {
  if (!stationDraft.value?.section_order) {
    return;
  }
  stationDraft.value.section_order[ruleIndex].flow.push(
    makeDefaultFlowItem("MUST"),
  );
};

const removeFlowItem = (ruleIndex: number, flowIndex: number) => {
  stationDraft.value?.section_order?.[ruleIndex]?.flow.splice(flowIndex, 1);
};

const onFlowTypeChange = (
  ruleIndex: number,
  flowIndex: number,
  type: AIRadioFlowType,
) => {
  if (!stationDraft.value?.section_order) {
    return;
  }
  stationDraft.value.section_order[ruleIndex].flow[flowIndex] =
    makeDefaultFlowItem(type);
};

const onMustSectionChange = (
  ruleIndex: number,
  flowIndex: number,
  sectionId: string,
) => {
  if (!stationDraft.value?.section_order) {
    return;
  }
  const flow = stationDraft.value.section_order[ruleIndex].flow[flowIndex];
  if (!("MUST" in flow)) {
    return;
  }
  flow.MUST = sectionId;
};

const addAlternativeChoice = (ruleIndex: number, flowIndex: number) => {
  if (!stationDraft.value?.section_order) {
    return;
  }
  const flow = stationDraft.value.section_order[ruleIndex].flow[flowIndex];
  if (!("ALTERNATIVE" in flow)) {
    return;
  }
  flow.ALTERNATIVE.choices.push({ section: "", weight: 1 });
};

const removeAlternativeChoice = (
  ruleIndex: number,
  flowIndex: number,
  choiceIndex: number,
) => {
  if (!stationDraft.value?.section_order) {
    return;
  }
  const flow = stationDraft.value.section_order[ruleIndex].flow[flowIndex];
  if (!("ALTERNATIVE" in flow)) {
    return;
  }
  flow.ALTERNATIVE.choices.splice(choiceIndex, 1);
};

const onAlternativeChoiceSectionChange = (
  ruleIndex: number,
  flowIndex: number,
  choiceIndex: number,
  sectionId: string,
) => {
  if (!stationDraft.value?.section_order) {
    return;
  }
  const flow = stationDraft.value.section_order[ruleIndex].flow[flowIndex];
  if (!("ALTERNATIVE" in flow)) {
    return;
  }
  flow.ALTERNATIVE.choices[choiceIndex].section = sectionId;
};

const onAlternativeChoiceWeightChange = (
  ruleIndex: number,
  flowIndex: number,
  choiceIndex: number,
  value: string | number,
) => {
  if (!stationDraft.value?.section_order) {
    return;
  }
  const flow = stationDraft.value.section_order[ruleIndex].flow[flowIndex];
  if (!("ALTERNATIVE" in flow)) {
    return;
  }
  flow.ALTERNATIVE.choices[choiceIndex].weight = safeNumber(
    String(value),
    0,
    0,
  );
};

const onOptionalSectionChange = (
  ruleIndex: number,
  flowIndex: number,
  sectionId: string,
) => {
  if (!stationDraft.value?.section_order) {
    return;
  }
  const flow = stationDraft.value.section_order[ruleIndex].flow[flowIndex];
  const optional = getOptionalPayload(flow);
  if (!optional) {
    return;
  }
  optional.section = sectionId;
};

const onOptionalChanceChange = (
  ruleIndex: number,
  flowIndex: number,
  value: string | number,
) => {
  if (!stationDraft.value?.section_order) {
    return;
  }
  const flow = stationDraft.value.section_order[ruleIndex].flow[flowIndex];
  const optional = getOptionalPayload(flow);
  if (!optional) {
    return;
  }
  const percent = safeNumber(String(value), 0, 0);
  optional.chance = Math.min(percent, 100) / 100;
};

const onOptionalMinGapChange = (
  ruleIndex: number,
  flowIndex: number,
  value: string | number,
) => {
  if (!stationDraft.value?.section_order) {
    return;
  }
  const flow = stationDraft.value.section_order[ruleIndex].flow[flowIndex];
  const optional = getOptionalPayload(flow);
  if (!optional?.guards) {
    return;
  }
  optional.guards.min_gap_songs = safeInteger(String(value), 0, 0);
};

const onOptionalMaxPerChange = (
  ruleIndex: number,
  flowIndex: number,
  value: string | number,
) => {
  if (!stationDraft.value?.section_order) {
    return;
  }
  const flow = stationDraft.value.section_order[ruleIndex].flow[flowIndex];
  const optional = getOptionalPayload(flow);
  if (!optional?.guards) {
    return;
  }
  optional.guards.max_per_60min = safeInteger(String(value), 0, 0);
};

const onOptionalPlaceholdersChange = (
  ruleIndex: number,
  flowIndex: number,
  value: string | number,
) => {
  if (!stationDraft.value?.section_order) {
    return;
  }
  const flow = stationDraft.value.section_order[ruleIndex].flow[flowIndex];
  const optional = getOptionalPayload(flow);
  if (!optional?.guards) {
    return;
  }
  optional.guards.require_placeholders_present = String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};
</script>
