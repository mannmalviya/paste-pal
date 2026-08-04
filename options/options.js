const entriesEl = document.getElementById("entries");
const resumesEl = document.getElementById("resumes");

let entries = [];
let resumes = [];
let dragId = null;

// ---------- appearance ----------

const SWATCH_COLORS = {
  indigo: "#4f46e5",
  violet: "#7c3aed",
  emerald: "#059669",
  rose: "#e11d48",
  amber: "#d97706",
};

async function initAppearance() {
  const theme = await loadTheme();

  const modeButtons = [...document.querySelectorAll("#mode-picker button")];
  const renderMode = () =>
    modeButtons.forEach((b) =>
      b.classList.toggle("active", b.dataset.mode === theme.mode)
    );
  modeButtons.forEach((b) =>
    b.addEventListener("click", async () => {
      theme.mode = b.dataset.mode;
      renderMode();
      applyTheme(theme);
      await saveTheme(theme);
    })
  );
  renderMode();

  const picker = document.getElementById("accent-picker");
  const swatches = ACCENTS.map((name) => {
    const b = document.createElement("button");
    b.className = "swatch";
    b.style.background = SWATCH_COLORS[name];
    b.title = name[0].toUpperCase() + name.slice(1);
    b.addEventListener("click", async () => {
      theme.accent = name;
      swatches.forEach((s) => s.classList.toggle("active", s === b));
      applyTheme(theme);
      await saveTheme(theme);
    });
    return b;
  });
  const renderAccent = () =>
    swatches.forEach((s, i) =>
      s.classList.toggle("active", ACCENTS[i] === theme.accent)
    );
  renderAccent();
  picker.replaceChildren(...swatches);

  // Keep the pickers in sync when the theme changes elsewhere
  // (another window, or synced in from another machine).
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" || !changes.theme) return;
    Object.assign(theme, DEFAULT_THEME, changes.theme.newValue);
    renderMode();
    renderAccent();
  });
}

// ---------- behavior ----------

const autoPasteEl = document.getElementById("auto-paste");
chrome.storage.sync
  .get("autoPaste")
  .then(({ autoPaste }) => (autoPasteEl.checked = !!autoPaste));
autoPasteEl.addEventListener("change", () =>
  chrome.storage.sync.set({ autoPaste: autoPasteEl.checked })
);

// ---------- entries ----------

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function iconTile(html) {
  const tile = document.createElement("div");
  tile.className = "icon-tile";
  tile.innerHTML = html; // static SVG strings from icons.js, never user data
  return tile;
}

function renderEntries() {
  entriesEl.replaceChildren(...entries.map(entryRow));
}

function entryRow(entry) {
  const li = document.createElement("li");
  li.className = "entry";
  li.dataset.id = entry.id;

  const handle = document.createElement("div");
  handle.className = "handle";
  handle.textContent = "⠿";
  handle.title = "Drag to reorder";
  handle.draggable = true;
  handle.addEventListener("dragstart", (e) => {
    dragId = entry.id;
    e.dataTransfer.effectAllowed = "move";
  });

  li.addEventListener("dragover", (e) => {
    e.preventDefault();
    li.classList.add("drag-over");
  });
  li.addEventListener("dragleave", () => li.classList.remove("drag-over"));
  li.addEventListener("drop", (e) => {
    e.preventDefault();
    li.classList.remove("drag-over");
    reorder(dragId, entry.id);
  });

  const tile = iconTile(iconFor(entry.label));

  const label = document.createElement("input");
  label.className = "label";
  label.value = entry.label;
  label.placeholder = "Label";

  const value = document.createElement("textarea");
  value.className = "value";
  value.value = entry.value;
  value.placeholder = "Value (can be several paragraphs)";
  value.rows = Math.min(6, Math.max(1, entry.value.split("\n").length));

  const warning = document.createElement("div");
  warning.className = "size-warning";
  warning.hidden = true;

  const save = debounce(async () => {
    entry.label = label.value;
    entry.value = value.value;
    tile.innerHTML = iconFor(entry.label);
    const tooBig = entrySyncSize(entry) > SYNC_ITEM_LIMIT;
    warning.hidden = !tooBig;
    if (tooBig) {
      warning.textContent =
        "Too long to sync (8KB max per entry), so it was not saved. Trim it down.";
      return;
    }
    await saveEntry(entry);
  }, 400);
  label.addEventListener("input", save);
  value.addEventListener("input", save);

  const pin = document.createElement("button");
  pin.className = "pin-btn" + (entry.pinned ? " pinned" : "");
  pin.textContent = "★";
  pin.title = entry.pinned
    ? "Pinned: shows in the right-click Fill menu"
    : "Pin to the right-click Fill menu";
  pin.addEventListener("click", async () => {
    entry.pinned = !entry.pinned;
    pin.classList.toggle("pinned", entry.pinned);
    await saveEntry(entry);
  });

  const del = document.createElement("button");
  del.className = "delete-btn";
  del.textContent = "✕";
  del.title = "Delete entry";
  del.addEventListener("click", async () => {
    if (!confirm(`Delete "${entry.label}"?`)) return;
    await deleteEntry(entry.id);
    entries = entries.filter((e) => e.id !== entry.id);
    renderEntries();
  });

  li.append(handle, tile, label, value, pin, del);
  li.append(warning);
  return li;
}

