import DetailHeroTitle from "@/components/details/DetailHeroTitle.vue";
import { defineComponent } from "vue";

// DetailHero reduced to its slots, in order, for testing the heroes that fill them
export const detailHeroStub = defineComponent({
  name: "DetailHero",
  components: { DetailHeroTitle },
  props: {
    item: { type: Object, default: undefined },
    backdrop: { type: String, default: undefined },
    blurBackdrop: Boolean,
    softenBackdrop: Boolean,
    editableRows: { type: Boolean, default: true },
  },
  emits: ["edit-rows"],
  template: `<div>
    <slot name="toolbar-append" />
    <slot name="cover" />
    <slot name="title"><DetailHeroTitle v-if="item" :item="item" /></slot>
    <slot name="meta" />
    <slot name="actions" />
    <slot name="footer" />
    <slot name="aside" />
  </div>`,
});
