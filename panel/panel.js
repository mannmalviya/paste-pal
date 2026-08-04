const searchEl = document.getElementById("search");
const entriesEl = document.getElementById("entries");
const resumesEl = document.getElementById("resumes");
const resumesSection = document.getElementById("resumes-section");
const emptyEl = document.getElementById("empty");

let entries = [];
let resumes = [];

function matches(entry, q) {
  return (
    entry.label.toLowerCase().includes(q) ||
    entry.value.toLowerCase().includes(q)
  );
}

function render() {
  const q = searchEl.value.trim().toLowerCase();
  const visible = q ? entries.filter((e) => matches(e, q)) : entries;

  entriesEl.replaceChildren(
    ...visible.map((entry) => {
      const li = document.createElement("li");
      li.className = "entry";
      li.title = "Click to copy";

      const label = document.createElement("div");
      label.className = "label";
      if (entry.pinned) {
        const pin = document.createElement("span");
        pin.className = "pin";
        pin.textContent = "★";
        label.append(pin);
      }
      label.append(entry.label);

      const preview = document.createElement("div");
      preview.className = "preview";
      const firstLine = entry.value.split("\n", 1)[0];
      preview.textContent = firstLine || "—";

      li.append(label, preview);
      li.addEventListener("click", () => copyEntry(entry, li, label));
      return li;
    })
  );

  emptyEl.hidden = entries.length > 0;

  resumesSection.hidden = resumes.length === 0;
  resumesEl.replaceChildren(
    ...resumes.map((r) => {
      const li = document.createElement("li");
      li.className = "resume";
      const label = document.createElement("div");
      label.className = "label";
      label.textContent = r.label;
      const file = document.createElement("div");
      file.className = "filename";
      file.textContent = r.filename;
      li.append(label, file);
      return li;
    })
  );
}

async function copyEntry(entry, li, labelEl) {
  await navigator.clipboard.writeText(entry.value);
  li.classList.add("copied");
  const tag = document.createElement("span");
  tag.className = "copied-tag";
  tag.textContent = "copied";
  labelEl.append(tag);
  setTimeout(() => {
    li.classList.remove("copied");
    tag.remove();
  }, 900);
}

async function refresh() {
  [entries, resumes] = await Promise.all([loadEntries(), loadResumes()]);
  render();
}

searchEl.addEventListener("input", render);
for (const id of ["settings", "empty-settings"]) {
  document
    .getElementById(id)
    .addEventListener("click", () => chrome.runtime.openOptionsPage());
}
chrome.storage.onChanged.addListener(refresh);

refresh();
