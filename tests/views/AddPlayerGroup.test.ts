import AddPlayerGroup from "@/views/settings/AddPlayerGroup.vue";
import { enableAutoUnmount, shallowMount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";

const { apiMock, routerMock } = vi.hoisted(() => ({
  apiMock: {
    createPlayerGroup: vi.fn(),
    getProvider: vi.fn(() => ({ domain: "sync_group" })),
    players: {},
  },
  routerMock: {
    back: vi.fn(),
    push: vi.fn(),
    // the entry before the page, null on a page opened directly
    options: { history: { state: { back: null as string | null } } },
  },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("vue-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-router")>()),
  useRouter: () => routerMock,
}));

enableAutoUnmount(afterEach);

beforeEach(() => {
  vi.clearAllMocks();
  routerMock.options.history.state.back = null;
});

/** Creates a group from the page, as its save button does. */
function createGroup() {
  const wrapper = shallowMount(AddPlayerGroup, {
    props: { provider: "sync_group--abc" },
    global: {
      plugins: [createVuetify({ components })],
      mocks: { $t: (key: string) => key },
      // the buttons sit inside the card and the form
      renderStubDefaultSlot: true,
    },
  });
  // the first button saves, the second closes the page
  wrapper.findAllComponents({ name: "VBtn" })[0].vm.$emit("click");
}

describe("AddPlayerGroup", () => {
  it("returns to where the user came from after creating the group", () => {
    routerMock.options.history.state.back = "/settings/players";

    createGroup();

    expect(apiMock.createPlayerGroup).toHaveBeenCalledOnce();
    expect(routerMock.back).toHaveBeenCalledOnce();
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it("goes to the players after creating the group on a page opened directly", () => {
    createGroup();

    expect(routerMock.push).toHaveBeenCalledExactlyOnceWith({
      name: "playersettings",
    });
  });
});
