import { Comment, Fragment, Text, type VNode } from "vue";

/**
 * Whether rendered nodes show anything, as a filled slot does: an element, a
 * component or text. A slot whose content is left out by a `v-if` renders
 * only a comment.
 *
 * @param nodes - The nodes a slot rendered.
 */
export function hasVNodeContent(nodes: readonly VNode[]): boolean {
  return nodes.some((node) => {
    if (node.type === Comment) return false;
    if (node.type === Text) return String(node.children).trim() !== "";
    if (node.type === Fragment) {
      return (
        Array.isArray(node.children) &&
        hasVNodeContent(node.children as VNode[])
      );
    }
    return true;
  });
}
