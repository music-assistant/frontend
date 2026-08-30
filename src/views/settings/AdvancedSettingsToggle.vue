<template>
  <div class="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
    <Switch
      :id="switchId"
      v-model="showAdvancedSettings"
      :data-testid="testId"
    />
    <Label :for="switchId" class="cursor-pointer">
      {{ $t("settings.show_advanced_settings") }}
    </Label>
  </div>
</template>

<script setup lang="ts">
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useId } from "vue";

/**
 * Reveals the advanced entries of a settings form, sized to sit at the end of the
 * header row of a settings screen.
 */
defineProps<{
  /** Names the toggle of this settings screen, so tests can address it. */
  testId: string;
}>();

const showAdvancedSettings = defineModel<boolean>("showAdvancedSettings", {
  default: false,
});

const switchId = useId();
</script>
