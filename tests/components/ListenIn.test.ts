import ListenIn, { type ListenInLabels } from "@/components/ListenIn.vue";
import { Switch } from "@/components/ui/switch";
import { mount } from "@vue/test-utils";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface MockListenInState {
  isListeningIn: Ref<boolean>;
  busy: Ref<boolean>;
  shouldShowListenInToggle: Ref<boolean>;
}

const listenInMock = vi.hoisted(() => ({
  state: undefined as MockListenInState | undefined,
  enableListenIn: vi.fn(),
  disableListenIn: vi.fn(),
}));

vi.mock("@/composables/useListenIn", async () => {
  const { ref } = await import("vue");
  const state = {
    isListeningIn: ref(false),
    busy: ref(false),
    shouldShowListenInToggle: ref(true),
  };
  listenInMock.state = state;
  return {
    useListenIn: () => ({
      ...state,
      enableListenIn: listenInMock.enableListenIn,
      disableListenIn: listenInMock.disableListenIn,
    }),
  };
});

vi.mock("vue-sonner", () => ({
  toast: { error: vi.fn() },
}));

interface ListenInTranslationSource {
  listen_in: string;
  listen_in_active: string;
  listen_in_venue: string;
  listen_in_remote: string;
  listen_in_tap: string;
  listen_in_stop: string;
  listen_in_powered_by: string;
}

const messages = JSON.parse(
  readFileSync(resolve("src/translations/en.json"), "utf8"),
) as {
  providers: {
    party: { guest_page: ListenInTranslationSource };
    music_quiz: ListenInTranslationSource;
  };
};
const surfaces = [
  {
    domain: "party",
    labels: labelsFrom(messages.providers.party.guest_page),
  },
  {
    domain: "music_quiz",
    labels: labelsFrom(messages.providers.music_quiz),
  },
] as const;
const modes = ["venue", "remote"] as const;
const surfaceModes = surfaces.flatMap((surface) =>
  modes.map((mode) => ({ ...surface, mode })),
);

describe("ListenIn", () => {
  beforeEach(() => {
    const state = getMockState();
    state.isListeningIn.value = false;
    state.busy.value = false;
    state.shouldShowListenInToggle.value = true;
    listenInMock.enableListenIn.mockReset();
    listenInMock.disableListenIn.mockReset();
  });

  it.each(surfaceModes)(
    "renders identical two-row copy for $domain in $mode mode",
    ({ domain, labels, mode }) => {
      const wrapper = mount(ListenIn, {
        props: { domain, mode, labels },
      });
      const text = wrapper.get(".listen-in__text");

      expect(text.element.childElementCount).toBe(2);
      expect(wrapper.get(".listen-in__title").text()).toBe("Listen in");
      expect(wrapper.get(".listen-in__attribution").text()).toBe(
        "Powered by Sendspin",
      );
      expect(wrapper.get(".listen-in__desc").text()).toBe(
        "Play the music on this device",
      );
      expect(text.element.children[0]).toBe(
        wrapper.get(".listen-in__title-row").element,
      );
      expect(text.element.children[1]).toBe(
        wrapper.get(".listen-in__desc").element,
      );
    },
  );

  it.each(surfaceModes)(
    "keeps the active copy for $domain in $mode mode",
    ({ domain, labels, mode }) => {
      getMockState().isListeningIn.value = true;
      const wrapper = mount(ListenIn, {
        props: { domain, mode, labels },
      });

      expect(wrapper.get(".listen-in__title").text()).toBe("You're listening");
      expect(wrapper.get(".listen-in__desc").text()).toBe(
        "Play the music on this device",
      );
    },
  );

  it("keeps the venue switch and remote start/stop actions", async () => {
    const venue = mount(ListenIn, {
      props: {
        domain: "party",
        mode: "venue",
        labels: surfaces[0].labels,
      },
    });
    const venueSwitch = venue.getComponent(Switch);

    venueSwitch.vm.$emit("update:modelValue", true);
    venueSwitch.vm.$emit("update:modelValue", false);
    expect(listenInMock.enableListenIn).toHaveBeenCalledOnce();
    expect(listenInMock.disableListenIn).toHaveBeenCalledOnce();

    listenInMock.enableListenIn.mockReset();
    const remote = mount(ListenIn, {
      props: {
        domain: "music_quiz",
        mode: "remote",
        labels: surfaces[1].labels,
      },
    });

    await remote.get("button").trigger("click");
    expect(listenInMock.enableListenIn).toHaveBeenCalledOnce();

    remote.unmount();
    getMockState().isListeningIn.value = true;
    const activeRemote = mount(ListenIn, {
      props: {
        domain: "music_quiz",
        mode: "remote",
        labels: surfaces[1].labels,
      },
    });

    await activeRemote.get("button").trigger("click");
    expect(listenInMock.disableListenIn).toHaveBeenCalledTimes(2);
  });

  it("disables both action types while busy", () => {
    getMockState().busy.value = true;
    const venue = mount(ListenIn, {
      props: {
        domain: "party",
        mode: "venue",
        labels: surfaces[0].labels,
      },
    });
    const remote = mount(ListenIn, {
      props: {
        domain: "music_quiz",
        mode: "remote",
        labels: surfaces[1].labels,
      },
    });

    expect(venue.get('[data-slot="switch"]').attributes()).toHaveProperty(
      "disabled",
    );
    expect(remote.get("button").attributes()).toHaveProperty("disabled");
  });

  it("keeps Sendspin attribution secondary and inside the title row", () => {
    const wrapper = mount(ListenIn, {
      props: {
        domain: "music_quiz",
        mode: "remote",
        labels: surfaces[1].labels,
      },
    });

    const titleRow = wrapper.get(".listen-in__title-row");
    expect(titleRow.text()).toContain("Listen in");
    expect(titleRow.text()).toContain("Powered by Sendspin");
    expect(wrapper.get(".listen-in__attribution").classes()).toContain(
      "listen-in__attribution",
    );
    expect(wrapper.get(".listen-in__row").classes()).toEqual(
      expect.arrayContaining(["w-full", "min-w-0"]),
    );
  });
});

function labelsFrom(source: ListenInTranslationSource): ListenInLabels {
  return {
    title: source.listen_in,
    titleActive: source.listen_in_active,
    descriptionVenue: source.listen_in_venue,
    descriptionRemote: source.listen_in_remote,
    tap: source.listen_in_tap,
    stop: source.listen_in_stop,
    poweredBy: source.listen_in_powered_by,
    errorNoWebPlayer: "Unavailable",
    errorListenIn: "Start failed",
    errorStopListenIn: "Stop failed",
  };
}

function getMockState(): MockListenInState {
  if (!listenInMock.state) throw new Error("Listen-in mock is not initialized");
  return listenInMock.state;
}
