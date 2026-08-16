<template>
  <ButtonGroup>
    <Button
      :disabled="disabled || loading"
      class="min-w-40 justify-start"
      @click="emit('click')"
    >
      <Spinner v-if="loading" class="size-5" />
      <Play v-else fill="currentColor" class="size-5" />
      {{ text }}
    </Button>
    <ButtonGroupSeparator />
    <Button
      size="icon"
      :disabled="loading"
      :aria-label="$t('tooltip.show_menu')"
      @click="emit('menu')"
    >
      <ChevronDown class="size-5" />
    </Button>
  </ButtonGroup>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  ButtonGroup,
  ButtonGroupSeparator,
} from "@/components/ui/button-group";
import { Spinner } from "@/components/ui/spinner";
import { ChevronDown, Play } from "@lucide/vue";

// properties
export interface Props {
  text?: string;
  disabled?: boolean;
  loading?: boolean;
}
withDefaults(defineProps<Props>(), {
  text: undefined,
  disabled: false,
  loading: false,
});

// emitters
const emit = defineEmits<{
  (e: "click"): void;
  (e: "menu"): void;
}>();
</script>
