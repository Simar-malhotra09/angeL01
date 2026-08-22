chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== "copy-as-markdown-link") return;
  if (!tab?.id) return;

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: copyAsMarkdownLink,
  });
});

function copyAsMarkdownLink() {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return;

  const text = selection.toString().trim();
  if (!text) return;

  const nodeToElement = (node) =>
    node && (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement);

  const anchorLink = nodeToElement(selection.anchorNode)?.closest("a[href]");
  const focusLink = nodeToElement(selection.focusNode)?.closest("a[href]");
  const link = anchorLink?.href || focusLink?.href || window.location.href;

  const escapedText = text.replace(/([[\]])/g, "\\$1");
  navigator.clipboard.writeText(`[${escapedText}](${link})`);
}
