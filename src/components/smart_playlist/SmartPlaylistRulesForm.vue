<template>
  <TooltipProvider :delay-duration="150">
    <div class="flex flex-col gap-5">
      <SmartPlaylistTypeSelector
        v-if="!lockType"
        :model-value="form.mode.value"
        @update:model-value="form.setMode"
      />
      <div
        v-else
        class="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2"
      >
        <component
          :is="form.mode.value === 'seed' ? Sparkles : Library"
          class="h-3.5 w-3.5 text-muted-foreground"
        />
        <span class="text-xs font-medium text-muted-foreground">
          {{
            form.mode.value === "seed"
              ? $t("smart_playlist.type_seed")
              : $t("smart_playlist.type_library")
          }}
        </span>
      </div>

      <SmartPlaylistSeedSection
        v-if="form.mode.value === 'seed'"
        :seed-items="form.seedItems"
        :invalid="form.seedInvalid.value"
      />

      <Separator />

      <SmartPlaylistRulesList
        :mode="form.mode.value"
        :rules="form.rules.value"
        :logic="form.logic.value"
        :available-fields="form.availableFields.value"
        :genre-options="form.genreOptions.value"
        :album-type-options="form.albumTypeOptions.value"
        :invalid-rule-uids="form.invalidRuleUids.value"
        @update:logic="(v) => (form.logic.value = v)"
        @add-rule="form.addRule"
        @remove-rule="form.removeRule"
        @update-rule="onUpdateRule"
      />

      <Separator />

      <SmartPlaylistDedupField
        :model-value="form.dedupHours.value"
        @update:model-value="(v) => (form.dedupHours.value = v)"
      />
    </div>
  </TooltipProvider>
</template>

<script setup lang="ts">
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  useSmartPlaylistRulesForm,
  type RuleRow,
  type SmartPlaylistRulesFormInit,
} from "@/composables/useSmartPlaylistRulesForm";
import type { SmartPlaylistRules } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { Library, Sparkles } from "@lucide/vue";
import SmartPlaylistDedupField from "./SmartPlaylistDedupField.vue";
import SmartPlaylistRulesList from "./SmartPlaylistRulesList.vue";
import SmartPlaylistSeedSection from "./SmartPlaylistSeedSection.vue";
import SmartPlaylistTypeSelector from "./SmartPlaylistTypeSelector.vue";

type Props = SmartPlaylistRulesFormInit & {
  lockType?: boolean;
};

const props = withDefaults(defineProps<Props>(), {
  initialRules: null,
  initialArtistItems: () => [],
  initialAlbumItems: () => [],
  initialExcludedArtistItems: () => [],
  initialExcludedAlbumItems: () => [],
  lockType: false,
});

const emit = defineEmits<{
  (
    e: "trackCountUpdate",
    count: number | null,
    duration: number | null,
    counting: boolean,
  ): void;
}>();

const form = useSmartPlaylistRulesForm(props, (count, duration, counting) => {
  emit("trackCountUpdate", count, duration, counting);
});

function onUpdateRule(uid: string, patch: Partial<RuleRow>) {
  const idx = form.rules.value.findIndex((r) => r.uid === uid);
  if (idx < 0) return;
  form.rules.value[idx] = { ...form.rules.value[idx], ...patch };
  form.clearRuleValidation(uid);
}

defineExpose<{
  getFinalRules: () => SmartPlaylistRules;
  validate: () => string[];
  mode: typeof form.mode;
  hasChanges: typeof form.hasChanges;
}>({
  getFinalRules: form.getFinalRules,
  validate: form.validate,
  mode: form.mode,
  hasChanges: form.hasChanges,
});
</script>
