import OnboardingProgress from "@/components/onboarding/OnboardingProgress.vue";
import type { OnboardingStepId } from "@/helpers/onboarding";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

const STEPS: { id: OnboardingStepId; done: boolean }[] = [
  { id: "intent", done: true },
  { id: "music_sources", done: true },
  { id: "players", done: false },
  { id: "plugins", done: false },
];

function mountProgress(current: number) {
  return mount(OnboardingProgress, { props: { steps: STEPS, current } });
}

function stepButtons(wrapper: ReturnType<typeof mountProgress>) {
  return wrapper.findAll("[data-testid=onboarding-progress-step]");
}

describe("OnboardingProgress", () => {
  it("makes only the steps behind the current one clickable", () => {
    // on "players": the two completed steps before it are the way back, it and
    // the one ahead are not
    const buttons = stepButtons(mountProgress(2));

    expect(buttons).toHaveLength(4);
    expect(buttons[0].attributes("disabled")).toBeUndefined();
    expect(buttons[1].attributes("disabled")).toBeUndefined();
    expect(buttons[2].attributes("disabled")).toBeDefined();
    expect(buttons[3].attributes("disabled")).toBeDefined();
  });

  it("jumps back to a step behind the current one that is still to do", async () => {
    const wrapper = mountProgress(3);

    await stepButtons(wrapper)[2].trigger("click");

    expect(wrapper.emitted("navigate")).toEqual([["players"]]);
  });

  it("marks the current step for a screen reader", () => {
    const buttons = stepButtons(mountProgress(2));

    expect(buttons[2].attributes("aria-current")).toBe("step");
    expect(buttons[0].attributes("aria-current")).toBeUndefined();
    expect(buttons[3].attributes("aria-current")).toBeUndefined();
  });

  it("jumps back to an earlier step when it is clicked", async () => {
    const wrapper = mountProgress(2);

    await stepButtons(wrapper)[0].trigger("click");

    expect(wrapper.emitted("navigate")).toEqual([["intent"]]);
  });

  it("does not navigate to the current step or one ahead", async () => {
    const wrapper = mountProgress(2);

    await stepButtons(wrapper)[2].trigger("click");
    await stepButtons(wrapper)[3].trigger("click");

    expect(wrapper.emitted("navigate")).toBeUndefined();
  });

  it("labels a completed step as completed for a screen reader", () => {
    // the tick that shows completion to sighted users carries no text, so the
    // label has to say it
    const buttons = stepButtons(mountProgress(2));

    expect(buttons[0].attributes("aria-label")).toBe(
      "onboarding.step_completed",
    );
    expect(buttons[2].attributes("aria-label")).toBe(
      "onboarding.steps.players.title",
    );
    expect(buttons[3].attributes("aria-label")).toBe(
      "onboarding.steps.plugins.title",
    );
  });

  it("fills the done and current segments, mutes a skipped one and leaves the rest open", () => {
    const segment = (index: number) =>
      stepButtons(mountProgress(2))[index].find("span").classes();
    const skipped = mount(OnboardingProgress, {
      props: {
        steps: [{ id: "intent", done: false }, ...STEPS.slice(1)],
        current: 2,
      },
    });

    expect(segment(0)).toContain("bg-primary");
    expect(segment(2)).toContain("bg-primary");
    expect(segment(3)).toContain("bg-border");
    expect(
      skipped
        .findAll("[data-testid=onboarding-progress-step]")[0]
        .find("span")
        .classes(),
    ).toContain("bg-muted-foreground/50");
  });
});
