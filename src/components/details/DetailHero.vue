<template>
  <header
    class="detail-hero"
    :class="{
      'detail-hero--phone': isPhone,
      'min-h-[calc(100vw+8rem)] bg-black': artworkLayout,
    }"
  >
    <Transition name="detail-hero-backdrop">
      <div
        v-if="backdropStyle"
        :key="shownBackdrop"
        class="detail-hero__backdrop"
        :class="
          artworkLayout
            ? 'bottom-auto aspect-square bg-top [mask-image:linear-gradient(to_bottom,black_70%,transparent)]'
            : [
                { 'detail-hero__backdrop--blurred': blurBackdrop },
                { 'scale-[1.04] blur-[6px]': softenBackdrop && !blurBackdrop },
              ]
        "
        :style="backdropStyle"
      ></div>
    </Transition>
    <div class="detail-hero__scrim"></div>
    <!-- marks where the toolbar sits, to know when it has scrolled away -->
    <div
      ref="toolbarSentinel"
      class="pointer-events-none absolute inset-x-0 top-0 h-16"
    ></div>
    <Toolbar
      class="detail-hero__toolbar"
      :icon="ArrowLeft"
      :icon-action="backButtonClick"
      :enforce-overflow-menu="true"
      :menu-items="menuItems"
    >
      <template #append>
        <slot name="toolbar-append" />
      </template>
    </Toolbar>

    <div v-if="!item" class="detail-hero__body">
      <Skeleton class="h-12 w-80 max-w-[60%]" />
    </div>
    <div v-else ref="heroBody" class="detail-hero__body">
      <!-- over full-width artwork the page's own cover goes, and the rest is
           centred beneath it -->
      <div
        class="detail-hero__main"
        :class="{
          'items-center text-center [&_*]:justify-center [&_.detail-hero-cover]:hidden':
            artworkLayout,
        }"
      >
        <!-- every hero has the same parts: an optional cover, the title, lines
             of facts, the actions and anything under them -->
        <div
          class="flex w-full min-w-0 items-end gap-6 @max-3xl/detail-hero:flex-col @max-3xl/detail-hero:items-stretch @max-3xl/detail-hero:gap-3"
        >
          <div
            v-if="$slots.cover"
            class="detail-hero-cover size-[280px] flex-none @max-3xl/detail-hero:size-[180px]"
          >
            <slot name="cover" />
          </div>
          <!-- the title spans the whole width; the facts on the right sit
               beside the lines and buttons under it, and give up width to
               keep the buttons on one row in a medium-width hero. A phone
               stacks them, even a landscape one wider than a narrow hero -->
          <div
            class="grid min-w-0 flex-1 gap-x-6 gap-y-2.5 pb-1 has-[>.detail-hero\_\_aside:empty]:grid-cols-1 @max-5xl/detail-hero:gap-x-4 @max-3xl/detail-hero:grid-cols-1"
            :class="
              $slots.aside && !isPhone
                ? 'grid-cols-[minmax(0,1fr)_fit-content(13rem)] @max-5xl/detail-hero:grid-cols-[minmax(0,1fr)_fit-content(11rem)]'
                : 'grid-cols-1'
            "
          >
            <div class="col-span-full min-w-0">
              <slot name="title">
                <DetailHeroTitle :item="item" />
              </slot>
            </div>
            <div class="flex min-w-0 flex-col gap-2.5">
              <div
                v-if="$slots.meta"
                class="flex flex-col gap-1 text-[15px] text-white/85 [text-shadow:0_1px_6px_rgba(0,0,0,0.5)] @max-3xl/detail-hero:text-sm"
              >
                <slot name="meta" />
              </div>
              <!-- the play button ellipsizes before the buttons beside it wrap,
                   and keeps a minimum width that wraps them once room runs out -->
              <div
                v-if="$slots.actions"
                class="flex min-w-0 flex-wrap items-center gap-2 @max-3xl/detail-hero:gap-2.5"
              >
                <slot name="actions" />
              </div>
              <div
                v-if="$slots.footer"
                class="flex flex-col"
                :class="{ 'items-center': artworkLayout }"
              >
                <slot name="footer" />
              </div>
            </div>
            <div
              v-if="$slots.aside"
              class="detail-hero__aside self-end"
              :class="{ 'items-center text-center': artworkLayout }"
            >
              <slot name="aside" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- on a phone the back button and menu stay in reach while scrolling -->
    <DetailHeroStickyBar
      v-if="isPhone"
      :show="!toolbarInView"
      :show-title="!titleInView"
      :title="item?.name"
      :menu-items="menuItems"
      @back="backButtonClick"
    >
      <template #append>
        <slot name="toolbar-append" />
      </template>
    </DetailHeroStickyBar>
  </header>
</template>

<script setup lang="ts">
import DetailHeroTitle from "@/components/details/DetailHeroTitle.vue";
import DetailHeroStickyBar from "@/components/details/DetailHeroStickyBar.vue";
import Toolbar from "@/components/Toolbar.vue";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserPreferences } from "@/composables/userPreferences";
import { useEscapeBack } from "@/composables/useEscapeBack";
import { useDetailHeroScroll } from "@/composables/useDetailHeroScroll";
import type { ContextMenuItem } from "@/helpers/context_menu_item";
import { backFromMediaDetails } from "@/helpers/navigation";
import {
  getContextMenuItems,
  getDeclaredContextMenuItems,
} from "@/layouts/default/ItemContextMenu.vue";
import { getImageThumbForItem } from "@/helpers/utils";
import {
  ImageType,
  MediaType,
  type MediaItemType,
} from "@/plugins/api/interfaces";
import { isPhoneSizedScreen } from "@/plugins/breakpoint";
import { ArrowLeft, Rows3 } from "@lucide/vue";
import { computed, ref, shallowRef, watch } from "vue";
import { useRouter } from "vue-router";

