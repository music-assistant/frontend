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
        <component :is="modeIcon" class="h-3.5 w-3.5 text-muted-foreground" />
        <span class="text-xs font-medium text-muted-foreground">
          {{ modeLabel }}
        </span>
      </div>

      <SmartPlaylistItemsSection
        v-if="form.mode.value === 'seed'"
        :seed-items="form.seedItems"
        :invalid="form.seedInvalid.value"
      />
      <SmartPlaylistItemsSection
        v-if="form.mode.value === 'sources'"
        :seed-items="form.sourceItems"
        :invalid="form.seedInvalid.value"
        source-mode
      />
      <p
        v-if="form.mode.value === 'sources'"
        class="text-xs text-muted-foreground"
      >
        {{ $t("smart_playlist.sources_limit_hint") }}
      </p>

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
} from "@/composables/smart-playlist/useSmartPlaylistRulesForm";
import type { SmartPlaylistRules } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { Library, ListMusic, Sparkles } from "@lucide/vue";
import { computed } from "vue";
import SmartPlaylistRulesList from "./SmartPlaylistRulesList.vue";
import SmartPlaylistItemsSection from "./SmartPlaylistItemsSection.vue";
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

const modeIcon = computed(
  () =>
    ({ library: Library, seed: Sparkles, sources: ListMusic })[form.mode.value],
);
const modeLabel = computed(() => $t(`smart_playlist.type_${form.mode.value}`));

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
