// Theme handling shared by the panel and options pages.
// Stored in chrome.storage.sync under "theme": { mode }.
// mode: "light" | "dark"

const DEFAULT_THEME = { mode: "light" };

// Older versions stored mode "system"; resolve it to a concrete choice.
function normalizeMode(mode) {
  if (mode === "system")
    return matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  return mode === "dark" ? "dark" : "light";
}

async function loadTheme() {
  const { theme } = await chrome.storage.sync.get("theme");
  const merged = { ...DEFAULT_THEME, ...theme };
  return { mode: normalizeMode(merged.mode) };
}

async function saveTheme(theme) {
  await chrome.storage.sync.set({ theme });
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = normalizeMode(theme.mode);
}

async function initTheme() {
  applyTheme(await loadTheme());
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.theme)
      applyTheme({ ...DEFAULT_THEME, ...changes.theme.newValue });
  });
}
