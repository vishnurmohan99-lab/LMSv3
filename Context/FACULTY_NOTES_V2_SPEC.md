# Faculty Notes v2 — "Notes Dump", redesigned onto what we already have

Source: client requirement `notes-dump-feature-requirements.md` (the "Notes Dump" ask).

**The headline: this is not a new feature.** We shipped **Faculty Notes** already — banks of
uploaded note files, targeted at batches, stored privately in our own R2 with presigned reads.
The client's stated *core reason* for wanting the feature ("bring it in-house so access control
is properly enforced instead of a Google Drive link in a Telegram group") is **already done**.

What the client is really describing is a set of gaps in the feature we have. This document
restates their requirement as a **delta** against the existing implementation, so we build the
six things that are missing rather than a parallel second notes system.

---

## 1. What exists today

**Data model** (`apps/api/prisma/schema.prisma`)

- `NotesBank` (:1296) — `title`, `published`, `createdBy`. This is the **note set**.
- `NotesBankBatch` (:1310) — join table. A bank is shared with **one or more batches**.
- `Note` (:1320) — one uploaded file: `name`, `fileUrl` (private R2 key), `fileName`, `order`,
  **required `courseId`**, optional `chapterId`.
- `Batch` (:424) — `name`, `startDate`/`endDate`, status, segment/subsegment, `facultyId`,
  and its own `BatchEnrollment` list (:471).

**API** — `apps/api/src/notes/`

- `notes-banks.controller.ts` — FACULTY/ADMIN: list, get, create, update, delete banks; and
  `POST /notes-banks/:id/notes` to add a file to an existing bank.
- `notes.controller.ts` — `GET /notes/mine` for students; patch/delete individual notes.
- `notes.service.ts` — students see a note if its bank is `published` **and** they are enrolled
  in any batch the bank is shared with. Files are presigned on read, never public.

**UI**

- Student: `apps/web/src/app/student/notes/page.tsx` — "Faculty Notes" tab, flat list, search by
  name, filter by course and chapter. Each row is an `<a>` that opens the presigned R2 URL **in a
  new browser tab**.
- Faculty: `apps/web/src/app/faculty/notes/` (list + detail). Admin: `apps/admin/src/app/admin/notes/`.
  Both upload with `accept=".pdf,image/*"`.

---

## 2. Requirement-by-requirement mapping

| Client req | Status | Notes |
|---|---|---|
| F1 upload files tagged with one scope | ⚠️ **Partial** | Files upload fine. But targeting is **batch-only**, and `courseId` sits on the *file*, not the set. No General / Course / Lesson scope. |
| F2 optional session date | ❌ **Missing** | No date field anywhere. |
| F3 students see notes matching their access | ⚠️ **Partial** | Batch-scope access control is correct and enforced server-side. The other three scopes don't exist. |
| F4 inline in-app viewer, multi-page, page indicator | ❌ **Missing** | **Biggest student-facing gap.** We dump the user into a new tab with a raw R2 URL. No viewer, no paging, no zoom. |
| F5 edit/delete metadata after the fact | ✅ **Done** | `PATCH`/`DELETE` on both bank and note. |
| F6 multi-page grouped as one note set | ⚠️ **Model yes, UI no** | `NotesBank` *is* the set — the model is already right. The student list flattens it back into one row per file, which is exactly what the client says not to do. |
| F7 meaningful title required | ✅ **Done** | Both bank and note carry a `name`/`title`, validated non-empty. |
| F8 dedicated Notes tab | ✅ **Done** | `/student/notes`. |
| F9 student search + filter by batch, course, date | ⚠️ **Partial** | Search + course + chapter exist. **No batch filter, no date filter.** |
| F10 admin/faculty search + filter | ❌ **Missing** | The faculty and admin notes lists have **no search box and no filters at all** — just a reverse-chronological list of every bank. |
| F11 attach more files to an existing entry | ✅ **Done** | `POST /notes-banks/:id/notes`. |

**Non-functional**

| | Status |
|---|---|
| Own storage + access-controlled signed URLs (the whole point of the ask) | ✅ **Done** |
| Accept JPG/PNG/PDF | ✅ Done (`accept=".pdf,image/*"`) |
| HEIC | ❌ iPhone photos won't upload |
| Auto-compress large photos | ❌ Missing — a raw 8 MB phone photo goes to R2 as-is |
| Mobile camera capture | ⚠️ `image/*` opens the camera on mobile, but there's no explicit `capture` hint and no multi-shot flow |
| Multi-image → single PDF | ❌ Missing (an ordered gallery + a real viewer covers the actual need; see §4) |
| Notifications on new notes | ❌ Missing |

---

## 3. The redesign

### 3.1 Move targeting from the file to the set

This is the central change, and it's what unlocks three of the four scopes.

Today `courseId` is **required on every `Note` file**, which is backwards: it means one note set
can technically hold files from different courses, and a General note (belonging to no course) is
impossible to express. Targeting is a property of the *set*, not of each page.

Proposed on `NotesBank`:

```prisma
enum NoteScope { GENERAL COURSE BATCH LESSON }

model NotesBank {
  scope       NoteScope @default(BATCH)
  courseId    String?   // COURSE and LESSON scope
  lessonId    String?   // LESSON scope only
  sessionDate DateTime? // F2
  // batches via the existing NotesBankBatch join — BATCH scope
}
```

