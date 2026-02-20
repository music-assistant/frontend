import { expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createVuetify } from "vuetify";
import { createRouter, createWebHistory } from "vue-router";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";

import InfoHeader from "@/components/InfoHeader.vue";
import { MediaItemType } from "@/plugins/api/interfaces";

const vuetify = createVuetify({
  components,
  directives,
});

const mediaItem = {
  name: "Media Item Name",
  metadata: {},
  provider: "",
} as MediaItemType;

const mockRoutes = [
  {
    path: "/",
    component: {
      template: "",
    },
  },
];

/**
 * Creating mock Vue router will satisfy the warning:
 * "[Vue warn]: injection "Symbol(router)" not found."
 */
const mockRouter = createRouter({
  routes: mockRoutes,
  history: createWebHistory(),
});

it("Name of media item is displayed on InfoHeader", () => {
  const wrapper = mount(InfoHeader, {
    props: {
      item: mediaItem,
    },
    global: {
      components: {
        InfoHeader,
      },
      mocks: {
        $t: vi.fn(() => {}),
        route: vi.fn(() => {}),
        router: {
          push: vi.fn(() => {}),
          back: vi.fn(() => {}),
          currentRoute: {
            value: {
              name: "",
            },
          },
        },
        useRouter: vi.fn(() => {}),
      },
      plugins: [vuetify, mockRouter],
    },
  });

  expect(wrapper.text()).toContain("Media Item Name");
  return;
});
