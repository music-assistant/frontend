import MusicQuizPreparingState from "@/components/music-quiz/MusicQuizPreparingState.vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

describe("MusicQuizPreparingState", () => {
  it("announces without taking focus away from the participant", () => {
    const wrapper = mount(MusicQuizPreparingState, {
      attachTo: document.body,
    });

    const status = wrapper.get('[data-testid="music-quiz-preparing"]');
    expect(status.attributes("role")).toBe("status");
    expect(status.attributes("aria-live")).toBe("polite");
    expect(document.activeElement).not.toBe(status.element);
    expect(document.activeElement).toBe(document.body);

    wrapper.unmount();
  });

  it("focuses the status region for the client that triggered the action", () => {
    const wrapper = mount(MusicQuizPreparingState, {
      attachTo: document.body,
      props: { autofocus: true },
    });

    const status = wrapper.get('[data-testid="music-quiz-preparing"]');
    expect(status.attributes("aria-live")).toBe("polite");
    expect(document.activeElement).toBe(status.element);

    wrapper.unmount();
  });
});
