import {
  enableAutoUnmount,
  flushPromises,
  mount,
  shallowMount,
  type VueWrapper,
} from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { h, nextTick } from "vue";
import { createMemoryHistory, createRouter, RouterView } from "vue-router";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import { ConfigEntryType, type ConfigEntry } from "@/plugins/api/interfaces";
import EditConfig from "@/views/settings/EditConfig.vue";

const { apiMock, routerMock, storeMock } = vi.hoisted(() => ({
  apiMock: {
    players: {},
    providers: {},
  },
  routerMock: {
    push: vi.fn(),
  },
  storeMock: {
    frameless: false,
    mobileLayout: false,
  },
}));

vi.mock("@/plugins/api", () => ({
  api: apiMock,
  default: apiMock,
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));
vi.mock("@/plugins/store", () => ({ store: storeMock }));

vi.mock("vue-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("vue-router")>();
  const { inject } = await vi.importActual<typeof import("vue")>("vue");
  return {
    ...actual,
    // the routed tests install a real router; the rest mount the form on its own
    useRouter: () => inject(actual.routerKey, routerMock as never),
  };
});

// the form listens for beforeunload, so a leaked instance keeps reacting
enableAutoUnmount(afterEach);

describe("EditConfig", () => {
  beforeEach(() => {
    storeMock.frameless = false;
    storeMock.mobileLayout = false;
  });

  it.each([
    ConfigEntryType.DIVIDER,
    ConfigEntryType.LABEL,
    ConfigEntryType.ALERT,
    ConfigEntryType.IMAGE,
  ])("hides a %s entry while its dependency is unmet", (type) => {
    const wrapper = mountEntries([
      entry({ key: "enable_feature", type: ConfigEntryType.BOOLEAN }),
      dependentEntry({ key: "feature_status", type }),
    ]);

    expect(renderedKeys(wrapper)).toEqual(["enable_feature"]);
  });

  it.each([
    ConfigEntryType.DIVIDER,
    ConfigEntryType.LABEL,
    ConfigEntryType.ALERT,
    ConfigEntryType.IMAGE,
  ])("shows a %s entry once its dependency is met", (type) => {
    const wrapper = mountEntries([
      entry({
        key: "enable_feature",
        type: ConfigEntryType.BOOLEAN,
        value: true,
      }),
      dependentEntry({ key: "feature_status", type }),
    ]);

    expect(renderedKeys(wrapper)).toEqual(["enable_feature", "feature_status"]);
  });

  it("fills in the entry a field points at and offers the value under its name", async () => {
    const wrapper = mountEntries([
      entry({
        key: "power_control",
        type: ConfigEntryType.STRING,
        value: "none",
        options: [{ title: "None", value: "none" }],
      }),
    ]);

    const row = wrapper.findAllComponents({ name: "ConfigEntryRow" })[0];
    row.vm.$emit("set-entry-value", "power_control", "switch.amp", "Amplifier");
    await nextTick();

    const target = row.props("confEntry") as ConfigEntry;
    expect(target.value).toBe("switch.amp");
    // the server has not listed it yet, so the name must come from the field
    expect(target.options).toContainEqual({
      title: "Amplifier",
      value: "switch.amp",
    });
    expect(saveDisabled(wrapper)).toBe(false);
  });

  it("keeps an input with an unmet dependency visible but disabled", () => {
    const wrapper = mountEntries([
      entry({ key: "enable_feature", type: ConfigEntryType.BOOLEAN }),
      dependentEntry({ key: "feature_detail", type: ConfigEntryType.STRING }),
    ]);

    const rows = wrapper.findAllComponents({ name: "ConfigEntryRow" });
    expect(renderedKeys(wrapper)).toEqual(["enable_feature", "feature_detail"]);
    expect(rows[0].props("disabled")).toBe(false);
    expect(rows[1].props("disabled")).toBe(true);
  });

  it("hides a label whose dependency key is not in the form", () => {
    const wrapper = mountEntries([
      entry({ key: "enable_feature", type: ConfigEntryType.BOOLEAN }),
      entry({
        key: "feature_status",
        type: ConfigEntryType.LABEL,
        depends_on: "typo_in_this_key",
      }),
    ]);

    expect(renderedKeys(wrapper)).toEqual(["enable_feature"]);
  });

  it("disables an input whose dependency key is not in the form", () => {
    const wrapper = mountEntries([
      entry({
        key: "feature_detail",
        type: ConfigEntryType.STRING,
        depends_on: "typo_in_this_key",
      }),
    ]);

    const rows = wrapper.findAllComponents({ name: "ConfigEntryRow" });
    expect(renderedKeys(wrapper)).toEqual(["feature_detail"]);
    expect(rows[0].props("disabled")).toBe(true);
  });

  it("disables every field while the whole form is disabled", () => {
    const wrapper = mountEntries(
      [
        entry({ key: "enable_feature", type: ConfigEntryType.BOOLEAN }),
        entry({ key: "feature_detail", type: ConfigEntryType.STRING }),
      ],
      true,
    );

    const rows = wrapper.findAllComponents({ name: "ConfigEntryRow" });
    expect(rows.map((row) => row.props("disabled"))).toEqual([true, true]);
  });

  it("keeps a label visible while the whole form is disabled", () => {
    const wrapper = mountEntries(
      [
        entry({ key: "enable_feature", type: ConfigEntryType.BOOLEAN }),
        entry({ key: "feature_status", type: ConfigEntryType.LABEL }),
      ],
      true,
    );

    expect(renderedKeys(wrapper)).toEqual(["enable_feature", "feature_status"]);
  });

  it("reveals a label as soon as the dependency flips, without a save", async () => {
    const entries = [
      entry({ key: "enable_feature", type: ConfigEntryType.BOOLEAN }),
      dependentEntry({ key: "feature_status", type: ConfigEntryType.LABEL }),
    ];
    const wrapper = mountEntries(entries);
    expect(renderedKeys(wrapper)).toEqual(["enable_feature"]);

    // onValueUpdate edits the entry object in place, so this is what ticking the box does
    const toggle = wrapper
      .findAllComponents({ name: "ConfigEntryRow" })[0]
      .props("confEntry") as ConfigEntry;
    toggle.value = true;
    await nextTick();

    expect(renderedKeys(wrapper)).toEqual(["enable_feature", "feature_status"]);
  });

  // a presentational entry carries nothing the user can fill in, so a required one
  // must never be able to block saving the entries that do
  it("saves a dirty form despite a required entry the user cannot fill in", async () => {
    const wrapper = mountEntries([
      entry({ key: "server", type: ConfigEntryType.STRING }),
      entry({
        key: "pairing_code",
        type: ConfigEntryType.IMAGE,
        required: true,
      }),
    ]);

    dirty(wrapper);
    await nextTick();

    expect(saveDisabled(wrapper)).toBe(false);
  });

  it("still blocks saving on a required input the user left empty", async () => {
    const wrapper = mountEntries([
      entry({ key: "server", type: ConfigEntryType.STRING }),
      entry({ key: "token", type: ConfigEntryType.STRING, required: true }),
    ]);

    dirty(wrapper);
    await nextTick();

    expect(saveDisabled(wrapper)).toBe(true);
  });

  // an unmet dependency greys the input out, so a required entry behind one is
  // unfillable and must not hold the whole form hostage
  it("saves a dirty form despite a required entry behind an unmet dependency", async () => {
    const wrapper = mountEntries([
      entry({ key: "server", type: ConfigEntryType.STRING }),
      entry({
        key: "use_proxy",
        type: ConfigEntryType.BOOLEAN,
        value: false,
      }),
      entry({
        key: "proxy_url",
        type: ConfigEntryType.STRING,
        required: true,
        depends_on: "use_proxy",
      }),
    ]);

    dirty(wrapper);
    await nextTick();

    expect(saveDisabled(wrapper)).toBe(false);
  });

  it("blocks saving again once the dependency is met", async () => {
    const entries = [
      entry({ key: "server", type: ConfigEntryType.STRING }),
      entry({ key: "use_proxy", type: ConfigEntryType.BOOLEAN, value: false }),
      entry({
        key: "proxy_url",
        type: ConfigEntryType.STRING,
        required: true,
        depends_on: "use_proxy",
      }),
    ];
    const wrapper = mountEntries(entries);
    dirty(wrapper);

    const toggle = wrapper
      .findAllComponents({ name: "ConfigEntryRow" })[1]
      .props("confEntry") as ConfigEntry;
    toggle.value = true;
    await nextTick();

    expect(saveDisabled(wrapper)).toBe(true);
  });

  it("leaves the form-wide controls to the settings screen around it", async () => {
    const wrapper = mountEntries([
      entry({ key: "server", type: ConfigEntryType.STRING }),
    ]);

    dirty(wrapper);
    await nextTick();

    expect(wrapper.get('[data-testid="config-save"]').text()).toContain(
      "settings.save",
    );
    expect(wrapper.text()).not.toContain("settings.show_advanced_settings");
    expect(wrapper.text()).not.toContain("settings.reset_to_defaults");
  });

  it("puts every entry back to its default value on request", async () => {
    const wrapper = mountEntries([
      entry({
        key: "server",
        type: ConfigEntryType.STRING,
        default_value: "localhost",
        value: "elsewhere",
      }),
    ]);

    wrapper.vm.resetToDefaults();
    await nextTick();

    expect(
      (
        wrapper
          .findAllComponents({ name: "ConfigEntryRow" })[0]
          .props("confEntry") as ConfigEntry
      ).value,
    ).toBe("localhost");
    expect(saveDisabled(wrapper)).toBe(false);
  });

  it("hides the save action on a disabled form", () => {
    const wrapper = mountEntries(
      [entry({ key: "server", type: ConfigEntryType.STRING })],
      true,
    );

    expect(wrapper.find('[data-testid="config-save"]').exists()).toBe(false);
  });

  it.each([
    ["mobile", "mobileLayout", "floating-save--mobile"],
    ["frameless", "frameless", "floating-save--frameless"],
  ] as const)(
    "uses the %s save position in that layout",
    (_, layout, cssClass) => {
      storeMock[layout] = true;

      const wrapper = mountEntries([
        entry({ key: "server", type: ConfigEntryType.STRING }),
      ]);

      expect(wrapper.get(".floating-save").classes()).toContain(cssClass);
    },
  );
});

