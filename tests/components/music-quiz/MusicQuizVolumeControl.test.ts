import MusicQuizVolumeControl from "@/components/music-quiz/MusicQuizVolumeControl.vue";
import { Slider } from "@/components/ui/slider";
import { webPlayerOutput } from "@/plugins/web_player";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

const deviceMock = vi.hoisted(() => ({ type: "desktop" }));

vi.mock("@/helpers/device", () => ({
  get DEVICE_TYPE() {
    return deviceMock.type;
  },
}));

vi.mock("@/plugins/web_player", async () => {
  const { reactive } = await import("vue");
  return { webPlayerOutput: reactive({ volume: 100, muted: false }) };
});

describe("MusicQuizVolumeControl", () => {
  beforeEach(() => {
    deviceMock.type = "desktop";
    webPlayerOutput.volume = 100;
    webPlayerOutput.muted = false;
  });

  it("toggles mute on this device", async () => {
    const wrapper = mount(MusicQuizVolumeControl);
    const mute = wrapper.get('[data-testid="music-quiz-mute"]');

    expect(mute.attributes("aria-label")).toBe("tooltip.mute");
    await mute.trigger("click");

    expect(webPlayerOutput.muted).toBe(true);
    expect(mute.attributes("aria-label")).toBe("tooltip.unmute");
    expect(mute.attributes("aria-pressed")).toBe("true");
  });

  it("shows a volume slider on desktop that also unmutes", () => {
    webPlayerOutput.muted = true;
    const wrapper = mount(MusicQuizVolumeControl);
    const slider = wrapper.getComponent(Slider);

    expect(slider.props("modelValue")).toEqual([100]);
    slider.vm.$emit("update:modelValue", [40]);

    expect(webPlayerOutput.volume).toBe(40);
    expect(webPlayerOutput.muted).toBe(false);
  });

  it.each(["phone", "tablet"])(
    "offers only the mute toggle on a %s",
    (type) => {
      deviceMock.type = type;
      const wrapper = mount(MusicQuizVolumeControl);

      expect(wrapper.find('[data-testid="music-quiz-mute"]').exists()).toBe(
        true,
      );
      expect(wrapper.findComponent(Slider).exists()).toBe(false);
    },
  );
});
