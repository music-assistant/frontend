import { HOMEASSISTANT_SYSTEM_USER } from "@/helpers/users";
import { UserRole } from "@/plugins/api/interfaces";
import UserManagement from "@/views/settings/UserManagement.vue";
import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { user } from "../fixtures/user";

const { apiMock, routeMock, routerMock, storeMock } = vi.hoisted(() => ({
  apiMock: { getAllUsers: vi.fn() },
  routeMock: { query: {} as Record<string, string> },
  routerMock: { push: vi.fn(), replace: vi.fn() },
  storeMock: { currentUser: { user_id: "admin-1" } },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock }));

vi.mock("@/plugins/store", () => ({ store: storeMock }));

vi.mock("vue-sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("vue-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-router")>()),
  useRoute: () => routeMock,
  useRouter: () => routerMock,
}));

vi.mock("vue-i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-i18n")>()),
  useI18n: () => ({ t: (key: string) => key }),
}));

function mountView() {
  return mount(UserManagement, {
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        // covered by their own tests; here they only add noise if mounted for real
        CreateUserDialog: true,
        EditUserDialog: true,
        DisableUserDialog: true,
        DeleteUserDialog: true,
        ManageTokensDialog: true,
        RevokeTokenDialog: true,
        // the menu is opened with pointer interaction jsdom can't drive, and
        // this test never needs it open
        DropdownMenu: true,
        DropdownMenuContent: true,
        DropdownMenuItem: true,
        DropdownMenuSeparator: true,
        DropdownMenuTrigger: true,
      },
    },
  });
}

describe("UserManagement", () => {
  it("shows the System badge only on the Home Assistant account's card", async () => {
    apiMock.getAllUsers.mockResolvedValue([
      user({
        user_id: "ha",
        username: HOMEASSISTANT_SYSTEM_USER,
        role: UserRole.SERVICE,
        display_name: "Home Assistant Integration",
      }),
      user({ user_id: "marcel", username: "marcel", display_name: "Marcel" }),
    ]);

    const wrapper = mountView();
    await flushPromises();

    const cards = wrapper.findAll('[data-slot="card"]');
    expect(cards).toHaveLength(2);
    expect(cards[0].text()).toContain("auth.system_user");
    expect(cards[1].text()).not.toContain("auth.system_user");
  });
});
