// Which media items are being looked up before they can be opened, shared by
// every card and row so each can show progress on its own item.
import { reactive } from "vue";

const resolvingUris = reactive(new Set<string>());

/**
 * Follow which media items are being resolved, by uri.
 */
export function useResolvingItems() {
  return { isResolving, markResolving };
}

/**
 * Whether the item with this uri is being resolved.
 */
function isResolving(uri: string): boolean {
  return resolvingUris.has(uri);
}

/**
 * Mark the item with this uri as resolving until the task settles, and return
 * the task.
 */
function markResolving<T>(uri: string, task: Promise<T>): Promise<T> {
  resolvingUris.add(uri);
  return task.finally(() => resolvingUris.delete(uri));
}