describe("EditConfig unsaved changes", () => {
  it("carries on to the page the user picked once they discard", async () => {
    const { router, wrapper } = await mountInRouter();
    dirty(wrapper);
    await nextTick();

    // the user picks another entry in the settings menu
    router.push({ name: "music-quiz" });
    await flushPromises();
    expect(router.currentRoute.value.name).toBe("editprovider");

    await click(wrapper, "config-discard");

    expect(router.currentRoute.value.name).toBe("music-quiz");
  });

  it("keeps the user on the form when they choose to stay", async () => {
    const { router, wrapper } = await mountInRouter();
    dirty(wrapper);
    await nextTick();

    router.push({ name: "music-quiz" });
    await flushPromises();
    await click(wrapper, "config-stay");

    expect(router.currentRoute.value.name).toBe("editprovider");
    expect(wrapper.findComponent(EditConfig).exists()).toBe(true);
  });

  // a discarded back has to stay a back, or the form the user just left would
  // sit in the history waiting for the next back press
  it("goes back rather than forward when a back press is discarded", async () => {
    const { router, wrapper } = await mountInRouter();
    dirty(wrapper);
    await nextTick();

    router.back();
    await flushPromises();
    await click(wrapper, "config-discard");
    expect(router.currentRoute.value.name).toBe("settings");

    router.back();
    await flushPromises();

    expect(router.currentRoute.value.name).toBe("players");
  });

  // the router runs the leave guards again for the route it redirects to
  it("asks only once when the page picked redirects elsewhere", async () => {
    const { router, wrapper } = await mountInRouter();
    dirty(wrapper);
    await nextTick();

    router.push({ name: "redirects-away" });
    await flushPromises();
    await click(wrapper, "config-discard");

    expect(router.currentRoute.value.name).toBe("music-quiz");
  });

  // a back press is how a phone dismisses a dialog, and the second one must not
  // leave the history a step away from the page on screen
  it("survives a back press on top of the dialog", async () => {
    const { router, wrapper } = await mountInRouter();
    dirty(wrapper);
    await nextTick();

    router.back();
    await flushPromises();
    router.back();
    await flushPromises();
    await click(wrapper, "config-stay");

    expect(router.currentRoute.value.name).toBe("editprovider");
    expect(router.options.history.location).toBe("/settings/provider");
  });

  it("lets an unchanged form go without asking", async () => {
    const { router, wrapper } = await mountInRouter();

    await router.push({ name: "music-quiz" });

    expect(router.currentRoute.value.name).toBe("music-quiz");
    expect(wrapper.find('[data-testid="config-discard"]').exists()).toBe(false);
  });
});

