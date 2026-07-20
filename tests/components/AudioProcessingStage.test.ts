import { mount } from "@vue/test-utils";
import { markRaw, nextTick } from "vue";
import { beforeEach, describe, expect, it } from "vitest";
import AudioProcessingStage from "@/components/AudioProcessingStage.vue";
import { i18n } from "@/plugins/i18n";

const TestIcon = markRaw({
  template: '<svg data-testid="stage-icon"></svg>',
});

beforeEach(() => {
  i18n.global.locale.value = "en";
});

describe("AudioProcessingStage", () => {
  it("renders a primary title with atomic technical details", () => {
    const wrapper = mountStage({
      key: "source-format",
      icon: TestIcon,
      title: "VORBIS",
      subtitleParts: ["44.1 kHz", "16-bit", "Stereo"],
      atomicSubtitleParts: true,
    });

    expect(wrapper.find(".audio-processing-stage-title").text()).toBe("VORBIS");
    expect(
      wrapper
        .findAll(".audio-processing-stage-subtitle-part")
        .map((part) => part.text()),
    ).toEqual(["44.1 kHz", "· 16-bit", "· Stereo"]);
    expect(wrapper.find('[data-testid="stage-icon"]').exists()).toBe(true);
    expect(wrapper.find(".audio-processing-stage-connector").exists()).toBe(
      true,
    );
    expect(
      wrapper
        .findAll(".audio-processing-stage-subtitle-part")
        .every((part) =>
          part.classes("audio-processing-stage-subtitle-part--atomic"),
        ),
    ).toBe(true);
  });

  it("allows user-defined titles to wrap", () => {
    const wrapper = mountStage({
      key: "dsp-preset",
      icon: TestIcon,
      title: "A preset name that can wrap across lines",
      subtitleParts: ["DSP preset"],
    });

    expect(wrapper.find(".audio-processing-stage-title").text()).toBe(
      "A preset name that can wrap across lines",
    );
    const detail = wrapper.find(".audio-processing-stage-subtitle-part");
    expect(detail.text()).toBe("DSP preset");
    expect(detail.classes("audio-processing-stage-subtitle-part--atomic")).toBe(
      false,
    );
  });

  it("renders a badge and tooltip details in their dedicated columns", () => {
    const wrapper = mountStage({
      key: "output-format",
      icon: TestIcon,
      title: "FLAC",
      subtitleParts: ["48 kHz", "16-bit", "Stereo"],
      atomicSubtitleParts: true,
      badge: "Bit-perfect",
      details: [
        "Container: FLAC",
        "Bit-perfect: audio samples are unchanged from the source.",
      ],
    });

    expect(wrapper.find(".audio-processing-stage-badge").text()).toBe(
      "Bit-perfect",
    );
    expect(wrapper.find(".audio-processing-stage-info").exists()).toBe(true);
    expect(wrapper.findAll("li").map((detail) => detail.text())).toEqual([
      "Container: FLAC",
      "Bit-perfect: audio samples are unchanged from the source.",
    ]);
  });

  it("opens technical details when the info button is clicked", async () => {
    const wrapper = mount(AudioProcessingStage, {
      attachTo: document.body,
      props: {
        stage: {
          key: "output-format",
          icon: TestIcon,
          title: "FLAC",
          details: ["Audio processing changed the audio samples."],
        },
      },
      global: {
        plugins: [i18n],
      },
    });

    expect(document.body.querySelector('[data-slot="popover-content"]')).toBe(
      null,
    );
    const trigger = wrapper.get(".audio-processing-stage-info");
    expect(trigger.attributes("aria-label")).toBe(
      "More information about FLAC",
    );
    const describedBy = trigger.attributes("aria-describedby");
    if (!describedBy) {
      throw new Error("Info trigger is missing its description reference");
    }
    await trigger.trigger("click");
    await nextTick();

    const content = document.body.querySelector<HTMLElement>(
      '[data-slot="popover-content"]',
    );
    expect(content?.textContent).toContain(
      "Audio processing changed the audio samples.",
    );
    expect(document.getElementById(describedBy)?.textContent).toContain(
      "Audio processing changed the audio samples.",
    );
    expect(content?.getAttribute("aria-label")).toBe(
      "More information about FLAC",
    );
    expect(content?.contains(document.activeElement)).toBe(true);
    expect(document.activeElement?.classList).toContain(
      "audio-processing-stage-detail-content",
    );
    wrapper.unmount();
  });
});

function mountStage(stage: {
  key: string;
  icon: typeof TestIcon;
  title: string;
  subtitleParts?: string[];
  atomicSubtitleParts?: boolean;
  badge?: string;
  details?: string[];
}) {
  return mount(AudioProcessingStage, {
    props: { stage },
    global: {
      plugins: [i18n],
      stubs: {
        Popover: { template: "<div><slot /></div>" },
        PopoverContent: { template: "<div><slot /></div>" },
        PopoverTrigger: {
          props: ["asChild"],
          template: "<slot />",
        },
      },
    },
  });
}
