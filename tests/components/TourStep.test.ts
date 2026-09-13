// Imported once, outside any test: pulling the card components in is the
// expensive part, and the import phase is not on a test's clock.
import TourStep from "@/components/onboarding/steps/TourStep.vue";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { routerMock } = vi.hoisted(() => ({
  routerMock: { push: vi.fn(), replace: vi.fn() },
}));

vi.mock("vue-router", () => ({ useRouter: () => routerMock }));

function mountStep() {
  return mount(TourStep, {
    global: { mocks: { $t: (key: string) => key } },
  });
}

describe("TourStep", () => {
  beforeEach(() => {
    routerMock.push.mockReset();
  });

  it("shows the member around the four places they will use", () => {
    const wrapper = mountStep();

    expect(wrapper.findAll("[data-testid=onboarding-tour-card]")).toHaveLength(
      4,
    );
    for (const card of ["library", "search", "player_bar", "profile"]) {
      expect(wrapper.text()).toContain(`onboarding.steps.tour.${card}.title`);
      expect(wrapper.text()).toContain(
        `onboarding.steps.tour.${card}.description`,
      );
    }

    wrapper.unmount();
  });

  it.each([
    ["library", "artists"],
    ["profile", "profile"],
  ])("opens %s at the page it lives on", async (card, route) => {
    const wrapper = mountStep();

    await wrapper
      .find(`[data-testid=onboarding-tour-open-${card}]`)
      .trigger("click");

    expect(routerMock.push).toHaveBeenCalledWith({ name: route });

    wrapper.unmount();
  });

  it.each(["search", "player_bar"])(
    "offers nowhere to go for %s, which is always on screen",
    (card) => {
      const wrapper = mountStep();

      // both are part of the app's chrome rather than a page of their own, so
      // a button promising to open one would have nowhere to send anybody
      expect(
        wrapper.find(`[data-testid=onboarding-tour-open-${card}]`).exists(),
      ).toBe(false);

      wrapper.unmount();
    },
  );
});
