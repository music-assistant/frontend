<template>
  <ButtonGroup>
    <Button
      :disabled="disabled || loading"
      :class="['justify-start', truncate ? 'min-w-0' : 'min-w-40']"
      @click="emit('click')"
    >
      <Spinner v-if="loading" class="size-5 shrink-0" />
      <Play v-else fill="currentColor" class="size-5 shrink-0" />
      <span v-if="truncate" class="truncate">{{ text }}</span>
      <template v-else>{{ text }}</template>
    </Button>
    <ButtonGroupSeparator />
    <Button
      size="icon"
      :disabled="loading"
      :aria-label="menuButtonLabel || $t('tooltip.show_menu')"
      :title="menuButtonLabel || $t('tooltip.show_menu')"
      aria-haspopup="menu"
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
  menuButtonLabel?: string;
  disabled?: boolean;
  loading?: boolean;
  // let the button shrink below its label and ellipsis it, for a tight row
  truncate?: boolean;
}
withDefaults(defineProps<Props>(), {
  text: undefined,
  menuButtonLabel: undefined,
  disabled: false,
  loading: false,
  truncate: false,
});

// emitters
const emit = defineEmits<{
  (e: "click"): void;
  (e: "menu"): void;
}>();
</script>
