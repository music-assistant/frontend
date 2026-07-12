import ListenIn, { type ListenInLabels } from "@/components/ListenIn.vue";
import { Switch } from "@/components/ui/switch";
import { $t, i18n } from "@/plugins/i18n";
import { mount } from "@vue/test-utils";
import { nextTick, type Ref } from "vue";
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

const initialLocale = i18n.global.locale.value;
i18n.global.locale.value = "en";

const surfaces = [
  {
    domain: "party",
    labels: labelsFrom("providers.party.guest_page"),
  },
  {
    domain: "music_quiz",
    labels: labelsFrom("providers.music_quiz"),
  },
] as const;
const modes = ["venue", "remote"] as const;
const surfaceModes = surfaces.flatMap((surface) =>
  modes.map((mode) => ({ ...surface, mode })),
);
const states = [
  { isListeningIn: false, expectedTitle: "Listen in" },
  { isListeningIn: true, expectedTitle: "You're listening" },
] as const;
const renderCases = surfaceModes.flatMap((surfaceMode) =>
  states.map((state) => ({ ...surfaceMode, ...state })),
);
i18n.global.locale.value = initialLocale;

describe("ListenIn", () => {
  beforeEach(() => {
    const state = getMockState();
    state.isListeningIn.value = false;
    state.busy.value = false;
    state.shouldShowListenInToggle.value = true;
    listenInMock.enableListenIn.mockReset();
    listenInMock.disableListenIn.mockReset();
  });

  it.each(renderCases)(
    "renders exactly two compact text rows for $domain in $mode mode (active: $isListeningIn)",
    ({ domain, labels, mode, isListeningIn, expectedTitle }) => {
      getMockState().isListeningIn.value = isListeningIn;
      const wrapper = mount(ListenIn, {
        props: { domain, mode, labels },
      });
      const text = wrapper.get(".listen-in__text");
      const titleRow = wrapper.get(".listen-in__title-row");
      const title = wrapper.get(".listen-in__title");
      const description = wrapper.get(".listen-in__desc");
      const attribution = wrapper.get(".listen-in__attribution");
      const action = wrapper.get(".listen-in__action");

      expect(text.element.childElementCount).toBe(2);
      expect(text.element.children[0]).toBe(titleRow.element);
      expect(text.element.children[1]).toBe(description.element);
      expect(titleRow.element.childElementCount).toBe(2);
      expect(titleRow.element.children[0]).toBe(title.element);
      expect(titleRow.element.children[1]).toBe(attribution.element);
      expect(title.text()).toBe(expectedTitle);
      expect(description.text()).toBe("Hear the music on this device");
      expect(attribution.text()).toBe("Powered by Sendspin");
      expect(attribution.isVisible()).toBe(true);
      expect(attribution.classes()).not.toContain("sr-only");
      expect(attribution.classes()).toEqual(
        expect.arrayContaining(["min-w-0", "truncate", "text-[0.625rem]"]),
      );
      expect(attribution.classes()).not.toContain("shrink-0");
      expect(attribution.attributes("title")).toBe(attribution.text());
      expect(attribution.attributes("aria-hidden")).toBeUndefined();
      expect(action.attributes("aria-describedby")).toBe(
        attribution.attributes("id"),
      );
      expect(wrapper.classes()).toContain("min-w-0");
      expect(wrapper.get(".listen-in__row").classes()).toEqual(
        expect.arrayContaining(["w-full", "min-w-0"]),
      );
      expect(text.classes()).toEqual(
        expect.arrayContaining(["min-w-0", "overflow-hidden"]),
      );
      expect(titleRow.classes()).toContain("min-w-0");
      expect(title.classes()).toEqual(
        expect.arrayContaining(["block", "shrink-0", "whitespace-nowrap"]),
      );
      expect(title.classes()).not.toContain("truncate");
      expect(title.classes()).not.toContain("min-w-0");
      expect(description.classes()).toEqual(
        expect.arrayContaining(["block", "truncate"]),
      );
      expect(action.classes()).toContain("shrink-0");
    },
  );

  it("prioritizes the title over a long attribution", () => {
    const labels = {
      ...surfaces[0].labels,
      title: "Luister mee",
      titleActive: "Je luistert mee",
      tap: "Tik om te luisteren",
      poweredBy: "Mogelijk gemaakt door Sendspin",
    };
    const wrapper = mount(ListenIn, {
      props: { domain: "party", mode: "remote", labels },
    });
    const text = wrapper.get(".listen-in__text");
    const titleRow = wrapper.get(".listen-in__title-row");
    const title = wrapper.get(".listen-in__title");
    const attribution = wrapper.get(".listen-in__attribution");
    const description = wrapper.get(".listen-in__desc");
    const action = wrapper.get(".listen-in__action");

    expect(text.element.childElementCount).toBe(2);
    expect(text.element.children[0]).toBe(titleRow.element);
    expect(text.element.children[1]).toBe(description.element);
    expect(titleRow.element.children[0]).toBe(title.element);
    expect(titleRow.element.children[1]).toBe(attribution.element);
    expect(title.text()).toBe("Luister mee");
    expect(title.classes()).toEqual(
      expect.arrayContaining(["shrink-0", "whitespace-nowrap"]),
    );
    expect(title.classes()).not.toContain("truncate");
    expect(attribution.text()).toBe("Mogelijk gemaakt door Sendspin");
    expect(attribution.classes()).toEqual(
      expect.arrayContaining(["min-w-0", "truncate"]),
    );
    expect(attribution.classes()).not.toContain("shrink-0");
    expect(attribution.attributes("title")).toBe(
      "Mogelijk gemaakt door Sendspin",
    );
    expect(description.text()).toBe("Hear the music on this device");
    expect(action.text()).toBe("Tik om te luisteren");
    expect(action.attributes("aria-describedby")).toBe(
      attribution.attributes("id"),
    );
  });

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

  it("renders enabled actions and disables both action types while busy", async () => {
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
    const venueAction = venue.get('[data-slot="switch"]');
    const remoteAction = remote.get("button");

    expect(venueAction.attributes("disabled")).toBeUndefined();
    expect(remoteAction.attributes("disabled")).toBeUndefined();

    getMockState().busy.value = true;
    await nextTick();

    expect(venueAction.attributes()).toHaveProperty("disabled");
    expect(remoteAction.attributes()).toHaveProperty("disabled");
    expect(venueAction.classes()).toContain("shrink-0");
    expect(remoteAction.classes()).toContain("shrink-0");
  });
});

function labelsFrom(prefix: string): ListenInLabels {
  return {
    title: $t(`${prefix}.listen_in`),
    titleActive: $t(`${prefix}.listen_in_active`),
    descriptionVenue: $t(`${prefix}.listen_in_venue`),
    descriptionRemote: $t(`${prefix}.listen_in_remote`),
    tap: $t(`${prefix}.listen_in_tap`),
    stop: $t(`${prefix}.listen_in_stop`),
    poweredBy: $t(`${prefix}.listen_in_powered_by`),
    errorNoWebPlayer: "Unavailable",
    errorListenIn: "Start failed",
    errorStopListenIn: "Stop failed",
  };
}

function getMockState(): MockListenInState {
  if (!listenInMock.state) throw new Error("Listen-in mock is not initialized");
  return listenInMock.state;
}
