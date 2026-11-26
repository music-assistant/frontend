<template>
  <!-- border-[1px] and bg-card rather than the outline's border and
       bg-background, whose Vuetify namesakes colour over the red -->
  <Button
    v-if="reconfigure"
    size="sm"
    variant="outline"
    class="border-[1px] border-destructive/35 bg-card text-destructive hover:bg-destructive/10 hover:text-destructive dark:border-destructive/50 dark:hover:bg-destructive/20"
    data-testid="provider-action"
    @click.stop="emit('reconfigure')"
  >
    {{ $t("settings.reconfigure") }}
  </Button>
  <Button
    v-if="remove"
    size="sm"
    variant="outline"
    data-testid="provider-remove"
    @click.stop="emit('remove')"
  >
    <Trash2 class="size-4" aria-hidden="true" />
    {{ $t("settings.remove_provider") }}
  </Button>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { $t } from "@/plugins/i18n";
import { Trash2 } from "@lucide/vue";

/**
 * The buttons fixing a provider that needs attention: reconfigure it, or remove
 * an entry that cannot be opened.
 */
defineProps<{
  reconfigure: boolean;
  remove: boolean;
}>();

const emit = defineEmits<{
  (e: "reconfigure"): void;
  (e: "remove"): void;
}>();
</script>
