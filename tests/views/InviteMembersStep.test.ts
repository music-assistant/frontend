import { HOMEASSISTANT_SYSTEM_USER } from "@/helpers/users";
import { UserRole } from "@/plugins/api/interfaces";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { user } from "../fixtures/user";

const { apiMock, authMock, preferenceState, users } = vi.hoisted(() => ({
  apiMock: {
    players: {} as Record<string, unknown>,
    providers: {} as Record<string, { name: string }>,
    providerManifests: {} as Record<string, { builtin: boolean }>,
    getAllUsers: vi.fn(),
    getProviderConfigs: vi.fn(async () => []),
    subscribe: vi.fn(() => vi.fn()),
    sendCommand: vi.fn(),
    serverInfo: { value: { onboard_done: false } },
  },
  authMock: { isAdmin: vi.fn(() => true) },
  // replaced with a real ref by the userPreferences mock factory below
  preferenceState: { intent: { value: undefined } as { value?: string } },
  // what the server hands back as the user accounts
  users: { list: [] as ReturnType<typeof user>[] },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));

vi.mock("@/plugins/auth", () => ({ authManager: authMock, default: authMock }));

vi.mock("@/plugins/router", () => ({
  default: { push: vi.fn(), replace: vi.fn() },
}));

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

vi.mock("vue-sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock("@/composables/userPreferences", async () => {
  const { ref } = await vi.importActual<typeof import("vue")>("vue");
  preferenceState.intent = ref<string | undefined>(undefined);
  return {
    setUserPreference: vi.fn(),
    useUserPreferences: () => ({ getPreference: () => preferenceState.intent }),
  };
});

/** A fresh step per test: the onboarding state lives for a whole session. */
async function mountStep({ load = true } = {}) {
  vi.resetModules();
  const onboarding = await import("@/composables/useOnboarding");
  if (load) await onboarding.useOnboarding().loadOnboardingData();
  const component =
    await import("@/components/onboarding/steps/InviteMembersStep.vue");
  const wrapper = mount(component.default, {
    global: {
      mocks: { $t: (key: string) => key },
      // covered where it lives; here it only has to be reachable
      stubs: { CreateUserDialog: true },
    },
  });
  await flushPromises();
  return wrapper;
}

function dialog(wrapper: Awaited<ReturnType<typeof mountStep>>) {
  return wrapper.findComponent({ name: "CreateUserDialog" });
}

function addButton(wrapper: Awaited<ReturnType<typeof mountStep>>) {
  return wrapper.find("[data-testid=onboarding-add-member]");
}

function members(wrapper: Awaited<ReturnType<typeof mountStep>>) {
  return wrapper.findAll("[data-testid=onboarding-household-member]");
}

beforeEach(() => {
  users.list = [
    user({ user_id: "admin-1", username: "admin", display_name: "Marcel" }),
  ];
  apiMock.getAllUsers.mockReset();
  apiMock.getAllUsers.mockImplementation(async () => [...users.list]);
  authMock.isAdmin.mockReturnValue(true);
});

describe("InviteMembersStep", () => {
  it("lists the people who live here, and nobody else", async () => {
    users.list = [
      user({ user_id: "admin-1", username: "admin", display_name: "Marcel" }),
      user({ user_id: "sam-1", username: "sam", role: UserRole.ADMIN }),
      user({
        user_id: "ha-1",
        username: HOMEASSISTANT_SYSTEM_USER,
        role: UserRole.SERVICE,
      }),
      user({ user_id: "guest-1", username: "guest", role: UserRole.GUEST }),
    ];

    const wrapper = await mountStep();

    const listed = members(wrapper);
    expect(listed).toHaveLength(2);
    expect(listed[0].text()).toContain("Marcel");
    expect(listed[0].text()).toContain("auth.user_role");
    // no display name of their own: the username stands in for it
    expect(listed[1].text()).toContain("sam");
    expect(listed[1].text()).toContain("auth.admin_role");
    expect(wrapper.text()).not.toContain(HOMEASSISTANT_SYSTEM_USER);
    expect(wrapper.text()).not.toContain("auth.guest_role");

    wrapper.unmount();
  });

  it("says so while the household is still only the admin setting it up", async () => {
    const wrapper = await mountStep();

    expect(members(wrapper)).toHaveLength(1);
    expect(wrapper.find("[data-testid=onboarding-only-you]").exists()).toBe(
      true,
    );

    wrapper.unmount();
  });

  it("claims nothing about a household it has not been told about", async () => {
    const wrapper = await mountStep({ load: false });

    expect(members(wrapper)).toHaveLength(0);
    expect(wrapper.find("[data-testid=onboarding-only-you]").exists()).toBe(
      false,
    );

    wrapper.unmount();
  });

  it("opens the create user dialog and takes the new member on", async () => {
    const wrapper = await mountStep();
    expect(dialog(wrapper).props("modelValue")).toBe(false);

    await addButton(wrapper).trigger("click");

    expect(dialog(wrapper).props("modelValue")).toBe(true);

    users.list.push(
      user({ user_id: "sam-1", username: "sam", display_name: "Sam" }),
    );
    dialog(wrapper).vm.$emit("created");
    await flushPromises();

    expect(apiMock.getAllUsers).toHaveBeenCalledTimes(2);
    expect(members(wrapper)).toHaveLength(2);
    expect(wrapper.text()).toContain("Sam");

    wrapper.unmount();
  });

  // the primary action while the household is only the admin who is setting it
  // up, and a quieter one once there is a household to add to
  it.each([
    [1, "bg-primary", "bg-accent"],
    [2, "bg-accent", "bg-primary"],
  ])(
    "carries the emphasis a household of %i calls for",
    async (memberCount, emphasis, demoted) => {
      users.list = Array.from({ length: memberCount }, (_, index) =>
        user({ user_id: `member-${index}`, username: `member-${index}` }),
      );

      const wrapper = await mountStep();

      expect(addButton(wrapper).classes()).toContain(emphasis);
      expect(addButton(wrapper).classes()).not.toContain(demoted);

      wrapper.unmount();
    },
  );
});
