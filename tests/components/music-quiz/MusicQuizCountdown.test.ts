import MusicQuizCountdown from "@/components/music-quiz/MusicQuizCountdown.vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

describe("MusicQuizCountdown", () => {
  it("disables the progress transition when reduced motion is requested", () => {
    const wrapper = mount(MusicQuizCountdown, {
      props: {
        label: "10",
        fraction: 0.5,
      },
    });

    expect(wrapper.findAll("circle")[1].classes()).toContain(
      "motion-reduce:transition-none",
    );
  });
});