function entry(
  overrides: Partial<ConfigEntry> & { key: string; type: ConfigEntryType },
): ConfigEntry {
  return {
    category: "generic",
    default_value: null,
    label: overrides.key,
    required: false,
    options: [],
    value: null,
    ...overrides,
  };
}

function dependentEntry(
  overrides: Partial<ConfigEntry> & { key: string; type: ConfigEntryType },
): ConfigEntry {
  return entry({
    depends_on: "enable_feature",
    depends_on_value: true,
    ...overrides,
  });
}

function mountEntries(configEntries: ConfigEntry[], disabled = false) {
  return shallowMount(EditConfig, {
    props: { configEntries, disabled },
    global: { renderStubDefaultSlot: true },
  });
}

function renderedKeys(wrapper: VueWrapper) {
  return wrapper
    .findAllComponents({ name: "ConfigEntryRow" })
    .map((row) => (row.props("confEntry") as ConfigEntry).key);
}

// edits the first entry in place, which is what typing into its field does
function dirty(wrapper: VueWrapper) {
  const first = wrapper
    .findAllComponents({ name: "ConfigEntryRow" })[0]
    .props("confEntry") as ConfigEntry;
  first.value = "localhost";
}

function saveDisabled(wrapper: VueWrapper) {
  const button = wrapper.find('[data-testid="config-save"]');
  if (!button.exists()) throw new Error("save button not rendered");
  return button.attributes("disabled") === "true";
}

