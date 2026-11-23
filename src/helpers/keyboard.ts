// webkit reports the keydown that commits an IME conversion with this keyCode
// instead of flagging it as composing
const IME_PROCESS_KEY_CODE = 229;

/**
 * Whether a keydown belongs to an IME composition, such as the Enter that
 * commits a conversion, rather than to the field itself.
 */
export const isImeComposition = (event: KeyboardEvent): boolean =>
  event.isComposing || event.keyCode === IME_PROCESS_KEY_CODE;
