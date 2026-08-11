<template>
  <Card class="mb-4 gap-0 py-0">
    <CardHeader class="relative flex flex-row items-center gap-5 p-6 pr-16">
      <div
        :class="
          cn(
            'flex size-14 shrink-0 items-center justify-center rounded-xl bg-current/10 text-primary',
            iconClass,
          )
        "
      >
        <component :is="icon" class="size-8" />
      </div>
      <div class="min-w-0 flex-1">
        <CardTitle class="text-xl leading-tight">{{ title }}</CardTitle>
        <CardDescription v-if="description" class="mt-2 leading-relaxed">
          {{ description }}
        </CardDescription>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            data-testid="settings-menu"
            variant="ghost"
            size="icon-sm"
            class="absolute top-4 right-4"
            :aria-label="$t('more_options')"
          >
            <MoreVertical class="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            data-testid="settings-reset-defaults"
            @click="emit('resetToDefaults')"
          >
            <RotateCcw class="size-4" />
            {{ $t("settings.reset_to_defaults") }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </CardHeader>
    <CardContent
      v-if="showAdvancedToggle"
      class="flex items-center gap-2 border-t bg-muted/20 px-6 py-4 sm:justify-end"
    >
      <Switch
        id="settings-advanced-settings"
        v-model="showAdvancedSettings"
        data-testid="settings-advanced-settings"
      />
      <Label for="settings-advanced-settings" class="cursor-pointer">
        {{ $t("settings.show_advanced_settings") }}
      </Label>
    </CardContent>
  </Card>
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { MoreVertical, RotateCcw } from "@lucide/vue";
import type { Component } from "vue";

/**
 * Header card shared by the settings screens that edit a plain config: it names what
 * is being configured and carries the controls that act on the whole form.
 */
defineProps<{
  icon: Component;
  title: string;
  description?: string;
  // tints the icon and its tile, e.g. "text-orange-500"; defaults to the primary colour
  iconClass?: string;
  showAdvancedToggle?: boolean;
}>();

const emit = defineEmits<{
  (e: "resetToDefaults"): void;
}>();

const showAdvancedSettings = defineModel<boolean>("showAdvancedSettings", {
  default: false,
});
</script>
