<template>
  <TooltipProvider :delay-duration="150">
    <Accordion type="multiple" :default-value="['source']" class="w-full">
      <SmartPlaylistSourceSection :form="form" />
      <SmartPlaylistContentSection :form="form" />
      <SmartPlaylistFiltersSection :form="form" />
      <SmartPlaylistAdvancedSection :form="form" />
    </Accordion>
  </TooltipProvider>
</template>

<script setup lang="ts">
import { Accordion } from "@/components/ui/accordion";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { SmartPlaylistRules } from "@/plugins/api/interfaces";
import {
  useSmartPlaylistRulesForm,
  type SmartPlaylistRulesFormInit,
} from "@/composables/useSmartPlaylistRulesForm";
import SmartPlaylistAdvancedSection from "@/components/smart_playlist/SmartPlaylistAdvancedSection.vue";
import SmartPlaylistContentSection from "@/components/smart_playlist/SmartPlaylistContentSection.vue";
import SmartPlaylistFiltersSection from "@/components/smart_playlist/SmartPlaylistFiltersSection.vue";
import SmartPlaylistSourceSection from "@/components/smart_playlist/SmartPlaylistSourceSection.vue";

type Props = SmartPlaylistRulesFormInit;

const props = withDefaults(defineProps<Props>(), {
  initialRules: null,
  initialArtistItems: () => [],
  initialAlbumItems: () => [],
  initialExcludedArtistItems: () => [],
  initialExcludedAlbumItems: () => [],
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

defineExpose<{ getFinalRules: () => SmartPlaylistRules }>({
  getFinalRules: form.getFinalRules,
});
</script>
