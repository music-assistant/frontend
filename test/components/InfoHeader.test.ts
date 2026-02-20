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
  name: "Media Item Name",
  metadata: {
  },
} as MediaItemType;

it("Name of media item is displayed on InfoHeader", () => {
  const wrapper = mount(InfoHeader,
    {
      props: {
        item: mediaItem,
      },
      global: {
        components: {
          InfoHeader,
        },
        mocks: {
          $t: vi.fn(() => {}),
          router: vi.fn(() => {}),
        },
        plugins: [vuetify],
      },
    },
  );

  expect(wrapper.text()).toContain("Media Item Name");
  return;
});
