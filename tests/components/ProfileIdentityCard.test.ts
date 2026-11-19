import ProfileIdentityCard from "@/components/profile/ProfileIdentityCard.vue";
import { type Role, type User, UserRole } from "@/plugins/api/interfaces";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { user } from "../fixtures/user";

const { authManagerMock, storeMock } = vi.hoisted(() => ({
  authManagerMock: { logout: vi.fn() },
  storeMock: {
    currentUser: undefined as User | undefined,
    isIngressSession: false,
    roles: [] as Role[],
  },
}));

vi.mock("@/plugins/auth", () => ({ authManager: authManagerMock }));
vi.mock("@/plugins/store", () => ({ store: storeMock }));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

// the dialog is covered where it lives
const EditProfileDialogStub = {
  name: "EditProfileDialog",
  props: ["open"],
  emits: ["update:open"],
  template: "<div />",
};

enableAutoUnmount(afterEach);

function mountCard() {
  return mount(ProfileIdentityCard, {
    global: {
      mocks: { $t: (key: string) => key },
      stubs: { EditProfileDialog: EditProfileDialogStub },
    },
  });
}

describe("ProfileIdentityCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeMock.isIngressSession = false;
    storeMock.currentUser = user({
      username: "sam",
      display_name: "Sam",
      role: UserRole.ADMIN,
    });
  });

  it("shows the name and the role of the signed-in user", () => {
    const wrapper = mountCard();

    expect(wrapper.get("h2").text()).toBe("Sam");
    expect(wrapper.get("p").text()).toBe("auth.admin_role");
  });

  it("names a user without a display name by the username", () => {
    storeMock.currentUser = user({ username: "sam", display_name: null });

    expect(mountCard().get("h2").text()).toBe("sam");
  });

  it("opens the account form in a dialog", async () => {
    const wrapper = mountCard();
    const dialog = wrapper.getComponent(EditProfileDialogStub);

    expect(dialog.props("open")).toBe(false);

    await wrapper.get('[data-testid="profile-edit"]').trigger("click");

    expect(dialog.props("open")).toBe(true);
  });

  it("signs the user out", async () => {
    const wrapper = mountCard();

    await wrapper.get('[data-testid="profile-sign-out"]').trigger("click");

    expect(authManagerMock.logout).toHaveBeenCalledOnce();
  });

  it("leaves the account and the sign-in to Home Assistant in an ingress session", () => {
    storeMock.isIngressSession = true;

    const wrapper = mountCard();

    expect(wrapper.get("h2").text()).toBe("Sam");
    expect(wrapper.find('[data-testid="profile-edit"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="profile-sign-out"]').exists()).toBe(
      false,
    );
    expect(wrapper.findComponent(EditProfileDialogStub).exists()).toBe(false);
  });
});
