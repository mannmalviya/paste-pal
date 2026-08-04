const entriesEl = document.getElementById("entries");
const resumesEl = document.getElementById("resumes");
const resumesSection = document.getElementById("resumes-section");
const emptyEl = document.getElementById("empty");

let entries = [];
let resumes = [];

function iconTile(html) {
  const tile = document.createElement("div");
  tile.className = "icon-tile";
  tile.innerHTML = html; // static SVG strings from icons.js, never user data
  return tile;
}

// Phone numbers get a second, derived row with plain dashed formatting
// (831-555-0142) since forms are picky about which style they want.
function dashedPhone(entry) {
  if (!/phone|mobile/i.test(entry.label)) return null;
  let digits = entry.value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (digits.length !== 10) return null;
  const dashed = `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (dashed === entry.value.trim()) return null;
  return {
    ...entry,
    id: entry.id + ":dashed",
    label: entry.label + " (dashes)",
    value: dashed,
  };
}

function displayEntries() {
  const out = [];
  for (const e of entries) {
    out.push(e);
    const d = dashedPhone(e);
    if (d) out.push(d);
  }
  return out;
}

function render() {
  const visible = displayEntries();

  entriesEl.replaceChildren(
    ...visible.map((entry) => {
      const li = document.createElement("li");
      li.className = "entry";
      li.title = "Click to copy";

      const tile = iconTile(iconFor(entry.label));

      const text = document.createElement("div");
      text.className = "entry-text";

      const label = document.createElement("div");
      label.className = "label";
      label.append(entry.label);

      const preview = document.createElement("div");
      preview.className = "preview";
      const firstLine = entry.value.split("\n", 1)[0];
      if (firstLine) {
        preview.textContent = firstLine;
      } else {
        preview.textContent = "not filled in yet";
        preview.classList.add("unset");
      }

      text.append(label, preview);
      li.append(tile, text);
      li.addEventListener("click", () => copyEntry(entry, li, label, tile));
      return li;
    })
  );

  emptyEl.hidden = entries.length > 0;

  resumesSection.hidden = resumes.length === 0;
  resumesEl.replaceChildren(
    ...resumes.map((r) => {
      const li = document.createElement("li");
      li.className = "resume";
      const tile = iconTile(ICONS.file);
      const text = document.createElement("div");
      text.className = "entry-text";
      const label = document.createElement("div");
      label.className = "label";
      label.textContent = r.label;
      const file = document.createElement("div");
      file.className = "filename";
      file.textContent = r.filename;
      text.append(label, file);
      li.append(tile, text);
      return li;
    })
  );
}

async function copyEntry(entry, li, labelEl, tile) {
  await navigator.clipboard.writeText(entry.value);
  const { autoPaste } = await chrome.storage.sync.get("autoPaste");
  if (autoPaste && entry.value) {
    await chrome.storage.local.set({
      armed: {
        value: entry.value,
        label: entry.label,
        exp: Date.now() + 30_000,
      },
    });
  }
  li.classList.add("copied");
  tile.classList.add("success");
  const prevIcon = tile.innerHTML;
  tile.innerHTML = ICONS.check;
  const tag = document.createElement("span");
  tag.className = "copied-tag";
  tag.textContent = "Copied";
  labelEl.append(tag);
  setTimeout(() => {
    li.classList.remove("copied");
    tile.classList.remove("success");
    tile.innerHTML = prevIcon;
    tag.remove();
  }, 900);
}

const armedBar = document.getElementById("armed-bar");
const armedText = document.getElementById("armed-text");
let armedTimer;

async function renderArmed() {
  const { armed } = await chrome.storage.local.get("armed");
  const active = armed && Date.now() < armed.exp;
  armedBar.hidden = !active;
  clearTimeout(armedTimer);
  if (active) {
    armedText.textContent = `Click a field on the page to paste ${armed.label}`;
    armedTimer = setTimeout(renderArmed, armed.exp - Date.now());
  }
}

document
  .getElementById("disarm")
  .addEventListener("click", () => chrome.storage.local.remove("armed"));

async function refresh() {
  [entries, resumes] = await Promise.all([loadEntries(), loadResumes()]);
  render();
  renderArmed();
}

for (const id of ["settings", "empty-settings"]) {
  document
    .getElementById(id)
    .addEventListener("click", () => chrome.runtime.openOptionsPage());
}
chrome.storage.onChanged.addListener((changes, area) => {
  // Only rebuild the list when entries or resumes actually change.
  // Rebuilding on every key (theme, armed, ...) would destroy the row
  // mid-"Copied" animation, since arming writes storage on copy.
  if (area === "local" && "armed" in changes) renderArmed();
  const dataChanged = Object.keys(changes).some(
    (k) => k.startsWith("e_") || k.startsWith("r_")
  );
  if (dataChanged) refresh();
});

initTheme();
refresh();
