import { ref } from "vue";

type AvatarSaveHandler = (avatarUrl: string) => void | Promise<void>;

const avatarEditorOpen = ref(false);
const avatarEditorValue = ref<string | null>(null);
const avatarEditorError = ref<string | null>(null);
let saveHandler: AvatarSaveHandler | null = null;

export function useProfileAvatarEditor() {
  const openAvatarEditor = (
    avatarUrl: string | null | undefined,
    onSave: AvatarSaveHandler,
  ) => {
    avatarEditorValue.value = avatarUrl || "";
    avatarEditorError.value = null;
    saveHandler = onSave;
    avatarEditorOpen.value = true;
  };

  const closeAvatarEditor = () => {
    avatarEditorOpen.value = false;
    saveHandler = null;
  };

  const saveAvatar = async (avatarUrl: string) => {
    const handler = saveHandler;
    if (!handler) {
      closeAvatarEditor();
      return;
    }

    avatarEditorError.value = null;
    try {
      await handler(avatarUrl);
      closeAvatarEditor();
    } catch (error) {
      avatarEditorError.value =
        error instanceof Error ? error.message : String(error);
    }
  };

  return {
    avatarEditorOpen,
    avatarEditorError,
    avatarEditorValue,
    closeAvatarEditor,
    openAvatarEditor,
    saveAvatar,
  };
}
