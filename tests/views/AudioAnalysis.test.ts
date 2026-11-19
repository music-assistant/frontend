import SettingsPageHeader from "@/components/settings/SettingsPageHeader.vue";
import AudioAnalysis from "@/views/settings/AudioAnalysis.vue";
import { enableAutoUnmount, shallowMount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";

enableAutoUnmount(afterEach);

describe("AudioAnalysis", () => {
  it("heads the analysis status with the header of its page", () => {
    const wrapper = shallowMount(AudioAnalysis);

    expect(wrapper.getComponent(SettingsPageHeader).props("page")).toBe(
      "audio_analysis",
    );
  });
});
