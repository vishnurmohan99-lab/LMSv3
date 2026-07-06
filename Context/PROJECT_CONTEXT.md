# Paperlms — Full Project Context

> This file is kept up to date after every commit so context never needs to be
> re-explained from scratch in a new session. Read this first.

## Project

Paperlms: production eLearning LMS, npm-workspaces monorepo at
`C:\Users\HP\Desktop\Student eLearning Platform Design`. Three apps:

- **apps/api** — NestJS + Prisma + PostgreSQL (Neon), deployed on Render:
  https://duvex-api.onrender.com
- **apps/web** — Next.js student+faculty app, Vercel:
  https://web-jade-iota-60.vercel.app
- **apps/admin** — Next.js admin-only app, Vercel:
  https://admin-one-green-15.vercel.app

GitHub: https://github.com/vishnurmohan99-lab/LMSv3, branch `main`, all work
committed directly to main (no PR flow). Design reference dir:
`design-reference/` — contains `elearningv3.dc.html` (desktop design),
`Mobile user page UI/elearning-mobile.dc.html` (mobile design), and
`answer_correction_promt.md` (AI grading consultant brief, now implemented).
Design tokens/animation utilities in each app's `globals.css` (`--orange
#f26a1b`, `--purple #7c5cfc`, `--purple-soft #efeaff`, `--green/--amber/--red/--blue`
+ `*-soft` variants, `--rl/--rm/--rs` radii, `.fade-in-up/.slide-in-right/.pop-in/.live-pulse`).

No shared package between apps/web and apps/admin — `lib/api.ts` duplicated in
each; any API client change must be made in both files.

## Infra

- Neon Postgres via `DATABASE_URL` in `apps/api/.env`. Local dev API connects
  to the **same real Neon DB** — no local Postgres ever worked here, so local
  migrations ARE production migrations.
- Cloudflare R2 bucket `elearningv3` (private presigned content + public
  R2.dev images). Three presign routes now: `/uploads/presign` (lessons,
  FACULTY/ADMIN only), `/uploads/question-image-presign` (public bucket),
  `/uploads/answer-submission-presign` (private, STUDENT/FACULTY/ADMIN, prefix
  `answer-submissions/`).
- `OPENROUTER_API_KEY`, text model `openai/gpt-oss-20b:free`
  (`OPENROUTER_MODEL`). Vision model env var `OPENROUTER_VISION_MODEL`,
  defaulting to `nvidia/nemotron-nano-12b-v2-vl:free` (confirmed live on
  OpenRouter). **`qwen/qwen2.5-vl-32b-instruct:free` does NOT exist — 404s.**
- Real test accounts: `admin@test.com`/`Vishnu123@` (ADMIN),
  `vishnu@test.com`/`Vishnu123@` (STUDENT, no segment — as of 2026-06-29
  this means it now hits the mandatory SegmentOnboardingGate on next
  login; pick one to get past it, or it'll re-appear every session until
  you do — this is now intended app behavior, not a bug to route around),
  `testfaculty_mentor@test.com`/`Vishnu123@` (FACULTY, isMentor=false).
  `aparna@test.com` is a separate real STUDENT account.
  `aparna.mentor@test.com` is the real mentor account (FACULTY,
  "Front-end · 6y", 50 weekly recurring slots).
