<script setup lang="ts">
import { cn } from "@/lib/utils";
import { store } from "@/plugins/store";
import { Search } from "@lucide/vue";
import { reactiveOmit } from "@vueuse/core";
import type { ListboxFilterProps } from "reka-ui";
import { ListboxFilter, useForwardProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { useCommand } from ".";

defineOptions({
  inheritAttrs: false,
});

const props = defineProps<
  ListboxFilterProps & {
    class?: HTMLAttributes["class"];
  }
>();

const delegatedProps = reactiveOmit(props, "class");

const forwardedProps = useForwardProps(delegatedProps);

const { filterState } = useCommand();
</script>

<template>
  <div
    data-slot="command-input-wrapper"
    class="flex h-9 items-center gap-2 border-b px-3"
  >
    <Search class="size-4 shrink-0 opacity-50" />
    <!--
      Focusing this field on a touch device raises the on-screen keyboard over
      the list it filters. A popover or dialog hosting a Command also has to
      prevent its own open auto-focus, which would land on this field
      regardless.
    -->
    <ListboxFilter
      v-bind="{ ...forwardedProps, ...$attrs }"
      v-model="filterState.search"
      data-slot="command-input"
      :auto-focus="!store.isTouchscreen"
      :class="
        cn(
          'placeholder:text-muted-foreground flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50',
          props.class,
        )
      "
    />
  </div>
</template>
