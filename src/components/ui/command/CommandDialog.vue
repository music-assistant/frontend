<script setup lang="ts">
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { preventOnScreenKeyboardOnOpen } from "@/helpers/dialog_focus";
import { cn } from "@/lib/utils";
import { reactiveOmit } from "@vueuse/core";
import type { DialogRootEmits, DialogRootProps } from "reka-ui";
import { useForwardPropsEmits } from "reka-ui";
import type { HTMLAttributes } from "vue";
import Command from "./Command.vue";

const props = withDefaults(
  defineProps<
    DialogRootProps & {
      title?: string;
      description?: string;
      contentClass?: HTMLAttributes["class"];
      showCloseButton?: boolean;
      focusInputOnOpen?: boolean;
    }
  >(),
  {
    title: "Command Palette",
    description: "Search for a command to run...",
    contentClass: undefined,
    showCloseButton: true,
    focusInputOnOpen: false,
  },
);
const emits = defineEmits<DialogRootEmits>();

const delegatedProps = reactiveOmit(
  props,
  "title",
  "description",
  "contentClass",
  "showCloseButton",
  "focusInputOnOpen",
);
const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <Dialog v-slot="slotProps" v-bind="forwarded">
    <DialogContent
      :class="cn('overflow-hidden p-0', props.contentClass)"
      :show-close-button="showCloseButton"
      @open-auto-focus="
        focusInputOnOpen ? undefined : preventOnScreenKeyboardOnOpen($event)
      "
    >
      <DialogHeader class="sr-only">
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription>{{ description }}</DialogDescription>
      </DialogHeader>
      <Command>
        <slot v-bind="slotProps"></slot>
      </Command>
    </DialogContent>
  </Dialog>
</template>
