// Runs in every frame. Remembers the element you right-clicked (Chrome's
// context-menu API doesn't tell the extension which element it was), then
// fills it or attaches a resume when the menu handler asks.

let lastTarget = null;

document.addEventListener(
  "contextmenu",
  (e) => {
    lastTarget = e.target;
  },
  { capture: true }
);

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "fill") fill(msg.value);
  else if (msg.type === "attach") attach(msg.resumeId);
});

// ---------- fill ----------

function fill(value) {
  const el = findEditable(lastTarget);
  if (!el) {
    toast("Paste Pal: that doesn't look like a text field", true);
    return;
  }
  if (el.isContentEditable) {
    el.focus();
    // execCommand is deprecated but still the only way to insert text that
    // rich-text editors (Draft.js, ProseMirror, …) register as user input.
    if (!document.execCommand("insertText", false, value)) {
      el.textContent = value;
      el.dispatchEvent(new InputEvent("input", { bubbles: true }));
    }
    return;
  }
  setNativeValue(el, value);
}

function findEditable(el) {
  if (!el) return null;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)
    return el;
  const editable = el.closest?.('[contenteditable=""], [contenteditable="true"]');
  if (editable) return editable;
  // Some widgets put a transparent overlay over the real input.
  return el.querySelector?.("input, textarea") || null;
}

// React and friends track inputs through the native value setter; assigning
// el.value directly gets overwritten on the next render. Call the prototype's
// setter, then fire the events a real keystroke would.
function setNativeValue(el, value) {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

// ---------- attach ----------

async function attach(resumeId) {
  const stored = await chrome.storage.local.get("r_" + resumeId);
  const resume = stored["r_" + resumeId];
  if (!resume) {
    toast("Paste Pal: resume not found — re-import it in settings", true);
    return;
  }

  const bytes = Uint8Array.from(atob(resume.data.split(",")[1]), (c) =>
    c.charCodeAt(0)
  );
  const file = new File([bytes], resume.filename, { type: resume.mime });
  const dt = new DataTransfer();
  dt.items.add(file);

  const input = findFileInput(lastTarget);
  if (input) {
    input.files = dt.files;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    toast(`Attached ${resume.filename}`);
    return;
  }

  // No file input in reach — treat the clicked element as a drop zone and
  // simulate the drag sequence react-dropzone-style widgets listen for.
  const zone = lastTarget || document.body;
  for (const type of ["dragenter", "dragover", "drop"]) {
    zone.dispatchEvent(
      new DragEvent(type, {
        bubbles: true,
        cancelable: true,
        dataTransfer: dt,
      })
    );
  }
  toast(
    `Dropped ${resume.filename} — if nothing happened, use the file picker`,
    false
  );
}

function findFileInput(el) {
  if (!el) return null;
  if (el.matches?.('input[type="file"]')) return el;
  const inside = el.querySelector?.('input[type="file"]');
  if (inside) return inside;
  // Upload widgets usually hide the real input near the visible button —
  // walk up a few levels and search each subtree. Stop before <body>:
  // from there a query would grab unrelated file inputs elsewhere on the
  // page, and ambiguous matches are worse than falling back to a drop.
  let node = el;
  for (let i = 0; i < 6 && node.parentElement; i++) {
    node = node.parentElement;
    if (node === document.body || node === document.documentElement) break;
    const found = node.querySelectorAll('input[type="file"]');
    if (found.length === 1) return found[0];
    if (found.length > 1) break;
  }
  return null;
}

// ---------- toast ----------

function toast(text, isError = false) {
  const el = document.createElement("div");
  el.textContent = text;
  Object.assign(el.style, {
    position: "fixed",
    right: "16px",
    bottom: "16px",
    zIndex: 2147483647,
    padding: "10px 14px",
    borderRadius: "8px",
    font: "13px system-ui, sans-serif",
    color: "#fff",
    background: isError ? "#dc2626" : "#4f46e5",
    boxShadow: "0 4px 12px rgba(0,0,0,.25)",
  });
  document.documentElement.append(el);
  setTimeout(() => el.remove(), 2500);
}
