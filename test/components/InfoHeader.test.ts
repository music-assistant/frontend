import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";

import InfoHeader from "@/components/InfoHeader.vue";
import { MediaItemType, Playlist } from "@/plugins/api/interfaces";

const vuetify = createVuetify({
  components,
  directives,
});

// global.ResizeObserver = require("resize-observer-polyfill");

const playlist: Playlist = {
  owner: "Playlist Owner",
  is_editable: false,
} as Playlist;

it("displays message", () => {
  const wrapper = mount(
    {
      template: "<v-layout><InfoHeader/></v-layout>",
    },
    {
      props: {
        item: playlist,
      },
      global: {
        components: {
          InfoHeader,
        },
        plugins: [vuetify],
      },
    },
  );
  return;
});
