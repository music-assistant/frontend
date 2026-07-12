import GuestEntryView from "@/views/GuestEntryView.vue";
import { mount } from "@vue/test-utils";
import { readonly, ref } from "vue";
import { describe, expect, it, vi } from "vitest";

const { guestEntryStateKey } = vi.hoisted(() => ({
  guestEntryStateKey: Symbol("guest-entry-state"),
}));

vi.mock("@/composables/useGuestEntryResolver", () => ({
  guestEntryStateKey,
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

describe("GuestEntryView", () => {
  it.each([
    ["loading", "guest.loading_title", "guest.loading_description"],
    ["quiz-inactive", "guest.no_quiz_title", "guest.no_quiz_description"],
    [
      "inactive",
      "guest.nothing_active_title",
      "guest.nothing_active_description",
    ],
  ] as const)("renders the %s empty state", (state, title, description) => {
    const wrapper = mount(GuestEntryView, {
      global: {
        provide: {
          [guestEntryStateKey]: readonly(ref(state)),
        },
      },
    });

    expect(wrapper.text()).toContain(title);
    expect(wrapper.text()).toContain(description);
    expect(wrapper.get('[data-slot="card-header"]').classes()).toContain(
      "justify-items-center",
    );
    expect(
      wrapper.get('svg[aria-hidden="true"]').attributes("aria-hidden"),
    ).toBe("true");
  });
});
