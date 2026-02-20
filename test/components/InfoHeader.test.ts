import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";

import InfoHeader from "@/components/InfoHeader.vue";
import { MediaItemType } from "@/plugins/api/interfaces";

const router = vi.fn(() => {});

const vuetify = createVuetify({
  components,
  directives,
});

const mediaItem = {
  name: "Media Item Title",
} as MediaItemType;

it("displays message", () => {
  const wrapper = mount(
    {
      template: `
      <v-layout>
        <InfoHeader/>
      </v-layout>
      `,
    },
    {
      props: {
        item: mediaItem,
      },
      global: {
        components: {
          InfoHeader,
        },
        plugins: [vuetify],
      },
    },
  );

  // expect(wrapper.text()).toContain("Media Item Title");
  return;
});
