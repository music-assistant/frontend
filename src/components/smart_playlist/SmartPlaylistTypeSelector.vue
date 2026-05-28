<template>
  <div class="grid grid-cols-2 gap-2">
    <button
      type="button"
      :class="cardClass('library')"
      @click="emit('update:modelValue', 'library')"
    >
      <div :class="headerClass('library')">
        <Library class="h-4 w-4" />
        <span class="text-sm font-semibold">
          {{ $t("smart_playlist.type_library") }}
        </span>
        <Check
          v-if="modelValue === 'library'"
          class="h-3.5 w-3.5 ml-auto text-primary"
        />
      </div>
      <p class="text-xs text-muted-foreground text-left leading-snug">
        {{ $t("smart_playlist.type_library_desc") }}
      </p>
    </button>
    <button
      type="button"
      :class="cardClass('seed')"
      @click="emit('update:modelValue', 'seed')"
    >
      <div :class="headerClass('seed')">
        <Sparkles class="h-4 w-4" />
        <span class="text-sm font-semibold">
          {{ $t("smart_playlist.type_seed") }}
        </span>
        <Check
          v-if="modelValue === 'seed'"
          class="h-3.5 w-3.5 ml-auto text-primary"
        />
      </div>
      <p class="text-xs text-muted-foreground text-left leading-snug">
        {{ $t("smart_playlist.type_seed_desc") }}
      </p>
    </button>
  </div>
</template>

<script setup lang="ts">
import { Check, Library, Sparkles } from "lucide-vue-next";
import type { SmartPlaylistMode } from "@/composables/useSmartPlaylistRulesForm";
import { $t } from "@/plugins/i18n";

const props = defineProps<{
  modelValue: SmartPlaylistMode;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: SmartPlaylistMode];
}>();

function cardClass(value: SmartPlaylistMode) {
  const base =
    "flex flex-col gap-1.5 rounded-lg border-2 px-3 py-3 text-left transition-all";
  return props.modelValue === value
    ? `${base} border-primary bg-primary/10 shadow-sm ring-2 ring-primary/30`
    : `${base} border-border/60 hover:bg-accent/50 hover:border-border`;
}

function headerClass(value: SmartPlaylistMode) {
  const base = "flex items-center gap-2";
  return props.modelValue === value ? `${base} text-primary` : base;
}
</script>
