<template>
  <section
    :class="
      cn(
        'flex min-w-0 flex-col gap-3.5 rounded-2xl border border-border bg-card p-[22px] text-card-foreground',
        props.class,
      )
    "
    :aria-busy="loading"
  >
    <header
      v-if="title || $slots.header"
      class="flex flex-wrap items-end justify-between gap-2"
    >
      <div class="flex min-w-0 flex-col gap-1">
        <h2
          :class="
            prominent
              ? 'm-0 text-base font-semibold'
              : 'm-0 text-[13px] font-normal text-muted-foreground'
          "
        >
          {{ title }}
        </h2>
        <p v-if="subtitle" class="m-0 text-[13px] text-muted-foreground">
          {{ subtitle }}
        </p>
      </div>
      <slot name="header"></slot>
    </header>
    <div v-if="loading" :class="cn('flex flex-col gap-3', minHeightClass)">
      <Skeleton class="h-6 w-2/5" />
      <Skeleton class="w-full flex-1" />
    </div>
    <p
      v-else-if="error"
      role="alert"
      :class="
        cn(
          'm-0 flex items-center gap-2 text-sm text-muted-foreground',
          minHeightClass,
        )
      "
    >
      <CircleAlert class="size-4 shrink-0" aria-hidden="true" />
      {{ $t("statistics_section_failed") }}
    </p>
    <p
      v-else-if="empty"
      :class="
        cn(
          'm-0 flex items-center text-sm text-muted-foreground',
          minHeightClass,
        )
      "
    >
      {{ emptyText ?? $t("statistics_section_empty") }}
    </p>
    <slot v-else></slot>
  </section>
</template>

<script setup lang="ts">
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { CircleAlert } from "@lucide/vue";
import type { HTMLAttributes } from "vue";
import { $t } from "@/plugins/i18n";

const props = withDefaults(
  defineProps<{
    title?: string;
    subtitle?: string;
    // a section heading rather than the small label of an insight card
    prominent?: boolean;
    loading?: boolean;
    error?: boolean;
    empty?: boolean;
    emptyText?: string;
    // keeps the card's height while it loads, fails or is empty
    minHeightClass?: string;
    class?: HTMLAttributes["class"];
  }>(),
  {
    title: undefined,
    subtitle: undefined,
    emptyText: undefined,
    minHeightClass: "min-h-[112px]",
    class: undefined,
  },
);
</script>
