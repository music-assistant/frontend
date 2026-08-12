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

  it("focuses the options list itself on a touch device", async () => {
    storeMock.isTouchscreen = true;

    await openOptions();

    expect(document.activeElement).not.toBe(searchField());
    // the list takes focus instead, so a screen reader announces it and the
    // tab order continues from there
    expect(optionsList()).not.toBeNull();
    expect(document.activeElement).toBe(optionsList());
  });
});

function searchField() {
  return document.querySelector("[data-slot='command-input']");
}

function optionsList() {
  return document.querySelector("[data-slot='popover-content']");
}

function trigger() {
  return document.querySelector<HTMLElement>("[data-slot='popover-trigger']");
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

  // a real click leaves the button focused, which a synthetic one does not
  trigger()!.focus();
  trigger()!.click();
  await flushPromises();
  // reka-ui focuses the command input from a 1ms timer, so a flush is not
  // enough to observe where focus ends up
  await new Promise((resolve) => setTimeout(resolve, 20));
  return wrapper;
}
