const runCopyAsMarkdownLink = (tabId) => {
  chrome.scripting
    .executeScript({
      target: { tabId },
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
};

chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== "copy-as-markdown-link") return;
  if (!tab?.id) return;
  runCopyAsMarkdownLink(tab.id);
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "copy-as-markdown-link",
      title: "Copy as Markdown link",
      contexts: ["selection"],
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "copy-as-markdown-link") return;
  if (!tab?.id) return;
  runCopyAsMarkdownLink(tab.id);
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

  // small popup in the bottom-right of the page so a successful (or failed)
  // copy isn't silent
  const showToast = (message, good) => {
    const toast = document.createElement("div");
    toast.textContent = message;
    Object.assign(toast.style, {
      position: "fixed",
      bottom: "16px",
      right: "16px",
      padding: "8px 14px",
      borderRadius: "8px",
      background: good ? "#1f7a37" : "#b3261e",
      color: "#fff",
      font: "13px/1.4 system-ui, sans-serif",
      boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
      opacity: "0",
      transition: "opacity 150ms ease",
      pointerEvents: "none",
      zIndex: "2147483647",
    });
    document.body.appendChild(toast);
    requestAnimationFrame(() => (toast.style.opacity = "1"));
    setTimeout(() => (toast.style.opacity = "0"), 1400);
    setTimeout(() => toast.remove(), 1700);
  };

  // navigator.clipboard rejects when the page isn't focused or the context
  // isn't secure, and the rejection surfaces only in the page console — so
  // always try it, then fall back to execCommand and report either way.
  return (async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      showToast("Copied as markdown link ✓", true);
      return "ok";
    } catch {
      if (fallbackCopy(markdown)) {
        showToast("Copied as markdown link ✓", true);
        return "ok (fallback)";
      }
      showToast("Copy failed — see console", false);
      return FAIL("both clipboard.writeText and execCommand('copy') failed — see page console");
    }
  })();
}
