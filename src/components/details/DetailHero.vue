<template>
  <header
    class="detail-hero"
    :class="{ 'detail-hero--phone': isPhone }"
    :style="{
      '--detail-hero-height': `${height}px`,
      '--detail-hero-phone-height': `${phoneHeight}px`,
    }"
  >
    <div
      v-if="backdropStyle"
      class="detail-hero__backdrop"
      :style="backdropStyle"
    ></div>
    <div class="detail-hero__scrim"></div>
    <Toolbar
      class="detail-hero__toolbar"
      :icon="ArrowLeft"
      :icon-action="backButtonClick"
      :enforce-overflow-menu="true"
      :menu-items="menuItems"
    >
      <template #append>
        <slot name="toolbar-append"></slot>
      </template>
    </Toolbar>

    <div v-if="!item" class="detail-hero__body">
      <Skeleton class="h-12 w-80 max-w-[60%]" />
    </div>
    <div v-else class="detail-hero__body">
      <div class="detail-hero__main">
        <slot name="main"></slot>
      </div>
      <div v-if="$slots.aside" class="detail-hero__aside">
        <slot name="aside"></slot>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import Toolbar from "@/components/Toolbar.vue";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserPreferences } from "@/composables/userPreferences";
import type { ContextMenuItem } from "@/helpers/context_menu_item";
import { backFromMediaDetails } from "@/helpers/navigation";
import { getContextMenuItems } from "@/layouts/default/ItemContextMenu.vue";
import type { MediaItemType } from "@/plugins/api/interfaces";
import { isPhoneSizedScreen } from "@/plugins/breakpoint";
import { ArrowLeft, Rows3 } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";

export interface Props {
  // undefined while the page loads: a skeleton stands in and there is no menu
  item?: MediaItemType;
  // the artwork painted behind the text, as an image url
  backdrop?: string;
  height?: number;
  phoneHeight?: number;
}
const props = withDefaults(defineProps<Props>(), {
  item: undefined,
  backdrop: undefined,
  height: 440,
  phoneHeight: 340,
});

const emit = defineEmits<{
  (e: "edit-rows"): void;
}>();

const router = useRouter();
const menuItems = ref<ContextMenuItem[]>([]);

const isPhone = computed(() => isPhoneSizedScreen());

const backdropStyle = computed(() =>
  props.backdrop ? { backgroundImage: `url("${props.backdrop}")` } : undefined,
);

watch(() => props.item, buildMenu, { immediate: true });

// pinning or unpinning the item in the sidebar changes its menu entry
const { getPreference } = useUserPreferences();
const shortcutsPreference = getPreference<string[]>("sidebar.shortcuts", []);
watch(shortcutsPreference, () => buildMenu(props.item));

const backButtonClick = function () {
  backFromMediaDetails(router);
};

/** The item's overflow menu, with the page's own "Edit rows" entry last. */
async function buildMenu(item?: MediaItemType) {
  if (!item) {
    menuItems.value = [];
    return;
  }
  const items = await getContextMenuItems([item], item);
  // a slower response for a previous item must not replace the current one
  if (props.item?.uri !== item.uri) return;
  menuItems.value = [
    ...items,
    { label: "edit_rows", icon: Rows3, action: () => emit("edit-rows") },
  ];
}
</script>

<style scoped>
.detail-hero {
  position: relative;
  display: flex;
  flex-direction: column;
  /* the design height; a hero whose text needs more room grows instead of
     running under its toolbar */
  min-height: var(--detail-hero-height);
  overflow: hidden;
  background-color: rgb(var(--v-theme-background));
  /* the artwork is darkened, so the hero keeps its light-on-dark text in both
     themes */
  color: #fff;
}
.detail-hero--phone {
  min-height: var(--detail-hero-phone-height);
}
.detail-hero__backdrop {
  position: absolute;
  inset: 0;
  background-position: center 30%;
  background-repeat: no-repeat;
  background-size: cover;
}
/* two layers: the artwork is darkened so the hero's light-on-dark text reads in
   both themes, and only its very bottom blends into the page */
.detail-hero__scrim {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(
      180deg,
      rgba(0, 0, 0, 0) 96%,
      rgb(var(--v-theme-background)) 100%
    ),
    linear-gradient(
      180deg,
      rgba(0, 0, 0, 0.45) 0%,
      rgba(0, 0, 0, 0.1) 30%,
      rgba(0, 0, 0, 0.55) 72%,
      rgba(0, 0, 0, 0.9) 100%
    );
}
.detail-hero--phone .detail-hero__scrim {
  background:
    linear-gradient(
      180deg,
      rgba(0, 0, 0, 0) 96%,
      rgb(var(--v-theme-background)) 100%
    ),
    linear-gradient(
      180deg,
      rgba(0, 0, 0, 0.45) 0%,
      rgba(0, 0, 0, 0.05) 28%,
      rgba(0, 0, 0, 0.6) 70%,
      rgba(0, 0, 0, 0.92) 100%
    );
}
.detail-hero__toolbar {
  position: relative;
}

/* the toolbar controls sit on the artwork, so they get their own backdrop
   instead of the toolbar's transparent one */
.detail-hero :deep(.v-toolbar__prepend .v-btn),
.detail-hero :deep(.v-toolbar__append > button) {
  background-color: rgba(0, 0, 0, 0.35);
  border-radius: 8px;
  opacity: 1;
}

/* sits at the bottom of the hero, above the artwork layers */
.detail-hero__body {
  position: relative;
  margin: auto 28px 24px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
}
.detail-hero__main {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  align-items: flex-start;
  gap: 14px;
  min-width: 0;
}
/* the facts about the item line up on the right, bottom-aligned with the buttons */
.detail-hero__aside {
  display: flex;
  flex: 0 1 auto;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  min-width: 0;
  text-align: right;
}
/* an aside whose only child rendered nothing (Vue leaves a comment node there,
   which :empty ignores) takes no gap of the body's either */
.detail-hero__aside:empty {
  display: none;
}

/* an aside whose only child rendered nothing (Vue leaves a comment node there,
   which :empty ignores) takes no gap of the body's either */
.detail-hero__aside:empty {
  display: none;
}

.detail-hero--phone .detail-hero__body {
  margin: auto 16px 16px;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
}
.detail-hero--phone .detail-hero__aside {
  align-items: flex-start;
  text-align: left;
}
</style>
