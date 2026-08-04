// Theme handling shared by the panel and options pages.
// Stored in chrome.storage.sync under "theme": { mode, accent }.
// mode: "system" | "light" | "dark"    accent: see ACCENTS.

const ACCENTS = ["indigo", "violet", "emerald", "rose", "amber"];
const DEFAULT_THEME = { mode: "system", accent: "indigo" };

async function loadTheme() {
  const { theme } = await chrome.storage.sync.get("theme");
  return { ...DEFAULT_THEME, ...theme };
}

async function saveTheme(theme) {
  await chrome.storage.sync.set({ theme });
}

function applyTheme(theme) {
  const systemDark = matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = theme.mode === "dark" || (theme.mode === "system" && systemDark);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.dataset.accent = theme.accent;
}

async function initTheme() {
  applyTheme(await loadTheme());
  matchMedia("(prefers-color-scheme: dark)").addEventListener(
    "change",
    async () => applyTheme(await loadTheme())
  );
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.theme)
      applyTheme({ ...DEFAULT_THEME, ...changes.theme.newValue });
  });
}
