<template>
  <section
    v-hold="onHold"
    class="detail-text"
    :style="{
      '--detail-text-lines': lines,
      '--detail-text-phone-lines': lines + 1,
    }"
    @touchstart.passive="onTouchStart"
    @click.capture="swallowClickAfterHold"
  >
    <h2 v-if="title" class="detail-text__title">{{ title }}</h2>

    <template v-if="text !== undefined">
      <MarkdownText
        v-if="markdown"
        class="detail-text__body"
        :text="text"
        @click="onTextClick"
      />
      <p
        v-else
        class="detail-text__body detail-text__body--verbatim"
        @click="showFullText = true"
      >
        {{ text }}
      </p>
      <button
        type="button"
        class="detail-text__more"
        @click="showFullText = true"
      >
        {{ $t("read_more") }}
      </button>

      <Dialog v-model:open="showFullText">
        <DialogContent class="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>{{ dialogTitle }}</DialogTitle>
          </DialogHeader>
          <MarkdownText
            v-if="markdown"
            :text="text"
            class="detail-text__full max-w-none text-sm leading-relaxed"
          />
          <p v-else class="detail-text__full detail-text__body--verbatim">
            {{ text }}
          </p>
          <DialogFooter>
            <Button @click="showFullText = false">{{ $t("close") }}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </template>

    <div v-else class="detail-text__skeleton" aria-hidden="true">
      <Skeleton
        v-for="index in 3"
        :key="index"
        class="detail-text__skeleton-line"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import MarkdownText from "@/components/MarkdownText.vue";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useHoldToOpenMenu } from "@/composables/useHoldToOpenMenu";
import { ref } from "vue";

export interface Props {
  // undefined while the text is still on its way: a skeleton stands in
  text?: string;
  // heading above the text; the artist biography goes without one
  title?: string;
  // what the dialog holding the full text is titled, e.g. the item's name
  dialogTitle: string;
  // the text is markdown (a biography, a review) rather than plain text
  markdown?: boolean;
  // lines shown before "read more", one more on phone
  lines?: number;
}
withDefaults(defineProps<Props>(), {
  text: undefined,
  title: undefined,
  markdown: false,
  lines: 2,
});

const emit = defineEmits<{
  (e: "edit-rows"): void;
}>();

const showFullText = ref(false);

const { onHold, onTouchStart, swallowClickAfterHold } = useHoldToOpenMenu(() =>
  emit("edit-rows"),
);

const onTextClick = (event: MouseEvent) => {
  // a link in the text opens on its own; don't also expand the text
  if ((event.target as HTMLElement).closest("a")) return;
  showFullText.value = true;
};
</script>

<style scoped>
.detail-text {
  padding: 20px 28px 8px;
}
.detail-text__title {
  margin: 0 0 6px;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.4px;
  color: rgb(var(--v-theme-on-background));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.detail-text__body {
  margin: 0;
  font-size: 15px;
  line-height: 1.5;
  color: rgba(var(--v-theme-on-surface), 0.72);
  cursor: pointer;
  display: -webkit-box;
  -webkit-line-clamp: var(--detail-text-lines);
  line-clamp: var(--detail-text-lines);
  -webkit-box-orient: vertical;
  overflow: hidden;
}
/* lyrics and the like are printed as written, line breaks and all */
.detail-text__body--verbatim {
  white-space: pre-wrap;
}
.detail-text__more {
  margin-top: 4px;
  height: 28px;
  padding: 0;
  border: 0;
  background: none;
  color: rgb(var(--v-theme-primary));
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}
.detail-text__full {
  margin: 0;
  max-height: 60vh;
  overflow-y: auto;
  font-size: 15px;
  line-height: 1.5;
}
.detail-text__skeleton {
  display: grid;
  gap: 9px;
  padding: 3px 0;
}
.detail-text__skeleton-line {
  height: 14px;
  width: 60%;
}
.detail-text__skeleton-line:nth-child(2) {
  width: 45%;
}
.detail-text__skeleton-line:nth-child(3) {
  width: 52%;
}

@media (max-width: 768px) {
  .detail-text {
    padding: 16px 16px 4px;
  }
  .detail-text__title {
    font-size: 19px;
  }
  .detail-text__body {
    font-size: 14px;
    -webkit-line-clamp: var(--detail-text-phone-lines);
    line-clamp: var(--detail-text-phone-lines);
  }
  .detail-text__more {
    margin-top: 2px;
  }
}
</style>
