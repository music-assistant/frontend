import AudioAnalysisMetadata from "@/components/AudioAnalysisMetadata.vue";
import type { AudioMetadata } from "@/plugins/api/interfaces";
import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

function mountMetadata(audioMetadata: AudioMetadata | null) {
  return mount(AudioAnalysisMetadata, {
    props: { audioMetadata },
    global: { mocks: { $t: (key: string) => key } },
  });
}

describe("AudioAnalysisMetadata", () => {
  it("renders the trigger as a labelled button", () => {
    const wrapper = mountMetadata({
      bpm: 128,
      musical_key: "F# minor",
      camelot_key: "11A",
    });

    // the popover has to be reachable and activatable from the keyboard
    const trigger = wrapper.find('button[aria-label="audio_analysis"]');
    expect(trigger.exists()).toBe(true);
    expect(trigger.attributes("type")).toBe("button");
  });

  it("shows the Camelot key behind the musical key", async () => {
    const wrapper = mountMetadata({
      bpm: 128,
      musical_key: "F# minor",
      camelot_key: "11A",
    });

    await wrapper.find("button").trigger("click");
    await flushPromises();

    const popoverText = document.body.textContent;
    wrapper.unmount();
    expect(popoverText).toContain("F# minor (11A)");
  });

  it("renders nothing without analysis data", () => {
    const wrapper = mountMetadata({
      bpm: null,
      musical_key: null,
      camelot_key: null,
    });

    expect(wrapper.find("button").exists()).toBe(false);
  });
});
