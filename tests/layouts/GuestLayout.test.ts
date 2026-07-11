import GuestLayout from "@/layouts/GuestLayout.vue";
import { mount } from "@vue/test-utils";
import { ref } from "vue";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/composables/useGuestEntryResolver", () => ({
  guestEntryStateKey: Symbol("guest-entry-state"),
  useGuestEntryResolver: () => ({ state: ref("inactive") }),
}));

describe("GuestLayout", () => {
  it("provides a viewport-height scroll container for guest routes", () => {
    const wrapper = mount(GuestLayout, {
      global: {
        stubs: {
          RouterView: true,
        },
      },
    });

    expect(wrapper.classes()).toContain("h-dvh");
    expect(wrapper.classes()).toContain("overflow-y-auto");
  });
});
