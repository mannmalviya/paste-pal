# Paste Pal

A Chrome extension that keeps all your job-application details one click away — name, email, LinkedIn, GitHub, portfolio, canned answers to "why do you want to work here?", and your resume PDFs.

Filling out the same twelve fields on every Workday, Greenhouse, and Lever form is miserable. Paste Pal doesn't try to auto-fill whole forms (that breaks constantly); it makes the manual route nearly as fast, and works on every site.

## Three ways to use it

**Copy** — click the toolbar icon to open the side panel. It stays open while you work through a form: type a few letters to filter, click a row, the value is on your clipboard. Paste, repeat.

**Fill** — right-click any text field on a page → **Paste Pal → Fill with → Email**. The field is filled directly, no clipboard round-trip. Only your ★-pinned entries show here, so the menu stays short.

**Attach** — right-click a resume-upload button or drop zone → **Paste Pal → Attach resume → …** and the PDF is attached, exactly as if you'd picked it in the file dialog. No more hunting through Downloads for `Resume (3).pdf`.

## Install

1. Clone this repo
2. Open `chrome://extensions`, turn on **Developer mode**
3. **Load unpacked** → select the cloned folder
4. Click the ⚙ in the side panel to fill in your details and import your resume PDFs

Requires Chrome 114+ (side panel API).

## How it stores your data

- **Text entries** live in `chrome.storage.sync` — they follow your Chrome account across machines. One key per entry, so each gets its own 8KB quota; the settings page warns instead of silently failing if an answer is too long to sync.
- **Resume PDFs** live in `chrome.storage.local` (as data URLs) — local to each machine, re-import once per computer.
- **Backup** — settings page exports everything (entries + resumes) to a single JSON file, and imports it back.

Nothing is ever sent anywhere. There is no server, no analytics, no network request in the entire codebase. Storage is plain text, though — don't put your SSN in it.

## How the attach trick works

Chrome won't tell an extension which element you right-clicked, so a tiny content script remembers the last `contextmenu` target. When you pick a resume, it:

1. looks for an `<input type="file">` at, inside, or near the clicked element (most ATSes hide the real input behind a styled button),
2. hands it a `File` via `DataTransfer` and fires `input`/`change`,
3. or, if there's no input at all, simulates the `dragenter → dragover → drop` sequence on the element you clicked — which is what react-dropzone-style widgets listen for.

Text fills go through the native value setter so React-controlled inputs keep the value instead of reverting on the next render.

**Known limitation:** synthetic events carry `isTrusted: false`. Most uploaders don't check; the rare hardened one will silently ignore the drop. A toast tells you what happened either way, and the file picker is always the fallback.

## Development

Plain JavaScript, Manifest V3, no build step.

```text
panel/     side panel — search + click-to-copy
options/   settings page — edit, pin, reorder, resumes, backup
src/
  store.js       shared storage helpers (sync entries, local resumes)
  background.js  service worker — context menus, seeding
  content.js     fill + attach, runs in every frame
test/      upload-test.html — inputs, hidden ATS-style input, dropzone
```

To test the fill/attach paths, serve `test/upload-test.html`, load the extension, and right-click your way through each widget. An automated smoke test (CDP against headless Chromium via `Extensions.loadUnpacked`) covers panel rendering, search, fill on input/textarea/contenteditable, and all three attach paths.

## License

MIT
