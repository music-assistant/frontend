<template>
  <Card class="mb-4 gap-0 py-0">
    <CardHeader
      class="relative flex items-center gap-3 p-4 pr-14 sm:gap-5 sm:p-6 sm:pr-16"
    >
      <!-- not rounded-xl: Vuetify has a class of that name, which ignores the breakpoint -->
      <div
        :class="
          cn(
            'flex size-10 shrink-0 items-center justify-center rounded-2xl bg-current/10 text-primary sm:size-14 sm:rounded-3xl',
            iconClass,
          )
        "
      >
        <component :is="icon" class="size-6 sm:size-8" />
      </div>
      <div class="min-w-0 flex-1">
        <CardTitle class="text-lg leading-tight sm:text-xl">
          {{ title }}
        </CardTitle>
        <CardDescription
          v-if="description"
          class="mt-0.5 leading-snug max-sm:line-clamp-2 sm:mt-2 sm:leading-relaxed"
        >
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
          <!-- a phone has no room for the documentation row below the header -->
          <DropdownMenuItem
            v-if="documentationUrl"
            as="a"
            data-testid="settings-documentation-item"
            class="text-inherit no-underline sm:hidden"
            :href="documentationUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            <BookOpen class="size-4" />
            {{ $t("settings.documentation") }}
          </DropdownMenuItem>
          <DropdownMenuItem
            data-testid="settings-reset-defaults"
            :disabled="resetDisabled"
            @click="emit('resetToDefaults')"
          >
            <RotateCcw class="size-4" />
            {{ $t("settings.reset_to_defaults") }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </CardHeader>
    <CardContent
      v-if="documentationUrl"
      class="flex flex-wrap items-center gap-3 border-t bg-muted/20 px-6 py-4 max-sm:hidden"
    >
      <Button
        as="a"
        data-testid="settings-documentation"
        variant="outline"
        :href="documentationUrl"
        target="_blank"
        rel="noopener noreferrer"
      >
        <BookOpen class="size-4" />
        {{ $t("settings.documentation") }}
      </Button>
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
import { cn } from "@/lib/utils";
import { BookOpen, MoreVertical, RotateCcw } from "@lucide/vue";
import type { Component } from "vue";

/**
 * Header card shared by the settings screens that edit a plain config: it names what
 * is being configured and carries the controls that act on the whole form.
 */
defineProps<{
  icon: Component;
  title: string;
  description?: string;
  /** Tints the icon and its tile, e.g. "text-orange-500"; defaults to the primary colour. */
  iconClass?: string;
  /** Where the documentation of this screen lives; without one no link is offered. */
  documentationUrl?: string;
  /** Keeps the reset out of reach, e.g. while the form can not be edited. */
  resetDisabled?: boolean;
}>();

const emit = defineEmits<{
  (e: "resetToDefaults"): void;
}>();
</script>
