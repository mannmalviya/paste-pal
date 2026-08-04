importScripts("store.js");

// Toolbar icon opens the side panel.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.runtime.onInstalled.addListener(async () => {
  await seedIfEmpty();
  await migrate();
  buildMenus();
});

// One-shot additions for installs that predate newer seed entries.
async function migrate() {
  const { seedVersion } = await chrome.storage.sync.get("seedVersion");
  if ((seedVersion ?? 1) < 2) {
    const entries = await loadEntries();
    if (!entries.some((e) => /^x\b|twitter/i.test(e.label.trim()))) {
      await saveEntry({
        id: newId(),
        label: "X",
        value: "",
        pinned: true,
        order: entries.length,
      });
    }
    await chrome.storage.sync.set({ seedVersion: 2 });
  }
}
chrome.runtime.onStartup.addListener(buildMenus);

// ---------- context menus ----------
//
//   Paste Pal
//     Fill with        ▸  (pinned entries with a value; editable fields only)
//     Attach resume    ▸  (imported resumes; anywhere)

let menuBuild = Promise.resolve();

function buildMenus() {
  // Serialize rebuilds; storage.onChanged can fire in bursts.
  menuBuild = menuBuild.then(async () => {
    await chrome.contextMenus.removeAll();

    const [entries, resumes] = await Promise.all([loadEntries(), loadResumes()]);
    const favorites = entries.filter((e) => e.pinned && e.value.trim());
    if (favorites.length === 0 && resumes.length === 0) return;

    chrome.contextMenus.create({
      id: "root",
      title: "Paste Pal",
      contexts: ["all"],
    });

    if (favorites.length > 0) {
      chrome.contextMenus.create({
        id: "fill-root",
        parentId: "root",
        title: "Fill with",
        contexts: ["editable"],
      });
      for (const entry of favorites) {
        chrome.contextMenus.create({
          id: "fill:" + entry.id,
          parentId: "fill-root",
          title: entry.label,
          contexts: ["editable"],
        });
      }
    }

    if (resumes.length > 0) {
      chrome.contextMenus.create({
        id: "attach-root",
        parentId: "root",
        title: "Attach resume",
        contexts: ["all"],
      });
      for (const resume of resumes) {
        chrome.contextMenus.create({
          id: "attach:" + resume.id,
          parentId: "attach-root",
          title: resume.label,
          contexts: ["all"],
        });
      }
    }
  });
  return menuBuild;
}

let rebuildTimer;
chrome.storage.onChanged.addListener(() => {
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(buildMenus, 300);
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;
  const [kind, id] = String(info.menuItemId).split(":");
  const target = { frameId: info.frameId ?? 0 };

  if (kind === "fill") {
    const entries = await loadEntries();
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;
    chrome.tabs.sendMessage(
      tab.id,
      { type: "fill", value: entry.value },
      target
    );
  } else if (kind === "attach") {
    // The content script reads the resume out of chrome.storage.local
    // itself; no need to push megabytes through a message.
    chrome.tabs.sendMessage(tab.id, { type: "attach", resumeId: id }, target);
  }
});