- Real courses in prod: Maths, Chemistry, Physics (Class 12/JEE), Biology
  (Class 12/NEET), JEE MAINS (Cllass 10 — typo'd segment, leave as-is). Real
  segments: "Class 11", "Class 12" (sub: "NEET").
- **Mock Tests**: all 10 pre-existing `Test` rows (Maths/Chemistry/Physics
  Mock Tests at 10/15/20 Qs + a "MOCK" test) were deleted on 2026-06-27 at
  the user's request — `Test` table is currently empty in prod.
- **Question Banks**: 3 pre-existing banks kept as-is (Maths Question Bank
  26 Q, Biology Question Bank 27 Q, Reading Comprehension - Solar System 6
  Q). On 2026-06-27, added 5 new published 30-MCQ-question banks — "Maths",
  "Physics", "Chemistry", "Biology", "JEE Mains" (AI-authored, topically
  correct, factually checked) — plus a 6th new bank "Comprehension Practice"
  (a Newton's Laws passage + 6 comprehension MCQs). Seeded via a one-off
  Node script (cookie-jar auth as `admin@test.com`) hitting the local API
  against the real Neon DB, then PATCHed all 6 new banks to
  `published: true` to match the existing banks' convention (created
  unpublished by default). Followed up same day: added 5 more separate
  passages to "Comprehension Practice" (Photosynthesis, Human Digestive
  System, States of Matter, Periodic Table & Atomic Structure, Electricity &
  Circuits — 6 MCQs each), via repeated calls to the same
  `POST /question-banks/:id/comprehension` endpoint (each call creates one
  new `Passage` + its questions, all attached to the same bank). Bank now
  has 6 distinct passages, 36 questions total.

## Architecture gotchas (don't regress)

- Cross-domain cookies (onrender.com vs vercel.app): client-side AuthGuard +
  refresh-on-401 retry. No custom domain.
- Shared cookie jar across roles in one browser profile — intentionally not
  fixed; use separate browser profiles for multi-role testing.
- Local dev over `http://localhost` can't carry the Secure cookie — verify UI
  changes against production via Claude-in-Chrome.
- Render build: `npm install --include=dev && npx prisma generate
  --config=apps/api/prisma.config.ts && npm run build --workspace=apps/api`;
  start runs `prisma migrate deploy` then `start:prod`. Render deploys can be
  slow (502 mid-restart for 5–10+ min) — curl-verify after deploy, retry on
  502/404.
- Vercel does **not** auto-deploy from git push — must run `vercel --prod
  --yes` manually in `apps/admin` and `apps/web` after every push.
- `npx prisma migrate dev` hangs/fails non-interactively in this environment —
  confirmed repeatedly, including holding a Postgres advisory lock after being
  killed, blocking subsequent `migrate deploy` until stray node processes were
  killed. **Standing procedure:** hand-write the migration SQL directly into
  `prisma/migrations/<timestamp>_<name>/migration.sql`, then `npx prisma
  migrate deploy --config=apps/api/prisma.config.ts` followed by `npx prisma
  generate --config=apps/api/prisma.config.ts`. If `migrate deploy` hangs with
  a P1002 advisory-lock timeout, kill all stray node processes
  (`tasklist | grep node`, `taskkill //PID <pid> //F`) and retry.
- Local dev: always kill **all** stray node processes before
  `npm run start:dev`, not just the port-3001 one.
- Prisma interactive transactions need `{ maxWait: 15000, timeout: 15000 }` on
  this Neon connection.
- RolesGuard: method-level `@Roles()` overrides controller's class-level
  `@Roles()` (`reflector.getAllAndOverride`).
- CSS percentage heights don't resolve against an auto-height flex parent.
- Forum permission model (course/batch membership is a hard gate) — confirmed
  correct by design, don't "fix" again.
- **SUPERSEDED 2026-06-29 (commit `a91da3c`):** this used to say a student
  with no segmentId/subsegmentId sees ALL segment-scoped content
  unfiltered, by design. That's no longer true for new logins — see
  "Segment onboarding gate" in feature history below. Existing students
  who already have a segment set were never affected by this either way
  (backend course filtering already matched their segment correctly).
  Whether Test/Answer-Correction visibility for a (now theoretically
  impossible going forward, but still reachable via direct API/old
  sessions) no-segment student should also change was **not** addressed —
  this commit only touched course catalog + "Continue learning" plus the
  new gate forcing segment selection. Revisit if a no-segment edge case
  resurfaces.
- **Always give `orderBy: { order: 'asc' }` a secondary tiebreaker**
  (`createdAt`/`id`) wherever lessons/tests/chapters are queried. Many rows
  share `order: 0` until a user explicitly reorders them, and Postgres
  doesn't guarantee tie order without a secondary sort key — without one, an
  unrelated update (e.g. toggling a feature flag on a lesson) can make a
  fresh fetch return ties in a different sequence, looking like the order
  silently changed even though nothing touched it. Fixed in
  `getCourseTree()` and the SEQUENTIAL-drip sibling queries in
  `courses.service.ts`; apply the same pattern to any new ordered query.
- **`load()` vs `refresh()` pattern (admin/faculty course + chapter pages):**
  `load()` is mount-only and sets `loading=true` (which renders a full
  "Loading…" page, blanking everything). Every mutation handler (move
  chapter/lesson/test, toggle an AI feature, save/delete, attach a test)
  must call the silent `refresh()` instead — same fetch, but never touches
  `loading`, so the existing UI stays on screen while data swaps in
  underneath it. Don't reintroduce `load()` calls inside mutation handlers;
  it brings back the full-page blink on every reorder/toggle.
- **This codebase is ~100% inline-style, zero CSS Modules.** Inline styles
  can't express `@media` queries. Established pattern: add named utility
  classes (`mobile-page-pad`, `mobile-stack-header`, `course-pane-list`, etc.)
  to `globals.css` with `!important` mobile overrides, and attach those
  classNames alongside existing inline styles in JSX. Inline styles still
  carry all non-breakpoint-dependent values; only responsive deltas live in
  CSS classes.
- **Browser automation in this environment cannot shrink the real browser
  viewport** (`window.innerWidth` stays 1920 despite `resize_window` calls,
  and browser-level shortcuts like `F12`/`ctrl+shift+m`/`ctrl+=` are no-ops
  since the extension's key dispatch only reaches the page, not Chrome's own
  UI — the browser runs maximized in a remote/virtual display). **Working
  fallback (used successfully):** inject a `<style>` tag that duplicates the
  target `@media (max-width: 860px)` rules without the media-query gate
  (forces the mobile classes on regardless of width), optionally set
  `document.body.style.zoom` to shrink the frame for a clean screenshot,
  verify visually, then remove the injected style/zoom — no permanent code
  change. Prefer this over code-review-only verification when mobile-only
  styles need visual confirmation.
- **Next dev server occasionally throws a spurious `Runtime Error: Jest
  worker encountered 2 child process exceptions, exceeding retry limit`**
  on a normal page navigation that has nothing to do with Jest/tests.
  Reloading doesn't fix it. Fix: find the PID on port 3000 (`netstat -ano |
  grep ":3000" | grep LISTENING`), `taskkill //PID <pid> //F`, restart
  `npm run dev`. Not a code bug — an environment hiccup with this
  long-running dev server.

## Established code patterns (mirror these)

- **Backend module:** mirror `apps/api/src/courses/` (largest) or
  `apps/api/src/answer-correction/` (newest, clean multi-controller module:
  rubric CRUD + grading service + manual-override layer, DI-wired through one
  `*.module.ts`).
- **Frontend API client:** both apps' `lib/api.ts` share a `request()` helper
  + `ApiError` class + typed `*Api` object pattern. New entity needs the same
  block in both files (admin gets full/owner-shaped types, web sometimes gets
  a trimmed type mirroring the backend's role-based field withholding — see
  `AnswerQuestion` in `apps/web/src/lib/api.ts` vs `apps/admin/src/lib/api.ts`).
- **Admin/faculty card-grid UI:** `.entity-card` +
  `.banner-gradient-dark`/`.banner-gradient-orange` placeholder pattern.
- **Modals:** `Modal.tsx` portal pattern via `createPortal(..., document.body)`.
- **Delete confirmation:** `useConfirm()` from `ConfirmProvider.tsx`.
- **Duplicate-name prevention:** `withUniqueNameCheck()`.
- **AI features:** `AiService.complete()` (text) + `AiService.completeVision()`
  (multimodal — text + one `image_url` content part) + `extractFirstJsonValue()`;
  `completeJsonText()` retries once on bad JSON. `answer-grading.service.ts`
  duplicates this retry pattern locally as `completeJsonVisionWithRetry()`
  rather than sharing code — matches the repo's convention of small per-module
  AI-call helpers.
- **Deterministic-marks-from-LLM-detections pattern** (reusable for any future
  AI-grading feature): the LLM is asked ONLY for present/partial/absent +
  qualitative judgments per rubric-defined id; a pure function in code
  (`computePartMarks` in `answer-grading.service.ts`) does all arithmetic from
  admin-authored weights. Never let the LLM invent a total. Structural
  response validation (`validateLlmGradingResponse`) checks every expected
  rubric id appears in the response before trusting it, retrying once on
  failure.
- **Manual-override-as-separate-layer pattern:** when an AI/automated result
  needs human review, don't overwrite it — add nullable `manual*` columns
  alongside it (`manualMarksAwarded`, `manualComment`, `manualGradedById`,
  `manualGradedAt`) and have the API response include both (`overall` = AI,
  `manualGrade` = human override | null) so the frontend shows "AI said X,
  human finalized to Y" as an audit trail.
- **Mobile shell pattern:** `StudentShell.tsx` renders two header variants
  (`.student-topbar-desktop` / `.student-topbar-mobile`) toggled purely by CSS
  media query, and the sidebar carries a `.student-sidebar` class that becomes
  a fixed-position slide-out drawer below 860px (`open` class toggled by React
  state, closed automatically on pathname change). No separate mobile route
  tree — same components, same data-fetching, just responsive layout.
- **Mobile drill-down pattern** (course detail page): when a list+detail
  split-pane doesn't fit mobile, give both panes classNames
  (`course-pane-list` / `course-pane-detail`) plus a shared `has-selection`
  class driven by existing selection state — CSS hides whichever pane isn't
  relevant below the breakpoint, and a mobile-only back button
  (`mobile-back-btn`, hidden on desktop) clears the selection to return to the
  list. Zero new state needed if a "what's selected" piece of state already
  exists.

## Feature history (chronological, condensed)

Prior sessions (1–19+): full LMS core, Batches, Messenger, Mentor, Feedback,
Forum, Reports, dashboards, Subscriptions, Mock Test+leaderboard, Course
Dripping, Calendar, comprehension questions, theme/color-consistency pass,
Flashcard/Summary-Deck redesign (square→rectangle sizing fix — root cause was
an inline `position: "relative"` silently overriding `.flip-card-face`'s
required `position: absolute; inset: 0`).

**AI Answer-Correction Engine** (full feature, built end-to-end) — adapted
from `design-reference/answer_correction_promt.md` (a from-scratch
Python/FastAPI/Celery/dedicated-OCR consultant brief) into the existing
NestJS/Next.js stack, scoped down via explicit decisions: text-feedback only
(no bbox/image-overlay annotations), synchronous single vision-LLM call
(transcribe+grade in one pass), single-file upload (PDF rejected at
submission time pending future support), admin-only rubric authoring, and a
role split where STUDENT can only upload+receive-AI-grade for their own
submissions while FACULTY/ADMIN can also upload AND manually review/override
any submission's marks.
- Prisma: `AnswerQuestionType`/`AnswerQuestionTypePart` (templates) →
  `AnswerQuestion`/`AnswerQuestionPart`/`AnswerQuestionPoint`/
  `AnswerQuestionPointGroup`/`AnswerQuestionForbiddenPoint` (rubric instances)
  → `AnswerSubmission`/`AnswerEvaluation` (upload + graded Json snapshot +
  manual-override columns).
- Backend: `apps/api/src/answer-correction/` module —
  `answer-correction-rubric.service.ts` (CRUD + `validateRubricReconciliation()`,
  server-enforced marks-sum validation), `answer-grading.service.ts`
  (prompt-builds the rubric into one LLM call, validates structural response
  coverage, computes marks deterministically), `answer-submissions.service.ts`
  (create+grade, list-mine, list-all-for-faculty/admin, manual grade
  endpoint). `AiService.completeVision()` added.
- New upload route: `POST /uploads/answer-submission-presign`
  (STUDENT/FACULTY/ADMIN), private bucket.
- Admin UI: "Answer Correction" nav section — Question Type manager (modal,
  live weight-reconciliation banner), Questions list + full-page
  RubricBuilder, Submissions grading queue + manual-grade detail page.
- Web UI: shared components in `apps/web/src/components/answer-correction/`
  consumed by thin routes under both `/student/answer-correction` and
  `/faculty/answer-correction`; faculty also gets a Submissions grading queue
  + manual-grade page.
- Verified end-to-end via curl (reconciliation validation accept/reject, role
  trimming, a real vision-LLM grading call — model 404 diagnosed/fixed,
  subsequent call succeeded structurally). Confirmed live in production.
- **Open follow-up:** real handwriting-quality testing not yet done — budget-
  test with a stronger paid vision model before relying on this for real
  grades.

**AI Cheat Sheet Generator** (PDF lessons, v1) — per-lesson feature mirroring
the existing Flashcards/Summary Deck pattern exactly. Faculty/admin enable
`Lesson.cheatSheetEnabled` (PDF-only, like AI Notes is video-only in reverse)
and generate a `CheatSheet` (one row per lesson, `pages: Json`). Each page:
`title`, `bullets[]` (AI-rewritten, never copied verbatim), optional `table`,
`examTip`, and an AI-generated flat-icon `illustrationKey` (R2 key, presigned
on read). Scope decisions: image extraction from the source PDF skipped for
v1 (no library for it); illustrations are AI-**generated**, not extracted,
via a new `AiService.generateImage()` OpenRouter call
(`OPENROUTER_IMAGE_MODEL`, defaults to `google/gemini-2.5-flash-image` —
**OpenRouter has no literal $0 image model**, this is just the cheapest
available; swap to OpenAI's image API later via the same env var). Image
generation failure is non-fatal (caught per-page, sheet still saves without
that illustration). New `UploadsService.uploadGeneratedImage()` does a direct
server-side R2 `PutObject` (no presign round-trip, since the server already
has the bytes from the AI response). Admin + faculty get an identical
management page (portrait-card preview grid) at
`.../lessons/[lessonId]/cheat-sheet`; students get `CheatSheetReview.tsx`
(swipeable pages, mirrors `SummaryDeckReview`) via a new lesson-player view
mode. Verified end-to-end against a real PDF (ICSE physics notes) — produced
3 well-structured pages with real, topically-correct illustrations on the
first test run.

**Known issue (live, unresolved):** illustrations stopped generating shortly
after — confirmed via added error logging that `AiService.generateImage()`
gets **402 Payment Required** from OpenRouter. There is no real $0
image-generation tier on OpenRouter; the first successful run likely used a
one-time trial allowance, and the account now has no credit balance for
image calls. The bullets/table/exam-tip text generation is unaffected (image
failure is caught per-page and logged, never fails the whole sheet) — pages
just render with no illustration. **Fix requires the user to add credit at
openrouter.ai/credits** (this account is shared with the text/vision models,
which DO have free tiers, so only image generation is blocked) — not
something fixable in code. Alternative: switch to OpenAI's image API via the
same `OPENROUTER_IMAGE_MODEL`-style env-var swap pattern, if asked.

**Comprehension: mixed question types + passage-relative numbering** —
Comprehension sets (one shared `Passage` + N child questions via
`Question.passageId`/`TestQuestion.passageId`) were MCQ-only since their
introduction. Two independent fixes, both in `QuestionBank` and `Test`
domains (4 frontend files mirror each other: admin question-banks, admin
tests, faculty question-banks, faculty tests):
- **Mixed types**: `ComprehensionQuestionDto` gained an optional `type`
  field (defaults to `MCQ`); `createComprehension()` in both
  `question-banks.service.ts` and `tests.service.ts` now honors it. No
  migration needed — `options[]`/`correctOption` were already nullable on
  `Question`/`TestQuestion`, generic across all 4 `QuestionType` values. The
  creation form's per-question row now has a type dropdown
  (MCQ/FILL_BLANK/TRUE_FALSE) with conditional fields (MCQ: options+radio;
  TRUE_FALSE: True/False toggle; FILL_BLANK: single accepted-answer input).
- **Numbering**: comprehension sub-questions now show as `1-a, 1-b, 1-c`
  (passage-relative letters via a shared `subQuestionLabel(passageNumber,
  index)` helper) instead of a `Sub-question N` counter that reset per
  passage in a confusing way. Applied to the same 4 editor pages' card
  rendering AND the student `mock-test` attempt view (main question header +
  question palette), via a `questionLabels` array computed once per
  question list (`useMemo`, walks the flat list assigning flat numbers to
  standalone questions and `passageNumber-letter` to passage-grouped ones).
- Verified end-to-end via curl: one passage with MCQ + FILL_BLANK +
  TRUE_FALSE + MCQ sub-questions, each persisted with correct shape.
- **Not done**: the student-facing `workout` practice page doesn't fetch or
  render passages/comprehension at all (flat single-question mode) — no
  numbering fix was needed there since the feature doesn't exist on that
  page; flagged as a gap if comprehension support is ever wanted there.

**Mobile UI rollout** (in progress, module-by-module, user-paced) — sourced
from `design-reference/Mobile user page UI/elearning-mobile.dc.html` (top app
bar + slide-out drawer + bottom sheets mockup covering Home/Course/Lesson/
Flashcards/AI-Deck/Calendar/Messages/Forum/Feedback and likely more not yet
read). Decisions: responsive retrofit (not a separate route tree), student
app only (`apps/web /student`) for now.
- **Shipped so far** (each individually committed + deployed):
  1. **Mobile shell** — `StudentShell.tsx` top-app-bar+drawer below 860px.
  2. **Course list** (`/student/courses`) — already had auto-fill responsive
     grids; added header-stacking utility classes.
  3. **Course detail** (`/student/courses/[id]`) — mobile drill-down
     (chapter list ↔ lesson player as separate screens), video+sidebar grid
     collapses to 1 column, action-chip row full-width, Ask-AI chat panel
     becomes a full-screen overlay on mobile.
  4. **Flashcards + AI Deck** components — were already largely responsive;
     added minor mobile padding/font-size trims.
  5. **Dashboard** (`/student/dashboard`) — already closely mirrored the
     desktop reference's `isDashboard` section (Performance ring/Today's
     Schedule/stat-strip/analytics). Added a greeting header ("Hi, {name} 👋"
     + date, using `usersApi.me()`) and a "Live Now" card (real
     `LIVE_LESSON` calendar events within a ±10/90 min window of now — only
     rendered when something is actually live), then made the existing grids
     responsive (`mobile-stack-grid`, `mobile-stat-strip` utility classes).
     **Deliberately skipped:** the reference's "Time Spent" hours card,
     attendance-trend chart, mentorship engagement-score ring, and promo
     banner carousel — none have a real backing data source in this app, and
     the project avoids fabricated metrics.
- **Calendar + Book a Mentor** (commit `557402d`): responsive retrofit, not
  a reimplementation of the mockup's day-strip layout — kept the existing
  month-grid `CalendarApp.tsx` (shared by faculty too) and mentor
  select/date-chips/time-slot-grid/booking-summary structure, just made them
  stack on mobile. `CalendarApp`'s `1fr 300px` grid and the mentor page's
  `1fr 320px` grid both get `.mobile-stack-grid` (existing utility) below
  860px. New utilities added to `globals.css`'s mobile block: `.calendar-
  day-cell` (shrinks month-grid cell min-height/padding/date-number font on
  mobile), `.mentor-slot-grid` (4→3 columns), `.mentor-summary-card`
  (drops the `position: sticky` so the dark booking-summary card doesn't
  pin oddly once it's stacked above/below the date pickers instead of
  beside them). Both page wrappers got `.mobile-page-pad`. No new mobile
  route/component — same pattern as the rest of this rollout.
- **Messages drill-down** (commit `9103fe8`): conversation list ↔ thread is
  split across two route segments (`/student/messages` list-empty-state +
  `/student/messages/[id]` thread), not local selection state, so the
  course-detail `has-selection` pattern doesn't directly apply. Fix:
  `student/messages/layout.tsx` checks `usePathname()` (`threadOpen =
  pathname !== "/student/messages"`) and toggles new `.messenger-list-pane`
  / `.messenger-thread-pane` classes (same display:none/flex swap as
  `.course-pane-list`/`.course-pane-detail`, just separately named since
  they're driven by route not state). `MessengerSidebar` gained an optional
  `className` prop; `MessengerThread` gained an optional `basePath` prop
  that — only when passed — renders a `.mobile-back-btn` Link back to the
  list. Faculty's `MessengerThread` usage doesn't pass `basePath`, so
  faculty (out of rollout scope) gets no back button and is otherwise
  unaffected; the CSS pane-toggle classes only apply where a page actually
  uses the `messenger-*-pane` classNames (student only).
- **Forum** (commit `ffc0752`): `ForumApp.tsx` already had list/thread/new
  switching via local `view` state with an always-visible "← All threads"
  back button (not gated to mobile, harmless on desktop) — no drill-down
  classes needed there. The only real mobile problem was the 240px fixed
  categories `<aside>` sitting beside the content in a flex row. Fix: new
  `.forum-shell` (flex row → column below 860px), `.forum-categories`
  (sidebar → full-width horizontal strip), `.forum-categories-list`
  (vertical button stack → horizontal scrollable chip row, each button
  `flex:none` + pill-shaped), `.forum-categories-label` (hides the
  "Categories" heading once it's a chip strip) — mirrors the mobile
  mockup's category-pill pattern. Search+New-thread row got
  `.mobile-stack-header`, content area got `.mobile-page-pad`.
- **Workout + Mock Test** (commit `54994c9`): Workout's Course/Chapter
  select pair gets `.mobile-stack-grid`; all 3 of its views (setup/
  session/done) get `.mobile-page-pad`. Mock Test list only needed
  `.mobile-page-pad` (card grid was already responsive auto-fill). The
  real work was the Mock Test **attempt** page's taking-view: a 3-column
  grid (sticky+maxHeight-clamped passage panel / question / question-
  palette sidebar) for comprehension questions, 2-column otherwise. Stacks
  via the existing `.mobile-stack-grid` utility; new `.mock-test-passage`
  rule strips the `position: sticky` + `max-height` clamp on mobile so the
  passage behaves like a normal block once stacked above the question
  instead of pinning to the scroll container's top. Previous/Save&Next/
  Submit button row got `flex-wrap`. Verified end-to-end live against a
  real comprehension mock test (passage + MCQ + palette + submit +
  results) — all 4 views (instructions/taking/results, + list) confirmed
  rendering correctly stacked on mobile.
- **Feedback + Profile** (commit `640ce39`): both already structurally
  mobile-friendly (single-column cards, `flexWrap` on the feedback-form
  list rows, `width:100%` form inputs) — only needed `.mobile-page-pad` on
  the `<main>` wrappers (feedback list, feedback fill-page, profile).
  Verified the allotted/submitted lists, the form-fill page (stars,
  textarea, submit), and the Profile form all render cleanly stacked.
- **Not yet started:** Subscription, Answer Correction. Faculty and Admin
  apps explicitly excluded from this rollout's scope for now.

**Segment onboarding gate + courses-page segment filtering** (commit
`a91da3c`, outside the mobile rollout — direct user request). New
`SegmentOnboardingGate.tsx` component, wired into `StudentShell.tsx`:
whenever the logged-in student's `profile.segmentId` is null, the entire
shell renders only this gate (a "select your class" form — segment, then
a conditional subsegment dropdown if that segment has any) instead of the
normal sidebar/topbar/page content, blocking every `/student/*` route
until they save via `usersApi.updateMe()`. `StudentShell`'s existing
profile-loading effect was refactored into a named `loadProfile()` so the
gate's `onDone` callback can re-trigger it and drop the gate once segmentId
is set. Also fixed `courses/page.tsx`: the catalog already relied on the
backend's per-student segment filtering (already correct), but "Continue
learning" (sourced from `enrollmentsApi.mine()`) had no segment filter at
all. Added `courseMatchesProfile()` (mirrors `CoursesService.listCourses`'
subsegment/segment match logic) and applied it client-side to the
enrolled-courses list only. Verified end-to-end live: cleared
vishnu@test.com's segment, confirmed the gate blocked every page, picked
Class 12 → NEET, confirmed save+unblock, confirmed `/student/courses` then
showed only the matching enrolled course (Biology) instead of all 5
previously-visible ones — then reverted the test account back to no
segment afterward.

**PDF viewer toolbar hidden** (commit `fe77ae1`) — lesson PDFs are
rendered via a plain `<iframe src={lesson.contentUrl}>`, which shows the
browser's native PDF.js toolbar (page nav/zoom/print/save/etc.) inside the
embed on both desktop and mobile. Appending `#toolbar=0` to the iframe
`src` (long-supported PDF.js param, works regardless of any existing
presigned-URL query string since it's a hash fragment) hides it. Applied
to all 3 places a lesson PDF is iframed: student lesson viewer
(`student/courses/[id]/page.tsx`), faculty lesson editor preview, admin
lesson editor preview. Verified live against a real PDF lesson — toolbar
gone, content renders directly.

**Dashboard fix + polish** (commit `3de7ace`, outside the mobile-rollout
sequence — user reported it directly): `ScheduleRow` in
`student/dashboard/page.tsx` only special-cased `LIVE_LESSON` and otherwise
assumed every event was a mentor session, rendering the literal string
"with undefined" for `CHAPTER_UNLOCK`/`TEST` events (which have no
`otherPartyName`) and using the wrong icon. Added `eventIcon()`/
`eventSub()`/`eventHref()` covering all 4 `CalendarEventType`s (mirrors
`CalendarApp.tsx`'s `EventRow` logic, but dashboard keeps its own
circular-icon visual style rather than importing that component). Also
restyled the Enrolled/Taken/Booked stat cards with a new `StatCard`
component using color-coded soft icon backgrounds (orange/blue/purple,
mirroring the nicer pattern already on `faculty/dashboard/page.tsx`)
instead of flat dark squares, and recolored the Book-a-Mentor CTA button
orange (was flat black) to match the app's primary-action color.
Follow-up (commit `46168b6`, user flagged via screenshot): that CTA is
icon-only on desktop (compact square next to the stat cards), but on
mobile `.mobile-stat-strip > button` spans both columns full-width with no
padding — looked like a thin orange bar with a tiny icon. Added a
`.mentor-cta-label` span ("Book a Mentor" text, `display:none` by
default) that's revealed only inside the `.mobile-stat-strip > button`
mobile breakpoint rule, plus real padding there, so it reads as a proper
labeled button on mobile while staying a compact icon square on desktop.
- **Bottom tab nav + chapter-list redesign** (new mockup screenshots supplied
  directly in-chat, not from the `design-reference/` dir — a course-overview
  + lesson mobile pair showing a bottom tab bar). Decisions confirmed via
  `AskUserQuestion` up front: (1) bottom nav (Home/Learn/Calendar/Inbox/More)
  is **global** across all student mobile pages, added to `StudentShell.tsx`
  alongside the existing hamburger/drawer (both coexist — hamburger top-left
  still opens the drawer for the long tail of nav items; bottom "More" opens
  the same drawer); (2) chapter list: only the chapter containing the
  selected lesson auto-expands, others stay tappable (existing accordion
  behavior kept); (3) "AI Deck" in the mockup is just the existing Summary
  Deck button, no new feature. Implementation: `.student-bottomnav-mobile`
  CSS class (fixed bottom bar, `display:none` by default, `flex` below
  860px, matches the existing `.student-topbar-mobile` pattern) +
  `.student-mainarea { padding-bottom: 60px }` at the same breakpoint so
  content doesn't sit under the bar. Course detail page
  (`/student/courses/[id]/page.tsx`) chapter sidebar restyled: dark
  gradient "ENROLLED COURSE" hero banner (title, chapter/lesson counts,
  progress bar — applies at all widths, not just mobile, since it's a
  straightforward visual upgrade), numbered circular chapter badges
  (number → checkmark when `chapter.finished`, orange-filled when it's the
  active chapter, lock icon when locked), "In progress · X/Y" status text
  computed from the active lesson's position within its chapter (no new
  backend field — derived client-side), and an orange "NOW" badge on the
  active lesson row in `LessonNavItem` (replaces the plain dot indicator
  when `active`). No backend/Prisma changes.
- **Verified via a discovered workaround for the viewport-resize limitation**
  (see gotcha above): logged in as `vishnu@test.com` in the actual Chrome
  extension session, confirmed the new banner/chapter/NOW-badge design
  renders correctly against live enrollment/progress data at desktop width
  (those styles aren't gated by the media query). For the genuinely
  mobile-only pieces (bottom nav bar, top app bar, drill-down screens),
  since `resize_window` and browser-shortcut key dispatch (`F12`,
  `ctrl+shift+m`, `ctrl+=`) are all no-ops in this environment, injected a
  temporary `<style>` tag duplicating the same `@media (max-width: 860px)`
  rules without the media-query gate, plus `document.body.style.zoom` to
  shrink the rendered frame for a clean screenshot, then removed both —
  confirmed all pieces render as intended against live data, then reverted
  the override (no permanent code change from this step). This forced-CSS
  technique is the new standard fallback for visually verifying mobile-only
  styles in this environment — prefer it over relying on code review alone.
- **Follow-up fix (commit `0e1f15b`):** the above shipped with a bug —
  course load auto-selects the first lesson (`coursesApi.get()` effect), and
  the mobile drill-down's pane-switch CSS (`.has-selection`) was driven by
  "is a lesson selected at all," so mobile users landed straight in the
  lesson player instead of the chapter list on every course open. Fixed by
  separating "a lesson is selected" from "the user explicitly opened a
  lesson": added `lessonOpenedByUser` state, an `openLesson(id)` wrapper
  (sets both the id and the flag — used by `LessonNavItem.onSelect` and the
  video-page chapter-sidebar mini-list) and a `closeLesson()` wrapper (clears
  both — used by the mobile back button). The `.has-selection` className on
  both panes now reads `lessonOpenedByUser` instead of `selectedLesson`.
  Desktop is unaffected (both panes always render there regardless of
  `.has-selection`, media-query gated). Initial auto-selection (course load,
  post-enroll) still uses the raw `setSelectedLessonId` so it never flips
  `lessonOpenedByUser` to true.

## Current Prisma data model (key models)

Pre-existing: `User(role)`, `Course→Chapter→Lesson→Flashcard/SummaryDeck`,
`Segment/Subsegment`, `QuestionBank→Question(+Passage)`, `Test→TestQuestion`,
`Enrollment`, `Batch/Messenger/Mentor/Feedback/Forum/Reports/Subscription/
Calendar/Todo` models.

New: `AnswerQuestionType`, `AnswerQuestionTypePart`, `AnswerQuestion`,
`AnswerQuestionPart`, `AnswerQuestionPoint`, `AnswerQuestionPointGroup`,
`AnswerQuestionForbiddenPoint` (enum `ForbiddenPointPenaltyType`:
NUMERIC|FLAG_HARD), `AnswerSubmission` (enum `AnswerSubmissionStatus`:
PROCESSING|GRADED|FAILED), `AnswerEvaluation` (Json snapshot fields +
`manual*` override columns). Migration:
`prisma/migrations/20260626140000_add_answer_correction/migration.sql`.

Also new: `Lesson.cheatSheetEnabled`, `CheatSheet` (`pages: Json`). Migration:
`prisma/migrations/20260626150000_add_cheat_sheet/migration.sql`. Both
hand-written, applied via `migrate deploy` (see gotcha above).

Also new: `Reflection` (`studentId`+`date` unique, `wentWell`/`toImprove`
nullable text — one journal entry per student per day, upserted not
appended). Migration:
`prisma/migrations/20260629180000_add_reflection/migration.sql`.

**Study Planner** (commit `787e520`, deployed) — new feature, not part of
the mobile-rollout sequence. Student gets a previously-disabled "Planner"
nav item now enabled, `/student/planner` with 3 tabs:
- **Weekly**: per-chapter "% lessons viewed" progress bars for a selected
  enrolled course, computed from real `LessonView` rows (no fabricated
  achievements/streaks — this project deliberately avoids displaying
  metrics with no real backing data, same reasoning as the dashboard's
  skipped "Time Spent"/attendance-trend cards). This required broadening
  `LessonView` recording from SEQUENTIAL-drip-only to every drip type
  (`recordLessonView` call in the course detail page, and
  `getCourseTree`'s `viewedLessonIds` computation in
  `courses.service.ts`) — previously that data only existed for
  SEQUENTIAL courses, since it was originally added just to gate the
  lesson-chain unlock check, not as a general activity signal. Each
  `Lesson` in `getCourseTree` now also carries a `viewed: boolean` field
  for any course type.
- **Reflection**: today's "what went well 🌱 / to improve 🎯" journal form
  (prefills if you already saved one today, since `Reflection` is one row
  per day) + a read-only list of past entries.
- **Tasks**: thin wrapper reusing the existing Todo API/model, scoped to
  today, mirroring `CalendarApp.tsx`'s `TodoPanel` (add/toggle/delete) —
  no new backend needed here.

Admin gets a new `/admin/planner` page ("Planner — Student Reflections")
— read-only list of every student's reflection entries (name/email, date,
went-well/to-improve text), searchable by student name, for mentor/
counselor oversight. No edit/delete from the admin side by design (scoped
via `AskUserQuestion` up front — admin's role here is "view/oversee",
not "manage prompts" or anything else).

Verified end-to-end: curl-tested the upsert (same date twice → one row
updated, not duplicated, confirmed via `GET /reflections/me` count),
confirmed `GET /reflections` (admin) includes student info, then exercised
the full UI live in the browser on both apps — Weekly progress bar
against a real enrolled course, Reflection prefill-on-reload, Tasks add/
toggle/strikethrough, and the admin oversight list. One leftover test
`Reflection` row (vishnu@test.com, today's date, "Finished chapter 1 and
2" / "Practice more MCQs") was **not** cleaned up — there's no delete
endpoint by design (reflections are meant to be a permanent journal, not
disposable like a to-do), so it remains in prod as harmless verification
data, same precedent as the orphaned test `CheatSheet` row noted below.

**Admin AI Models settings** (commit `61df750`, deployed) — new
`/admin/settings` page lets the admin pick a provider (OpenRouter/OpenAI)
+ optional model override independently for each of the 7 distinct AI
call sites: Flashcard generation, AI Notes generation, Summary Deck
generation, Cheat Sheet text, Cheat Sheet illustrations, Ask-a-doubt Chat,
Answer Correction grading. Scoped via `AskUserQuestion` up front: per-
feature granularity (not grouped by call-type), and selecting OpenAI
(not integrated yet) saves the preference but **errors clearly** on the
next call to that feature rather than silently falling back to
OpenRouter — this was an explicit choice over the alternative (silent
fallback), so don't "fix" the error into a fallback later without
checking with the user first.
- New `AiFeatureSetting` model (`feature` enum as the `@id`, one row per
  feature, upserted — no row means "use the env-var default", which the
  service also returns so the UI can show what a never-touched feature
  currently falls back to).
- `AiService.complete/completeVision/generateImage` all now take a
  required `feature: AiFeature` param and resolve the model via a new
  private `resolveModel()` (DB override → env-var default), throwing if
  the feature's provider is `OPENAI`. Every existing call site
  (`courses.service.ts`'s flashcards/notes/summary-deck/cheat-sheet
  generators, `chat.service.ts`, `answer-grading.service.ts`) was updated
  to pass its feature literal — **any new AI call site must do the same**
  or it won't compile (the param isn't optional).
- Verified end-to-end via curl (OPENAI provider → real call blocked with
  the expected message → reverted to OPENROUTER → same call succeeds) and
  live in the admin UI (dropdown, save, persistence across reload, "Not
  integrated yet" badge), then reverted the test change.
- **Follow-up (commit `fde6810`, user flagged via screenshot):** the
  Model field was a freeform text input that visually looked like a
  disabled placeholder box with no hint of what to type. Replaced with a
  `<select>` of curated model ids — `TEXT_MODEL_OPTIONS` /
  `VISION_MODEL_OPTIONS` / `IMAGE_MODEL_OPTIONS` arrays in
  `admin/settings/page.tsx`, picked per feature via `modelOptionsFor()` —
  defaulting to "Default (\<env fallback\>)", plus a "Custom…" option that
  reveals the old text input for anything not in the curated list. Only
  ids this app has actually exercised (`openai/gpt-oss-20b:free`,
  `nvidia/nemotron-nano-12b-v2-vl:free`, `google/gemini-2.5-flash-image`)
  plus a few other commonly-available OpenRouter free-tier models are
  listed — **not a verified-exhaustive catalog**, so if a curated option
  ever 404s like `qwen/qwen2.5-vl-32b-instruct:free` did historically,
  remove it from the array rather than assuming the whole approach is
  broken.

## Outstanding / known gaps

- **TODO (manual, user to do — "will change later"):** delete the dead
  `JWT_ACCESS_SECRET` env var from BOTH Vercel projects (web + admin) →
  Settings → Environment Variables. Unused by frontend code (only
  `NEXT_PUBLIC_API_URL` is read); already removed from local `.env.local`.
  No redeploy needed after removal since nothing references it. Flagged
  during the 2026-06-30 security review; left in place for now.
- Security review (2026-06-30) optional follow-up not yet done: login flow
  has a minor user-enumeration timing side-channel (early return when email
  not found skips bcrypt.compare) — low priority, harden with a dummy-hash
  compare if revisited.
- Answer Correction: PDF upload rejected (image-only for v1); free-tier
  vision model untested on real handwriting; no rate-limiting/abuse-control;
  no "My submissions" history page; multi-page answers not supported.
- Cheat Sheet: PDF-only (no video support yet, despite the original feature
  request describing video too — explicitly deferred); no extraction of
  images/diagrams from the source PDF (AI-generated illustrations only).
  **Illustrations status (current):** the earlier OpenRouter 402 block is
  RESOLVED — the OpenAI image path is now wired in and illustrations are
  re-enabled at `quality: 'low'` (~$0.01/image, ~$0.05/generation), switchable
  per-feature in Admin → Settings → AI Models (`CHEAT_SHEET_IMAGE`). Generation
  cost is real but capped low; the agent never triggers generations — the user
  controls regen cost (see [[billed-api-cost-caution]]). A muted "Illustration
  unavailable" note renders per-section on failure instead of a silent blank.
  Users can also upload their own finished poster image (never cropped) as an
  alternative to AI illustrations. One orphaned test `CheatSheet` row + a few
  R2 images remain attached to the real "Test Lesson" PDF lesson in Physics
  from end-to-end verification (harmless, but not cleaned up).
- Mobile UI rollout partial — see above. Faculty/Admin apps not in scope yet.
- **Editor hardening not yet applied to all editors:** the 2026-07-06 audit
  converted the question-bank editor (both apps) to silent `refresh()` + full
  error handling, but the **test** and **mock-test** editors (all 4 pages) still
  use `load()` inside mutation handlers (full-page blink) and lack try/catch on
  `onTogglePublished`/`onSaveTitle`/`onChangeType`. Same fix pattern applies.
- Prior-session gaps still open: no DB-level "comprehension group" beyond
  shared `passageId`, sequential lesson-gating simplification (display order ≠
  gating order), no custom domain, no payment gateway, no bulk/CSV import, no
  real notification center, student-side Feedback fill-page UI still not
  interactively browser-verified.
- **RESOLVED 2026-07-02:** PASS_TEST threshold is now per-test (`Test.passPercent
  Int @default(50)`, migration `20260702120000_add_test_pass_percent`); the old
  hardcoded 50% in `courses.service.ts` PASS_TEST completion now reads each
  test's `passPercent` (`score*100 >= maxScore*passPercent`). Editable via a
  "Pass mark" card on all 4 test/mock-test editors; student mock-test
  instructions + results show the pass mark and a Passed/Not-passed badge.
  Comprehension now IS supported on the student workout page: a "📖
  Comprehension" toggle includes passage-bound questions (backend adds an OR
  clause — standalone `passageId:null` of chosen types PLUS, when toggled,
  `passageId:{not:null}` comprehension sub-questions; workout now presigns
  question + passage images, which also fixed a latent bug where workout
  attached-images were served as raw R2 keys). Session view renders the passage
  in a scrollable block above each comprehension question.

## Roadmap status

All original roadmap phases complete. Post-roadmap work shipped since:
AI Answer-Correction, AI Cheat Sheet Generator (PDF-only v1), the
mobile-responsiveness initiative (student app, module-by-module, ongoing),
Study Planner, real OpenAI integration + per-feature Admin AI Model settings,
video captions/chapters, the detailed mock-test result dashboard, and the
question **tags + marks** workstream (global `Tag` model, marks-based scoring,
build-by-tag import, tag management, per-test `passPercent`, workout
comprehension). See the Changelog (newest first) at the bottom for the
commit-level detail on all of this.

## Cross-cutting rules for every phase

- Every delete handler starts with `useConfirm()`.
- Every new entity gets a matching `*Api` block in both
  `apps/admin/src/lib/api.ts` and `apps/web/src/lib/api.ts`.
- New admin/faculty list/grid UI follows the `.entity-card` +
  banner-gradient pattern.
- Curl-test every new endpoint against real Neon data before calling it done;
  confirm Render + both Vercel deploys are live afterward; clean up test
  data/scripts. Hand-write migration SQL (don't trust `migrate dev`); kill
  stray node processes proactively before assuming a hung migrate command is
  a real infra problem.
- Stop and resolve every ASK item with the user before building ambiguous
  parts — this user responds well to a small set of concrete multiple-choice
  decisions up front (via `AskUserQuestion`) before any code is written, for
  both new-feature scoping and large UI initiatives.
- **Error handling, input validation, and loading states are mandatory on
  every new push from 2026-06-30 onward** — bake them in as the feature is
  built, don't bolt them on later. Concretely: every data-fetch gets a
  `loading` state (and the existing "Loading…" / spinner treatment) and a
  `catch` that surfaces an `ApiError`-aware message in the UI; every form/
  mutation disables its submit button while in-flight (`saving`/`submitting`/
  `posting`) and validates required fields client-side before calling the API;
  every NestJS DTO carries `class-validator` decorators. The global
  `ValidationPipe` runs `{ whitelist: true, forbidNonWhitelisted: true,
  transform: true }` (set 2026-06-30, `apps/api/src/main.ts`), so unknown
  request fields are rejected with a 400 — keep frontend payloads to the exact
  DTO shape (never spread a whole entity into a write body).

## User & working style

Non-technical founder/owner, directs work via short/terse messages, sometimes
ambiguous, occasionally repeats an instruction verbatim (treat as "continue,"
not "restart"). Wants every feature curl-tested against real data before
being called done; deploys (push + Vercel ×2 + Render confirmed live) are
part of "done." Comfortable with direct production data seeding/cleanup via
curl/scripts. For large/ambiguous asks, responds well to being given a small
set of concrete multiple-choice decisions up front rather than being asked to
write requirements from scratch. Explicitly paces large initiatives
module-by-module / phase-by-phase rather than wanting everything built in one
shot, and expects to be asked which module is next rather than having the
agent pick the full remaining order unilaterally. Wants this context file
kept current automatically after every commit, rather than re-requesting a
full context dump.

---

## Changelog (newest first)

Keep this list current after every commit: add one newest-first bullet with the
commit hash; do NOT grow prose paragraphs. Deep detail on each feature lives in
the **Feature history** and **Current Prisma data model** sections above.

- **Pending (2026-07-06 audit, NOT yet committed):** order-tiebreaker + bank-question
  order-assignment fixes (`question-banks`/`tests`/`batch-status-types` services now
  assign `max+1` on create and sort `[{order},{createdAt}]`); question-bank editor
  hardening in both apps (silent `refresh()` instead of full-page `load()` on
  mutations, plus try/catch + `actionError` banner + in-flight `saving` guard on
  publish/title/add/edit/delete); this context file cleanup (missing commits added,
  Cheat Sheet illustration contradiction resolved, changelog restructured).
- `1af982c` (2026-07-02) — Admin nav consolidation: Batch Statuses moved into the
  Batches page; Tags moved into the Tests page. No backend change.
- `47dff1d` (2026-07-02) — Fix: the question-bank editor's edit-question save
  silently dropped `difficulty/marks/negativeMarks/answerTimeSeconds/tags` (write
  payload omitted them). Now sends the full `QuestionMeta` shape.
- `76c7566` (2026-07-02) — Per-test pass threshold (`Test.passPercent Int @default(50)`,
  migration `20260702120000_add_test_pass_percent`; PASS_TEST completion reads each
  test's `passPercent`) + comprehension support on the student **workout** page (OR
  clause for `passageId:{not:null}` sub-questions; workout now presigns question +
  passage images — also fixed raw-R2-key image bug). See known-gaps RESOLVED note.
- `24349fe` (2026-07-01) — Tags/marks follow-ups: import carries tags; tag management
  (rename/merge/delete + usage counts, `/admin/tags` + `/faculty/tags`, `PATCH /tags/:id`,
  `DELETE /tags/:id`, `POST /tags/:id/merge`); `QuestionMetaBadges` on all 6 editors;
  soft per-question timer (guidance only, never auto-advances); workout shows tags.
- `93c3bb9` (2026-07-01) — Build-by-tag import filter (all 4 test editors),
  `QuestionMetaFields` panels on test editors, student-side marks/tags display +
  fixed instructions screen (real total marks + dynamic marking note).
- `b1830ab` (2026-07-01) — Question tags + fields UI: tag picker + difficulty/marks
  in the question-bank editor (both apps), shared `QuestionMetaFields` component.
- `b6380fb` (2026-07-01) — Question tags + fields backend: global `Tag` model (m2m to
  Question + TestQuestion), `QuestionDifficulty` enum, `difficulty/marks/negativeMarks/
  answerTimeSeconds` on both; `GET/POST /tags`. Marks-based scoring (maxScore=sum(marks),
  +marks/−negativeMarks/0, clamped ≥0), backward-compatible (marks=1/neg=0 = old count).
- `8cc28a5` — Manual poster-image upload for cheat sheets (`CheatSheet.posterImageKey`,
  migration `20260701120000_add_cheatsheet_poster_image`); shown uncropped;
  `POST/DELETE /lessons/:lessonId/cheat-sheet/poster`.
- `fe3d46f` — Re-added AI illustrations into the single cheat-sheet poster at
  `quality:'low'` (~$0.01/image); prompt forbids in-image text.
- `f40a07d` — Redesigned Cheat Sheet as a single designed HTML infographic
  (`CheatSheetPoster` component); AI illustrations dropped at this step (re-added above).
- `3afd875` — Larger portrait cheat-sheet cards (removed clipping aspect-ratio) +
  surfaced illustration failures in the UI (`illustrationError` per page).
- `597d8ad` — Capped OpenAI image cost: pinned `quality:'low'` on `gpt-image-1`
  (default `auto`→`high` cost ~$3 in test calls). Standing rule: never make a billed
  provider call for testing without asking first ([[billed-api-cost-caution]]).
- `89830cb` — Real OpenAI integration alongside OpenRouter (`resolveModel()` returns
  `{provider, model}`; OpenAI uses `/v1/chat/completions` + `/v1/images/generations`;
  `OPENAI_API_KEY` in `.env` + Render).
- `1f3e833` — Video captions+chapters (`Lesson.captionsVtt`/`videoChapters`, migration
  `20260630200000_add_video_captions_chapters`) + detailed mock-test result dashboard
  (`GET /attempts/:id/review`: time/percentile/accuracy-by-type/per-question review).
- Two student-course bugfixes — course progress bar now from persisted `lesson.viewed`;
  PDF lessons no longer render mostly-black (`#toolbar=0&navpanes=0&view=FitH` + white bg + 85vh).
- Study-activity heatmap + mentor timeline on the student dashboard
  (`GET /enrollments/me/activity`, last 17 weeks bucketed by UTC date).
- Course-progress section on the student dashboard (status donut + animated per-course bars).
- Logout bug fix — `res.clearCookie()` had no options, so cross-domain
  `SameSite=None;Secure` cookies weren't dropped; shared `cookieBaseOptions()` now used
  for set + clear (`apps/api/src/auth/auth.controller.ts`).
- Student dashboard redesign — animated performance ring, exam-scores bar chart,
  score-trend chart, count-up stat cards, skeleton loader (bar charts use fixed-px
  heights per the flex-percentage-height gotcha).
- Pre-deploy security review + error-handling/validation/loading-state hardening
  (`b0dbd0b`, PR #2 → `594284a`): removed hardcoded JWT secret fallbacks (throw at
  startup if unset); group conversations validate participants against contact
  eligibility; `ValidationPipe` gained `forbidNonWhitelisted` (`906f655`).
  **ACTION STILL NEEDED (manual):** delete dead `JWT_ACCESS_SECRET` from both Vercel
  projects. Optional: harden login user-enumeration timing side-channel.
- `fde6810` — AI Models settings: freeform model text field replaced with a curated
  preset `<select>` (+ "Custom…" fallback).
- `61df750` — Admin AI Models settings: per-feature OpenRouter/OpenAI provider + model
  override (`AiFeatureSetting` model); selecting OpenAI errors clearly on next call
  rather than silently falling back (deliberate — don't "fix" into a fallback).
- `787e520` — Study Planner: student Weekly (per-chapter % lessons viewed from real
  `LessonView`) / Reflection (`Reflection` model, one row/day, migration
  `20260629180000_add_reflection`) / Tasks (Todo reuse); admin reflection-oversight page.
- `fe77ae1` (2026-06-29) — Hid the native PDF-viewer toolbar in lesson PDF embeds
  (`#toolbar=0`) across student/faculty/admin.
- `a91da3c` (2026-06-29) — Mandatory segment-onboarding gate (`SegmentOnboardingGate.tsx`)
  + courses-page segment filtering; supersedes the old "no-segment student sees all
  content" behavior.
- 2026-06-27 mobile rollout + fixes: Feedback+Profile (`640ce39`), Workout+Mock Test
  (`54994c9`), Book-a-Mentor CTA (`46168b6`), Today's Schedule "with undefined" bug +
  stat-card restyle (`3de7ace`), Forum (`ffc0752`), Messages drill-down (`9103fe8`),
  Calendar+Mentor (`557402d`), bottom tab nav + chapter-list redesign (`f4334ee`) +
  drill-down follow-up (`0e1f15b`); plus data-only Test cleanup + 5 new 30-Q banks +
  6-passage Comprehension Practice bank.
- 2026-06-26 foundation: mobile UI rollout (shell/course list/course detail/flashcards+
  deck/dashboard), Answer Correction feature, AI Cheat Sheet Generator, lesson/test/
  chapter order-tiebreak fix, Cheat Sheet 402 diagnosis, `load()`/`refresh()` no-blink
  fix, Comprehension mixed question types + passage-relative numbering.

*Last updated: 2026-07-06 (audit pass over the 2026-07-02 state, latest commit `1af982c`).*
