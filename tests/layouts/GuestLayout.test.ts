import GuestLayout from "@/layouts/GuestLayout.vue";
import { mount } from "@vue/test-utils";
import { ref } from "vue";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/composables/useGuestEntryResolver", () => ({
  guestEntryStateKey: Symbol("guest-entry-state"),
  useGuestEntryResolver: () => ({ state: ref("inactive") }),
}));

vi.mock("vuetify", () => ({
  useTheme: () => ({
    current: ref({ dark: false }),
  }),
}));

describe("GuestLayout", () => {
  it("provides shared branding and a viewport-height guest container", () => {
    const wrapper = mount(GuestLayout, {
      global: {
        stubs: {
          RouterView: true,
        },
      },
    });

    expect(wrapper.classes()).toContain("h-dvh");
    expect(wrapper.classes()).toContain("overflow-hidden");
    expect(
      wrapper.get('img[alt="Music Assistant"]').attributes("src"),
    ).toContain("logo-dark.svg");
    expect(wrapper.get("main").classes()).toContain("overflow-y-auto");
  });
});