// the unsaved-changes guard only runs inside a routed view, so this mounts the
// form the way the settings screens do: as the component of the current route
async function mountInRouter() {
  const configEntries = [
    entry({ key: "server", type: ConfigEntryType.STRING }),
  ];
  const blank = { render: () => h("div") };
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/players", name: "players", component: blank },
      { path: "/settings", name: "settings", component: blank },
      {
        path: "/settings/provider",
        name: "editprovider",
        component: {
          render: () => h(EditConfig, { configEntries, disabled: false }),
        },
      },
      { path: "/music-quiz", name: "music-quiz", component: blank },
      // shaped like the plugin views, which send you away when disabled
      {
        path: "/redirects-away",
        name: "redirects-away",
        component: blank,
        beforeEnter: () => ({ name: "music-quiz" }),
      },
    ],
  });
  router.push({ name: "players" });
  await router.isReady();
  await router.push({ name: "settings" });
  await router.push({ name: "editprovider" });

  const wrapper = mount(
    { render: () => h(RouterView) },
    {
      global: {
        plugins: [router, createVuetify({ components, directives })],
        stubs: {
          ConfigEntryRow: true,
          ProtocolConfigSection: true,
          // the real dialog teleports into an overlay container this bare app
          // never mounts, so render it where it is declared instead
          VDialog: {
            props: ["modelValue"],
            template: '<div v-if="modelValue"><slot /></div>',
          },
        },
      },
    },
  );
  await flushPromises();
  return { router, wrapper };
}

// answering the dialog releases a navigation, so settle that too
async function click(wrapper: VueWrapper, testId: string) {
  await wrapper.get(`[data-testid="${testId}"]`).trigger("click");
  await flushPromises();
}
