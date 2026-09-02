chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== "copy-as-markdown-link") return;
  if (!tab?.id) return;

  chrome.scripting
    .executeScript({
      target: { tabId: tab.id },
      func: copyAsMarkdownLink,
    })
    .then((results) => {
      const result = results?.[0]?.result;
      if (result?.startsWith("FAIL")) console.error("md-link-copy:", result);
    })
    .catch((err) => {
      console.error(
        "md-link-copy: cannot run on this page (chrome://, Web Store, PDF viewer, etc.):",
        err.message
      );
    });
});

function copyAsMarkdownLink() {
  const FAIL = (msg) => {
    console.error(`md-link-copy: ${msg}`);
    return `FAIL ${msg}`;
  };

  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return FAIL("no text selected");

  const text = selection.toString().trim();
  if (!text) return FAIL("selection was empty");

  const nodeToElement = (node) =>
    node && (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement);

  const anchorLink = nodeToElement(selection.anchorNode)?.closest("a[href]");
  const focusLink = nodeToElement(selection.focusNode)?.closest("a[href]");
  const link = anchorLink?.href || focusLink?.href || window.location.href;

  const escapedText = text.replace(/([[\]])/g, "\\$1");
  const markdown = `[${escapedText}](${link})`;

  const fallbackCopy = (str) => {
    const ta = document.createElement("textarea");
    ta.value = str;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } finally {
      ta.remove();
    }
    return ok;
  };

  // navigator.clipboard rejects when the page isn't focused or the context
  // isn't secure, and the rejection surfaces only in the page console — so
  // always try it, then fall back to execCommand and report either way.
  return (async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      return "ok";
    } catch {
      if (fallbackCopy(markdown)) return "ok (fallback)";
      return FAIL("both clipboard.writeText and execCommand('copy') failed — see page console");
    }
  })();
}