`Note.courseId` becomes nullable and is kept only as a migration shim, then dropped. Existing
rows migrate to `scope = BATCH`, with the bank's `courseId` backfilled from its first note.

**One deliberate deviation from the client's doc.** They specify "exactly one scope," and a
single `scope` enum gives them that. But our existing `NotesBankBatch` is many-to-many, so a
BATCH-scoped bank can already target *several* batches at once — which is exactly their
"Additional Suggestion #4" (cross-batch visibility toggle). We get it for free and should keep it
rather than narrow the model to one batch to match the letter of the spec.

### 3.2 The student list shows sets, not files

`GET /notes/mine` returns individual `Note` rows today. It should return **banks**, each with its
file count and an ordered file list. One card per note set, showing:

- the set title and its **scope chip** (General / Course / Batch / Lesson — colour-differentiated
  per §2 of the client doc),
- the session date when present,
- a page count ("3 pages").

### 3.3 A real in-app viewer

The single highest-value item, and the one the client is most explicit about. A full-screen
viewer that:

- pages through the set's files in `order`, with a **"2 / 3" indicator**,
- swipes left/right on touch, arrow keys on desktop,
- pinch-zoom / double-tap-zoom on images,
- renders PDFs inline rather than handing off to the browser's download,
- keeps a download affordance, but never *requires* a download to read.

**We should reuse the Success Stories viewer's mechanics here rather than write them twice** —
it already solves portal-to-body, mobile sheet layout, swipe left/right with the post-swipe click
swallowed, safe-area insets, and keyboard nav. Same gesture grammar, different content.

### 3.4 Search and filters on both sides

- **Student** (F9): add **batch** and **date-range** filters next to the existing search/course.
- **Faculty + admin** (F10): they currently have *nothing*. Add search by title plus filters for
  scope, course, batch and date range. This matters more than it looks — a faculty member two
  terms in will be scrolling an undifferentiated list of hundreds of banks to find the one to
  attach a missed page to.

### 3.5 Capture quality

- Accept `.heic`/`.heif` and convert server-side.
- Client-side downscale/compress images before upload (long edge ~2000px, JPEG q≈0.8). A
  photographed page loses nothing legible and drops from ~8 MB to a few hundred KB — this is the
  difference between the viewer feeling instant and feeling broken on a phone.
- Multi-file picker so a faculty member selects all pages of one day's notes in a single action
  instead of repeating the add-file form per page.

---

## 4. Recommended cuts

**Auto-stitch multi-image → PDF (§5, §6 of the client doc).** Skip it. They ask for it *or* a
swipeable viewer — the viewer in §3.3 is the better half of that "or": it keeps pages
individually replaceable (F11's "add a missed page" stays trivial), avoids a server-side image
pipeline, and reads better on a phone than a PDF does. Revisit only if they specifically want a
single downloadable file.

**OCR (§7.2).** Their own doc calls it a stretch goal and flags the handwriting-legibility risk.
Agreed — park it.

**Analytics, offline caching, version history, bookmarks (§7.3, 5, 7, 8).** All reasonable, none
load-bearing. Ship the six gaps first.

---

## 5. Their open questions — four of which the code already answers

> **Is "Batch" a section (First A/B/C) or can it span sections?**

A `Batch` in our schema is a concrete cohort with its own enrolment list, its own
faculty, and its own segment/subsegment. It does **not** span sections. To share one set of notes
with First A *and* First B you attach both batches to the bank — which our many-to-many join
already supports.

> **Who can upload — only the faculty who taught, or any faculty/admin on the course?**

Already decided in code: **any** FACULTY can create a bank; edit and delete are restricted to the
creator or an ADMIN (`assertOwner` in `notes.service.ts`). Not tied to who taught the session.
Worth confirming the client is happy with that, because it's already live.

> **Moderation/review step, or does it go live immediately?**

`NotesBank.published` defaults to `true` — **it goes live immediately**. A faculty member can
unpublish to keep a draft, and sees their own unpublished banks. There is no review queue and I'd
suggest not adding one; it reintroduces the delay that pushed them to Telegram.

> **Push notifications on new notes?**

Genuinely open — nothing exists. This is the one that replaces "someone posts in Telegram," so
it's worth doing, but it needs a decision on whether it fires per bank publish or digests daily.

---

## 6. Build order

1. **Scope on the bank** — schema + migration + backfill, API, faculty/admin scope picker. (§3.1)
2. **Student list returns sets** with scope chips and page counts. (§3.2)
3. **In-app multi-page viewer.** (§3.3)
4. **Session date** field end to end. (F2)
5. **Search + filters**, admin/faculty first since they have none. (§3.4)
6. **Capture quality** — HEIC, compression, multi-file picker. (§3.5)

1–3 are the feature as the client understands it; 4–6 are what makes it hold up in daily use.

---

## 7. Flag: this feature has no design

Per our standing rule that student-facing work is designed in `Design System/` before it's built:
there is **no `Student - Notes` mockup**. Faculty Notes shipped without one, and everything above
— the scope chips, the note-set card, and especially the viewer — is student-facing UI that needs
a mockup before it's built. Recommend designing the student Notes tab + viewer first, then
faculty/admin.
