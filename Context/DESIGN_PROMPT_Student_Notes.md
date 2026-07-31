# Design prompt — Student Notes tab + multi-page viewer

Paste everything below the line into the design tool. It's written to match the conventions of
`Design System/Student - Stories.dc.html` so the output drops into the same library.

---

Design the **Student Notes** experience for Ascent, an exam-prep LMS. Produce a `.dc.html`
component sheet in the same house style as the existing `Student - Stories` screens.

## What this feature is

Faculty photograph their handwritten notes after a live class and upload them. Today students
get a Google Drive link posted to a Telegram group; this brings it in-app. A student opens a
**Notes** tab and finds every note set shared with them, newest first.

The single most important idea: **a "note" is a SET, not a file.** One day's class might be three
photographed pages. Those are ONE entry that opens into a paged viewer — never three rows in a
list. Every screen must reinforce that.

## Brand foundation (use these exact values)

- Fonts: `'Plus Jakarta Sans'` for UI, `'JetBrains Mono'` for labels/metadata/numbers
- Canvas `#faf8f6` · sunken `#f4f1ed` · card `#ffffff` · border `#e9e4de`
- Ink `#1c1915` · secondary `#59534b` · faint `#aaa39a`
- Primary Ember Orange `#f26a1b` (soft `#fdf0dd`, ink-on-soft `#a35a06`, deep `#e0540e`)
- Accent Focus Violet `#7c5cfc` (soft `#f5f2ff`, ink-on-soft `#5a2ed6`)
- Green `#0e7a48` / soft `#e6f6ee` · Amber `#dd8b12` / soft `#fdf0dd` · Blue `#2e7de0` / soft `#e7f0fc`
- Radii 6 / 10 / 14 / 20 / 28px · Shadows `0 1px 2px`, `0 2px 8px`, `0 8px 24px`, `0 20px 48px` all `rgba(28,22,15,·)`
- Mobile frame: 390 × 820, 32px corner radius

## The four scopes — the core visual idea

Every note set is tagged with exactly one scope, and a student must understand **at a glance
where a note applies**. Give each its own chip treatment (mono, ~8.5px, letterspaced, uppercase):

| Scope | Means | Suggested |
|---|---|---|
| **GENERAL** | Everyone in the institute | Neutral — sunken fill, secondary ink |
| **COURSE** | Everyone enrolled in a course | Focus Violet soft + violet ink |
| **BATCH** | One live-class cohort, e.g. "First A — July Batch" | Ember Orange soft + orange ink |
| **LESSON** | Tied to one lesson in a chapter | Blue soft + blue ink |

Don't rely on colour alone — pair each with a small distinct glyph.

## Screens to produce

Use `data-screen-label` on each, matching the Stories file's naming:

1. **"Notes — Components"** — the scope chips in all four states; the note-set card in default /
   unread / opened states; the page-count pill; the search + filter bar; a file-type badge
   (IMAGE vs PDF).
2. **"Notes tab — Desktop"** — the full list.
3. **"Notes tab — Filtered + empty"** — filters active with a no-results state, and the
   never-had-any state. These must read differently: "no notes match your filters" is a dead end
   to back out of, "your faculty hasn't shared notes yet" is a waiting state.
4. **"Note viewer — Image pages"** — a 3-page handwritten set, page 2 of 3.
5. **"Note viewer — PDF"** — a PDF set rendered inline.
6. **"Notes — Mobile · List"** (390px)
7. **"Notes — Mobile · Viewer"** (390px)

## The note-set card

Carries, in priority order:

- **Title** — always a meaningful name ("Thermodynamics — Ch 4, Part 2"), never a raw filename
- **Scope chip**
- **Page count** — "3 pages"; suppress it entirely for single-page sets rather than showing "1 page"
- **Session date** when present ("Class of 12 Jul") — **it is optional**, so the card must not
  collapse or look broken without it
- Course name when the scope has one. **A GENERAL note has no course** — design for that row
  having no course chip at all.
- A faint page-stack / thumbnail preview hinting at multiple pages

## The viewer — the piece that matters most

Today a student taps a note and lands in a browser tab with a raw file. Replace that entirely.

- Full-screen. Pages in order, with a **"2 / 3" indicator** — mono, always visible.
- Swipe left/right on touch; arrow keys on desktop; **visible** prev/next controls — no invisible
  tap zones.
- Pinch-zoom and double-tap-zoom on images. Handwriting gets read up close; this is not optional.
- PDFs render inline. Downloading stays available but is **never required to read**.
- Title, scope chip and session date stay visible — a student deep in page 5 must still know what
  they're looking at.
- Mobile follows the Stories viewer's ST6v pattern: content on top, a rounded sheet below with a
  grab handle, safe-area insets respected, swipe down to close.

**Match the Stories viewer's gesture grammar exactly** — same swipe directions, same control
placement, same close behaviour. The two viewers are siblings and must feel like one system.

## Search and filters

Search by title. Filter by **batch**, **course**, and **date range**. On mobile these must
collapse into something thumb-reachable rather than a row of desktop selects — but the active
filter state has to stay visible so nobody wonders why their list looks short.

## Rules to honour

- One entry per note set. Never one row per page.
- Scope is always visible on both the card and in the viewer.
- Session date is optional everywhere.
- A General note has no course — no empty chip, no placeholder.
- Nothing requires a download to read.
- Notes are photographed handwriting: the dominant content is a warm off-white page with blue or
  black ink. Design the frame around that, and don't put strong colour next to it.
