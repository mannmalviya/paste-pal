// Shared storage helpers. Loaded by the panel and options pages via <script>,
// and by the service worker via importScripts().
//
// Text entries live in chrome.storage.sync, one key per entry ("e_<id>") so
// each entry gets its own ~8KB quota and everything follows the Chrome account.
// Resume PDFs are too big for sync; they live in chrome.storage.local as
// base64 data URLs ("r_<id>").

const ENTRY_PREFIX = "e_";
const RESUME_PREFIX = "r_";

// Per-item sync quota is 8192 bytes (key + JSON value).
const SYNC_ITEM_LIMIT = 8192;

const SEED_ENTRIES = [
  { label: "Full name", pinned: true },
  { label: "First name", pinned: false },
  { label: "Last name", pinned: false },
  { label: "Email", pinned: true },
  { label: "School email", pinned: false },
  { label: "Phone", pinned: true },
  { label: "LinkedIn", pinned: true },
  { label: "GitHub", pinned: true },
  { label: "Website", pinned: true },
  { label: "X", pinned: true },
  { label: "School", pinned: false },
  { label: "Graduation date", pinned: false },
];

function newId() {
  return crypto.randomUUID().slice(0, 8);
}

async function loadEntries() {
  const all = await chrome.storage.sync.get(null);
  return Object.entries(all)
    .filter(([k]) => k.startsWith(ENTRY_PREFIX))
    .map(([k, v]) => ({ id: k.slice(ENTRY_PREFIX.length), ...v }))
    .sort((a, b) => a.order - b.order);
}

async function saveEntry(entry) {
  const { id, ...data } = entry;
  await chrome.storage.sync.set({ [ENTRY_PREFIX + id]: data });
}

async function deleteEntry(id) {
  await chrome.storage.sync.remove(ENTRY_PREFIX + id);
}

// Approximate size the entry will occupy against the per-item sync quota.
function entrySyncSize(entry) {
  const { id, ...data } = entry;
  return ENTRY_PREFIX.length + id.length + JSON.stringify(data).length;
}

async function loadResumes() {
  const all = await chrome.storage.local.get(null);
  return Object.entries(all)
    .filter(([k]) => k.startsWith(RESUME_PREFIX))
    .map(([k, v]) => ({ id: k.slice(RESUME_PREFIX.length), ...v }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

async function saveResume(resume) {
  const { id, ...data } = resume;
  await chrome.storage.local.set({ [RESUME_PREFIX + id]: data });
}

async function deleteResume(id) {
  await chrome.storage.local.remove(RESUME_PREFIX + id);
}

async function seedIfEmpty() {
  const existing = await loadEntries();
  if (existing.length > 0) return;
  const items = {};
  SEED_ENTRIES.forEach((seed, i) => {
    items[ENTRY_PREFIX + newId()] = {
      label: seed.label,
      value: "",
      pinned: seed.pinned,
      order: i,
    };
  });
  await chrome.storage.sync.set(items);
}
