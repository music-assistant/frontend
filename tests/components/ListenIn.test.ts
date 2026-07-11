import ListenIn from "@/components/ListenIn.vue";
import { mount } from "@vue/test-utils";
import { ref } from "vue";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/composables/useListenIn", () => ({
  useListenIn: () => ({
    isListeningIn: ref(false),
    busy: ref(false),
    shouldShowListenInToggle: ref(true),
    enableListenIn: vi.fn(),
    disableListenIn: vi.fn(),
  }),
}));

vi.mock("vue-sonner", () => ({
  toast: { error: vi.fn() },
}));

const labels = {
  title: "Listen in",
  titleActive: "Listening",
  descriptionVenue: "Room audio",
  descriptionRemote: "Remote audio",
  tap: "Listen",
  stop: "Stop",
  poweredBy: "Powered by Sendspin",
  errorNoWebPlayer: "Unavailable",
  errorListenIn: "Start failed",
  errorStopListenIn: "Stop failed",
};

describe("ListenIn", () => {
  it("keeps Sendspin attribution secondary and inside the control row", () => {
    const wrapper = mount(ListenIn, {
      props: {
        domain: "music_quiz",
        mode: "remote",
        labels,
      },
    });

    const titleRow = wrapper.get(".listen-in__title-row");
    expect(titleRow.text()).toContain("Listen in");
    expect(titleRow.text()).toContain("Powered by Sendspin");
    expect(wrapper.get(".listen-in__attribution").classes()).toContain(
      "listen-in__attribution",
    );
  });
});
