import GetStartedStep from "@/components/onboarding/steps/GetStartedStep.vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

describe("GetStartedStep", () => {
  it("outlines the setup, leaving the start to the wizard's own button", () => {
    const wrapper = mount(GetStartedStep, {
      global: { mocks: { $t: (key: string) => key } },
    });

    expect(
      wrapper
        .find("[data-testid=onboarding-invitation-features]")
        .findAll("li")
        .map((item) => item.text()),
    ).toEqual([
      "onboarding.steps.get_started.features.account",
      "onboarding.steps.get_started.features.intent",
      "onboarding.steps.get_started.features.music",
      "onboarding.steps.get_started.features.extras",
    ]);
    expect(wrapper.find("button").exists()).toBe(false);
    expect(
      wrapper.find("[data-testid=onboarding-invitation-note]").exists(),
    ).toBe(false);

    wrapper.unmount();
  });
});
