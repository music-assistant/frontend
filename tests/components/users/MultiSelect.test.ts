import MultiSelect from "@/components/users/MultiSelect.vue";
import {
  enableAutoUnmount,
  flushPromises,
  mount,
  type VueWrapper,
} from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { storeMock } = vi.hoisted(() => ({
  storeMock: {
    isTouchscreen: false,
  },
}));

vi.mock("@/plugins/store", () => ({ store: storeMock }));

vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

// an open popover keeps document-level dismiss listeners, so tear it down even
// when an assertion fails
enableAutoUnmount(afterEach);

beforeEach(() => {
  storeMock.isTouchscreen = false;
  document.body.innerHTML = "";
});

describe("MultiSelect", () => {
  it("focuses the search field on a non-touch device", async () => {
    await openOptions();

    expect(document.activeElement).toBe(searchField());
  });

  it("leaves the search field alone on a touch device", async () => {
    storeMock.isTouchscreen = true;

    await openOptions();

    expect(document.activeElement).not.toBe(searchField());
    // the options stay reachable: the popover keeps focus instead of handing it
    // back outside and dismissing itself
    expect(optionsList()).not.toBeNull();
  });
});

function searchField() {
  return document.querySelector("[data-slot='command-input']");
}

function optionsList() {
  return document.querySelector("[data-slot='popover-content']");
}

async function openOptions(): Promise<VueWrapper> {
  const wrapper = mount(MultiSelect, {
    props: {
      modelValue: [],
      options: [
        { label: "Albums", value: "album" },
        { label: "Tracks", value: "track" },
      ],
    },
    attachTo: document.body,
    global: { mocks: { $t: (key: string) => key } },
  });

  await wrapper.get("button").trigger("click");
  await flushPromises();
  // reka-ui focuses the command input from a 1ms timer, so a flush is not
  // enough to observe where focus ends up
  await new Promise((resolve) => setTimeout(resolve, 20));
  return wrapper;
}
