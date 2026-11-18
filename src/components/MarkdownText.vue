<script setup lang="ts">
import { markdownToHtml, providerMarkdownToHtml } from "@/helpers/utils";
import { computed } from "vue";

const props = defineProps<{
  /** Markdown source, rendered as sanitized HTML. */
  text?: string | null;
  /** Keep images, for text that is not a provider's own, such as a media item's description. */
  allowImages?: boolean;
}>();

const html = computed(() => {
  if (!props.text) return "";
  return props.allowImages
    ? markdownToHtml(props.text)
    : providerMarkdownToHtml(props.text);
});
</script>

<template>
  <!-- eslint-disable vue/no-v-html -->
  <div
    class="[&_a]:text-primary [&_code]:bg-muted break-words [&>*]:mb-2 [&>*:last-child]:mb-0 [&_a]:underline [&_a]:underline-offset-2 [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_li]:mb-1 [&_li>p]:mb-2 [&_li>p:last-child]:mb-0 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:text-start [&_pre]:overflow-x-auto [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-start"
    v-html="html"
  ></div>
  <!-- eslint-enable vue/no-v-html -->
</template>
