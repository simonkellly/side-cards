import { FLASHCARD_LINK_REGEX } from "@/constants";
import SideCards from "@/main";

export function registerFlashcardLinkPostprocessor(plugin: SideCards) {
  return plugin.registerMarkdownPostProcessor(createPostProcessor);
}

function createPostProcessor(element: HTMLElement) {
  if (!element.textContent?.includes('%!')) return;

  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    null
  );

  const textNodes: Node[] = [];
  let node: Node | null;
  while ((node = walker.nextNode()) !== null) {
    if (node.textContent?.includes('%!')) {
      textNodes.push(node);
    }
  }

  for (const node of textNodes) {
    const text = node.textContent;
    if (!text) continue;

    const temp = document.createElement('span');
    let lastIndex = 0;
    let match;

    const regex = new RegExp(FLASHCARD_LINK_REGEX.source, 'g');
    while ((match = regex.exec(text)) !== null) {
      const id = match[1];
      const start = match.index;
      const end = start + match[0].length;

      if (start > lastIndex) {
        temp.appendChild(document.createTextNode(text.substring(lastIndex, start)));
      }

      const span = document.createElement("span");
      span.textContent = "⚡️";
      span.className = "flashcard-link";

      span.addEventListener("click", () => {
        new Notice("Clicked on a flashcard link! (" + id + ")");
      });

      temp.appendChild(span);
      lastIndex = end;
    }

    if (lastIndex < text.length) {
      temp.appendChild(document.createTextNode(text.substring(lastIndex)));
    }

    node.parentNode?.replaceChild(temp, node);
  }
}