export interface Props {
  // undefined while the page loads: a skeleton stands in and there is no menu
  item?: MediaItemType;
  // the artwork painted behind the text, as an image url
  backdrop?: string;
  // for a backdrop that only stands in for missing wide art, so it reads as
  // colour rather than a picture
  blurBackdrop?: boolean;
  // a light blur for a real picture, so the artwork and text in front stand out
  softenBackdrop?: boolean;
  // off for a page with a fixed layout, which leaves "Edit rows" out of the menu
  editableRows?: boolean;
}
const props = withDefaults(defineProps<Props>(), {
  item: undefined,
  backdrop: undefined,
  blurBackdrop: false,
  softenBackdrop: false,
  editableRows: true,
});

const emit = defineEmits<{
  (e: "edit-rows"): void;
}>();

const router = useRouter();
// the item's own menu entries, with the item they were built for
const builtMenu = shallowRef<{
  item: MediaItemType;
  items: ContextMenuItem[];
}>();
// the entries providers add follow the providers while the page is open
const menuItems = computed<ContextMenuItem[]>(() => {
  if (!builtMenu.value) return [];
  const { item, items } = builtMenu.value;
  return [
    ...items,
    ...getDeclaredContextMenuItems([item]),
    ...(props.editableRows
      ? [{ label: "edit_rows", icon: Rows3, action: () => emit("edit-rows") }]
      : []),
  ];
});

const isPhone = computed(() => isPhoneSizedScreen());

const toolbarSentinel = ref<HTMLElement>();
const heroBody = ref<HTMLElement>();
const { toolbarInView, titleInView } = useDetailHeroScroll(
  toolbarSentinel,
  heroBody,
);

// a phone shows the item's own artwork across the top, fading into black just
// above the title in both themes; a collection's images are the covers of its
// stack, which it shows instead
const phoneArtwork = computed(() =>
  isPhone.value && props.item?.media_type !== MediaType.COLLECTION
    ? getImageThumbForItem(props.item, ImageType.THUMB)
    : undefined,
);
const artworkLayout = computed(() => !!phoneArtwork.value);

const shownBackdrop = computed(() => phoneArtwork.value ?? props.backdrop);

const backdropStyle = computed(() =>
  shownBackdrop.value
    ? { backgroundImage: `url("${shownBackdrop.value}")` }
    : undefined,
);

watch(() => props.item, buildMenu, { immediate: true });

// pinning or unpinning the item in the sidebar changes its menu entry
const { getPreference } = useUserPreferences();
const shortcutsPreference = getPreference<string[]>("sidebar.shortcuts", []);
watch(shortcutsPreference, () => buildMenu(props.item));

const backButtonClick = function () {
  backFromMediaDetails(router);
};

useEscapeBack(backButtonClick);

/** Build the item's own menu entries. */
async function buildMenu(item?: MediaItemType) {
  if (!item) {
    builtMenu.value = undefined;
    return;
  }
  const items = await getContextMenuItems([item], item);
  // a slower response for a previous item must not replace the current one
  if (props.item?.uri !== item.uri) return;
  builtMenu.value = { item, items };
}
</script>

<style scoped>
.detail-hero {
  position: relative;
  /* its heroes lay out by the room it has, which the sidebar narrows */
  container: detail-hero / inline-size;
  display: flex;
  flex-direction: column;
  /* the design height; taller content grows the hero */
  min-height: 400px;
  overflow: hidden;
  background-color: rgb(var(--v-theme-background));
  /* the artwork is darkened, so the hero keeps its light-on-dark text in both
     themes */
  color: #fff;
}
.detail-hero--phone {
  min-height: 360px;
}
.detail-hero__backdrop {
  position: absolute;
  inset: 0;
  background-position: center 30%;
  background-repeat: no-repeat;
  background-size: cover;
}
/* scaled up so the blur has artwork to bleed from instead of the page behind it */
.detail-hero__backdrop--blurred {
  filter: blur(44px) saturate(1.35);
  transform: scale(1.2);
}

/* a new backdrop fades in over the one it replaces; both layers are
   absolutely positioned, so they crossfade */
.detail-hero-backdrop-enter-active,
.detail-hero-backdrop-leave-active {
  transition: opacity 400ms ease;
}
.detail-hero-backdrop-enter-from,
.detail-hero-backdrop-leave-to {
  opacity: 0;
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
.detail-hero__toolbar :deep(.v-toolbar__prepend .v-btn),
.detail-hero__toolbar :deep(.v-toolbar__append > button) {
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
/* the facts about the item line up on the right, bottom-aligned with the
   buttons; they wrap onto more lines rather than crowd the lines beside them,
   and a name too long for the column is cut short */
.detail-hero__aside {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  min-width: 0;
  text-align: right;
}
/* an aside whose only child rendered nothing (Vue leaves a comment node there,
   which :empty ignores) takes no column or gap either */
.detail-hero__aside:empty {
  display: none;
}

/* a narrow hero stacks the facts under the rest, as on a phone */
@container detail-hero (width < 48rem) {
  .detail-hero__body {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  .detail-hero__aside {
    align-items: flex-start;
    text-align: left;
  }
}
/* the bottom margin clears the strip where the hero fades into the page */
.detail-hero--phone .detail-hero__body {
  margin: auto 16px 28px;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
}
.detail-hero--phone .detail-hero__aside {
  align-items: flex-start;
  text-align: left;
}
</style>
