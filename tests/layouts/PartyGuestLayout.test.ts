import PartyGuestLayout from "@/layouts/PartyGuestLayout.vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

describe("PartyGuestLayout", () => {
  it("provides a viewport-height scroll container for guest routes", () => {
    const wrapper = mount(PartyGuestLayout, {
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
