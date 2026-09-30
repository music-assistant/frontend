import {
  type NetworkShareFormOptions,
  useNetworkShareForm,
} from "@/composables/useNetworkShareForm";
import type { MusicAssistantApi } from "@/plugins/api";
import { ApiCommandError } from "@/plugins/api/errors";
import { ShareType } from "@/plugins/api/interfaces";
import { flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type EffectScope, effectScope, nextTick, reactive } from "vue";
import { managedShare } from "../fixtures/storage";

const { apiMock, toastMock } = vi.hoisted(() => ({
  apiMock: {
    addNetworkShare: vi.fn<MusicAssistantApi["addNetworkShare"]>(),
    updateNetworkShare: vi.fn<MusicAssistantApi["updateNetworkShare"]>(),
  },
  toastMock: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
  canonicalizeLocale: (locale: string) => locale,
}));
vi.mock("vue-sonner", () => ({ toast: toastMock }));

const share = managedShare();
let scope: EffectScope | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.addNetworkShare.mockResolvedValue(share);
  apiMock.updateNetworkShare.mockResolvedValue(share);
});

afterEach(() => {
  scope?.stop();
  scope = undefined;
});

describe("useNetworkShareForm", () => {
  it("starts a new share empty, on the first type the install can mount", () => {
    const { shareForm } = openForm({ shareTypes: [ShareType.NFS] });

    expect(shareForm.form.value).toMatchObject({
      shareType: ShareType.NFS,
      server: "",
      share: "",
      version: null,
    });
    expect(shareForm.showAdvanced.value).toBe(false);
    expect(shareForm.shareTypeChoices.value).toEqual([ShareType.NFS]);
  });

  it("offers the versions the install can honour for the chosen share type", () => {
    const { shareForm } = openForm();

    expect(shareForm.versionChoices.value).toEqual(["1.0", "2.0"]);

    shareForm.form.value.version = "2.0";
    shareForm.setShareType(ShareType.NFS);

    expect(shareForm.versionChoices.value).toEqual([]);
    // a version of the other share type does not carry over
    expect(shareForm.form.value.version).toBeNull();
  });

  it("starts an edit from the share, its type fixed and a chosen version shown", () => {
    const { shareForm } = openForm({
      location: managedShare({ version: "2.0" }),
    });

    expect(shareForm.form.value).toMatchObject({
      server: "nas.local",
      share: "music",
      username: "marcel",
      password: "",
      version: "2.0",
    });
    expect(shareForm.showAdvanced.value).toBe(true);
    expect(shareForm.shareTypeChoices.value).toEqual([ShareType.CIFS]);
  });

  it("reads a stored version the install can not honour as automatic, and saves it so", async () => {
    const { shareForm } = openForm({
      location: managedShare({ version: "3.0" }),
    });

    expect(shareForm.form.value.version).toBeNull();
    expect(shareForm.showAdvanced.value).toBe(false);

    expect(await shareForm.save()).toBe("saved");
    expect(apiMock.updateNetworkShare).toHaveBeenCalledWith(
      "nas_music",
      expect.objectContaining({ version: null }),
    );
  });

  it("flags the missing server and share instead of saving", async () => {
    const { shareForm } = openForm();

    expect(shareForm.serverInvalid.value).toBe(false);
    expect(await shareForm.save()).toBe("invalid");

    expect(shareForm.serverInvalid.value).toBe(true);
    expect(shareForm.shareInvalid.value).toBe(true);
    expect(apiMock.addNetworkShare).not.toHaveBeenCalled();
  });

  it("adds a new share", async () => {
    const { shareForm } = openForm();
    shareForm.form.value.server = "nas.local";
    shareForm.form.value.share = "music";

    expect(await shareForm.save()).toBe("saved");

    expect(apiMock.addNetworkShare).toHaveBeenCalledWith(ShareType.CIFS, {
      server: "nas.local",
      share: "music",
      username: null,
      version: null,
      read_only: false,
    });
    expect(toastMock.success).toHaveBeenCalledWith(
      "settings.storage.share_added",
    );
    expect(shareForm.saving.value).toBe(false);
  });

  it("offers the next step in the toast of a share it added", async () => {
    const onClick = vi.fn();
    const addedAction = vi.fn(() => ({
      label: "Use as music source",
      onClick,
    }));
    const { shareForm } = openForm({ addedAction });
    shareForm.form.value.server = "nas.local";
    shareForm.form.value.share = "music";

    await shareForm.save();

    expect(addedAction).toHaveBeenCalledWith(share);
    expect(toastMock.success).toHaveBeenCalledWith(
      "settings.storage.share_added",
      { action: { label: "Use as music source", onClick } },
    );
  });

  it("has nothing to save for an untouched share", async () => {
    const { shareForm } = openForm({ location: share });

    expect(await shareForm.save()).toBe("unchanged");

    expect(apiMock.updateNetworkShare).not.toHaveBeenCalled();
  });

  it("keeps the server's reason when saving failed", async () => {
    const reason = "The server name could not be found.";
    apiMock.updateNetworkShare.mockRejectedValue(
      new ApiCommandError(reason, 1, reason),
    );
    const { shareForm } = openForm({ location: share });
    shareForm.form.value.server = "nas.lcoal";

    expect(await shareForm.save()).toBe("failed");

    expect(shareForm.error.value).toBe(reason);
    expect(shareForm.saving.value).toBe(false);
  });

  it("starts over when opened again", async () => {
    const { options, shareForm } = openForm();
    await shareForm.save();
    shareForm.form.value.server = "nas.local";

    options.open = false;
    await nextTick();
    options.open = true;
    await flushPromises();

    expect(shareForm.form.value.server).toBe("");
    expect(shareForm.serverInvalid.value).toBe(false);
  });
});

function openForm(overrides: Partial<NetworkShareFormOptions> = {}) {
  const options = reactive<NetworkShareFormOptions>({
    open: true,
    location: null,
    shareTypes: [ShareType.CIFS, ShareType.NFS],
    shareVersions: {
      [ShareType.CIFS]: ["1.0", "2.0"],
      [ShareType.NFS]: [],
    },
    ...overrides,
  });
  scope = effectScope();
  const shareForm = scope.run(() => useNetworkShareForm(options))!;
  return { options, shareForm };
}
