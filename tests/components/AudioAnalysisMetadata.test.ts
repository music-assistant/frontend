import AudioAnalysisMetadata from "@/components/AudioAnalysisMetadata.vue";
import type { AudioMetadata } from "@/plugins/api/interfaces";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

function mountMetadata(audioMetadata: AudioMetadata | null) {
  return mount(AudioAnalysisMetadata, {
    props: { audioMetadata },
    global: { mocks: { $t: (key: string) => key } },
  });
}

describe("AudioAnalysisMetadata", () => {
  it("renders the trigger as a labelled button", () => {
    const wrapper = mountMetadata({ bpm: 128, musical_key: null });

    // the popover has to be reachable and activatable from the keyboard
    const trigger = wrapper.find('button[aria-label="audio_analysis"]');
    expect(trigger.exists()).toBe(true);
    expect(trigger.attributes("type")).toBe("button");
  });

  it("renders nothing without analysis data", () => {
    const wrapper = mountMetadata({ bpm: null, musical_key: null });

    expect(wrapper.find("button").exists()).toBe(false);
  });
});