async function reorder(fromId, toId) {
  if (!fromId || fromId === toId) return;
  const fromIdx = entries.findIndex((e) => e.id === fromId);
  const toIdx = entries.findIndex((e) => e.id === toId);
  if (fromIdx < 0 || toIdx < 0) return;
  const [moved] = entries.splice(fromIdx, 1);
  entries.splice(toIdx, 0, moved);
  entries.forEach((e, i) => (e.order = i));
  await Promise.all(entries.map(saveEntry));
  renderEntries();
}

document.getElementById("add").addEventListener("click", async () => {
  const entry = {
    id: newId(),
    label: "",
    value: "",
    pinned: false,
    order: entries.length,
  };
  entries.push(entry);
  await saveEntry(entry);
  renderEntries();
  entriesEl.querySelector("li:last-child input.label").focus();
});

// ---------- resumes ----------

function renderResumes() {
  resumesEl.replaceChildren(
    ...resumes.map((resume) => {
      const li = document.createElement("li");
      li.className = "resume";

      const tile = iconTile(ICONS.file);

      const label = document.createElement("input");
      label.className = "label";
      label.value = resume.label;
      label.placeholder = "Label (e.g. AI Focused)";
      label.addEventListener(
        "input",
        debounce(async () => {
          resume.label = label.value;
          await saveResume(resume);
        }, 400)
      );

      const file = document.createElement("div");
      file.className = "filename";
      file.textContent = `${resume.filename} · ${Math.round(resume.size / 1024)} KB`;

      const del = document.createElement("button");
      del.className = "delete-btn";
      del.textContent = "✕";
      del.title = "Delete resume";
      del.addEventListener("click", async () => {
        if (!confirm(`Delete "${resume.label}"?`)) return;
        await deleteResume(resume.id);
        resumes = resumes.filter((r) => r.id !== resume.id);
        renderResumes();
      });

      li.append(tile, label, file, del);
      return li;
    })
  );
}

const resumeFileEl = document.getElementById("resume-file");
document
  .getElementById("import-resume")
  .addEventListener("click", () => resumeFileEl.click());

resumeFileEl.addEventListener("change", async () => {
  const file = resumeFileEl.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    alert("That file is over 5MB. Resumes should be much smaller.");
    return;
  }
  const data = await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result); // data URL
    reader.readAsDataURL(file);
  });
  const resume = {
    id: newId(),
    label: file.name.replace(/\.[^.]+$/, ""),
    filename: file.name,
    mime: file.type || "application/pdf",
    size: file.size,
    data,
  };
  resumes.push(resume);
  await saveResume(resume);
  renderResumes();
  resumeFileEl.value = "";
});

// ---------- backup ----------

document.getElementById("export").addEventListener("click", () => {
  const payload = JSON.stringify({ version: 1, entries, resumes }, null, 2);
  const url = URL.createObjectURL(
    new Blob([payload], { type: "application/json" })
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "paste-pal-backup.json";
  a.click();
  URL.revokeObjectURL(url);
});

const importFileEl = document.getElementById("import-file");
document
  .getElementById("import")
  .addEventListener("click", () => importFileEl.click());

importFileEl.addEventListener("change", async () => {
  const file = importFileEl.files[0];
  if (!file) return;
  let payload;
  try {
    payload = JSON.parse(await file.text());
    if (!Array.isArray(payload.entries)) throw new Error("no entries array");
  } catch (err) {
    alert(`That doesn't look like a Paste Pal backup: ${err.message}`);
    return;
  }
  if (
    !confirm(
      `Replace everything with this backup? ` +
        `(${payload.entries.length} entries, ${payload.resumes?.length ?? 0} resumes)`
    )
  )
    return;

  await Promise.all([
    ...entries.map((e) => deleteEntry(e.id)),
    ...resumes.map((r) => deleteResume(r.id)),
  ]);
  entries = payload.entries.map((e, i) => ({ ...e, id: e.id || newId(), order: i }));
  resumes = (payload.resumes || []).map((r) => ({ ...r, id: r.id || newId() }));
  await Promise.all([...entries.map(saveEntry), ...resumes.map(saveResume)]);
  renderEntries();
  renderResumes();
  importFileEl.value = "";
});

// ---------- init ----------

(async () => {
  initTheme();
  initAppearance();
  [entries, resumes] = await Promise.all([loadEntries(), loadResumes()]);
  renderEntries();
  renderResumes();
})();
