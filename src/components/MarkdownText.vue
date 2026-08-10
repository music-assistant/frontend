<script setup lang="ts">
import { markdownToHtml } from "@/helpers/utils";
import { computed } from "vue";

const props = defineProps<{
  /** Markdown source, rendered as sanitized HTML. */
  text?: string | null;
}>();

const html = computed(() => (props.text ? markdownToHtml(props.text) : ""));
</script>

<template>
  <!-- eslint-disable vue/no-v-html -->
  <div
    class="[&_a]:text-primary [&_code]:bg-muted break-words [&>*]:mb-2 [&>*:last-child]:mb-0 [&_a]:underline [&_a]:underline-offset-2 [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:text-start [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-start"
    v-html="html"
  ></div>
  <!-- eslint-enable vue/no-v-html -->
</template>
