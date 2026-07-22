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

- **DEPLOY 2026-07-22 (2nd) — main `28004e6`, PR
  [#4](https://github.com/vishnurmohan99-lab/LMSv3/pull/4).** Fully verified, unlike the
  earlier deploy the same day.
  **The migration is what made the API build verifiable.** `prisma migrate deploy` only
  runs when Render starts the new build, so the appearance of
  `20260722130000_add_lessonview_report_indexes` in `_prisma_migrations` (finished
  12:33:17Z) plus both indexes in `pg_indexes` is proof the new API is serving — and it
  retroactively confirms the `b123606` deploy too, since this build contains it.
  **Reusable trick:** when a change has no migration and no unauthenticated route to probe,
  there is no way to tell a live Render build from a stale one. Grepping the deployed
  Vercel chunk for a new string covers the frontends; the DB covers the API.
  Web bundle `/_next/static/chunks/1ov408auqsm07.js` contains `in batch` and
  `batchEnrolledCount`. Admin was redeployed but its bundle is unchanged by this PR — the
  only admin edit was a TypeScript type, which is erased at build.
- **Reports performance + structure — the 7 findings left open by the review (2026-07-22).**
  **MIGRATION `20260722130000_add_lessonview_report_indexes`** — adds `@@index([studentId])`
  and `@@index([viewedAt])` to LessonView. NOT applied manually; Render runs
  `prisma migrate deploy` on start, so it lands on the next API deploy.
  `getSegmentBreakdown` no longer aggregates all of LessonView for a ranged report:
  finishing inside the window requires a *view* inside the window, so `course_progress`
  now restricts to students with a view since `from` (uses the new viewedAt index). "All
  time" genuinely needs every row and deliberately keeps the full scan.
  The score histogram moved into Postgres (`COUNT(*) FILTER`) — it was loading every
  submitted attempt into Node to produce five integers, and attempts are never pruned.
  Boundaries match the old `bucketForPct` exactly (`<=20/<=40/<=60/<=80/else`).
  The enrolment trend now fetches only the span the chart draws (`buckets[0].start`)
  instead of every enrolment ever, and `totalEnrollments` comes from a `count()`.
  `batch.findMany` for the completion ratio became two `count()` calls — note the old
  `batches.length` was already duplicating the existing `batchCount` query.
  **`getFacultyReport` is no longer N+1**: batches and attempts were two sequential
  queries *per course* (40 courses = 80 round-trips); both are now single queries over
  all courses, grouped in memory, with the segment/subsegment overlap deduped by batch id.
  Also drops a redundant `mockTests: { where: { courseId: { not: null } } }` — that
  relation is defined by `courseId`, so the filter could never exclude anything.
  Faculty batch chips renamed `enrolledCount` → **`batchEnrolledCount`** and now render
  as "N in batch": the number is the whole batch's enrolment, and batches are matched by
  segment, so the same batch shows under every course in that segment and the bare number
  read as a per-course count. Both api clients accept either name so a build can outrun
  the API. Quarter trend labels gain a `'YY` suffix when the window straddles New Year.
  Verified read-only against Neon: histogram matches the old JS bucketing on 16 synthetic
  percentages including exact 20/40/60/80/100/110 (live data has 0 qualifying attempts, so
  the synthetic test is the real check); the narrowed segment query returns byte-identical
  rows to the full-scan version on all 4 ranges; batch counts match; the faculty report is
  identical for the only faculty with courses (7 courses); the batch dedup passes 5 cases
  including the both-keys overlap, which live data never exercises.
  **Speedup is NOT demonstrated** — at 30 lesson views the narrowed and full-scan queries
  time the same (~255ms, all network). The rewrites are proven equivalent, not proven faster.
- **DEPLOY 2026-07-22 — main `b123606`.** First work in this repo to go through a PR
  ([#3](https://github.com/vishnurmohan99-lab/LMSv3/pull/3)) instead of straight to main;
  rebase-merged, so main gained `20fd140` (hardening) then `b123606` (review fixes).
  Vercel prod deployed manually for admin + web as usual. **Verified**: the live admin bundle
  (`/_next/static/chunks/0mqfa1h2vegjn.js`) contains both `NEW ENROLMENTS` and `isUnassigned`,
  so the newest commit is genuinely serving — not a stale build.
  **NOT verified**: which build Render is serving. `/reports/admin` is ADMIN-guarded and the
  API exposes no version marker (`/` returns a static "Hello World!", headers carry only a
  per-request `rndr-id`), so there is no unauthenticated way to tell the new API build from
  the old one. Confirm by loading the admin Reports page and checking the segment table header
  reads NEW ENROLMENTS with no all-zero "Unassigned" row.
  **Gotcha found:** pushing a *branch* re-enables Vercel preview builds, and they fail —
  `vercel.json` sets `deploymentEnabled: { main: false }`, which only disables `main`. The
  previews build from the repo root and then look for `.next/routes-manifest.json` there,
  but the output lives in `apps/{admin,web}/.next` (project Root Directory is unset). Harmless
  to the CLI deploy path, but every future PR will show two red checks until the Vercel
  projects get their Root Directory set.
- **Admin Reports: second review pass — self-contradicting rows, stale labels (2026-07-22).**
  Follow-up on the same PR; a whole-file review of the reports feature caught six defects,
  four of them introduced by the hardening commit below.
  **The segment table could contradict itself**: `enrollments` is filtered by enrolment date
  but `completions` counts any enrolment that *finished* in the window, so a row read
  "students 0, enrollments 0, completions 1" (reproducible on live data for Cllass 10 under
  Last 30 days). The data was right and the header was wrong — these are three independent
  event counts, not a funnel — so the columns are now **NEW STUDENTS / NEW ENROLMENTS /
  COMPLETIONS** with a caption saying the table counts events in the period. Fixed at the
  label, not by re-breaking the completions metric.
  **Tiles and CSV filename now read `report.range`, not the selected chip.** They differ
  while a switch is in flight and stay differing if it failed — the tiles were captioning
  stale all-time figures "last 30 days", and the CSV was named for a range it did not
  contain. (The cleanup flag added below covered `setReport` but not these two.)
  `trendLabel` is now **optional** in both api clients with a client-side fallback — admin
  (Vercel) and api (Render) deploy independently, so an admin build that lands first would
  have rendered a blank chart heading.
  The attempts query gained `maxScore: { gt: 0 }`. It previously used `maxScore || 1`, so a
  zero-question test would score 500% and land in the "81-100" bucket while the segment
  average (which requires `maxScore > 0`) dropped it — same rows, two answers on one page.
  Latent, not active: live data has 0 such attempts.
  CSV gained a **UTF-8 BOM and CRLF** terminators (Excel on Windows ignores the charset and
  mojibakes non-ASCII segment names — this is an Indian LMS, segment names are free text).
  The `__unassigned__` **magic string is gone**: the row now carries `segmentId: null` +
  `isUnassigned: boolean`, and only appears when an orphaned course actually saw activity
  (it was rendering as a permanent all-zero row and a junk CSV line).
  Verified: SQL still matches the old logic on ALL/QUARTER/YTD, `isUnassigned` returns a real
  boolean, the null-segmentId row shape is correct, and the zero-activity Unassigned row is
  gone from all four ranges. All three apps typecheck. Still NOT browser-verified.
  **Known and NOT fixed** (filed, not actioned): `course_progress` still full-scans LessonView
  every request with no index for its GROUP BY; the ALL trend still loads every enrolment row;
  `getFacultyReport` is still N+1 (two sequential queries per course); faculty `enrolledCount`
  is the batch's platform-wide total shown per-course.
- **Admin Reports hardening — code-review fixes on the range/segment/CSV work (2026-07-22).**
  No migration, no new endpoints. Fifteen review findings against the 2026-07-16 commit.
  API: `getSegmentBreakdown()` is now a **single `$queryRaw` Postgres aggregate** — the old
  version loaded the entire LessonView, Lesson, Course and Enrollment tables into Node and
  joined them there (unbounded memory; the LessonView query was not even range-filtered, so
  "Last 30 days" cost the same as "All time"). This is the **first raw SQL in the API** —
  everything else is the Prisma query builder — justified because a reporting rollup over
  every lesson view on the platform cannot be expressed as a Prisma aggregate (no joins in
  `groupBy`). It also removed an O(n²) array copy and an O(segments × rows) filter loop.
  **Completions semantics changed**: counted by *when the student viewed the course's final
  lesson*, not by enrolment date — previously a March enrolment finished in July was invisible
  under a short range, so "Completions" read near-zero on any mature platform.
  Courses with `segmentId: null` now roll into a synthetic **"Unassigned"** row (id
  `__unassigned__`) so the table's columns reconcile with the totals tiles.
  `rangeStart()` is UTC (`Date.UTC`) — YTD previously used the *server-local* Jan 1 while the
  other ranges used UTC ms arithmetic, so the boundary moved between Render (UTC) and a dev
  box. SQL boundary is passed as an ISO string cast `::timestamp` (the columns are `timestamp
  without time zone`; a raw JS Date is serialized by node-pg with the local offset).
  Trend chart buckets now **follow the range** (6×5-day bars for 30 days, 6×15-day for a
  quarter, Jan→now for YTD, 6 months for ALL) and the API owns the heading via a new
  `trendLabel` field — the chart was previously fed range-filtered rows under a hardcoded
  "last 6 months" axis, rendering five zeroed months.
  Admin UI: an error no longer replaces the page (header + range switcher always render,
  error is an inline banner with Retry, and `error` resets on each fetch — previously one
  transient 500 bricked the page until a reload, since the switcher itself was unmounted);
  effect cleanup flag so a slow request can't overwrite a newer fast one; CSV anchor is
  appended to the DOM with a deferred `revokeObjectURL` (Firefox/Safari cancelled the
  download) and `csvCell()` prefixes leading `= + - @` so a segment name can't execute as a
  formula in Excel; range chips are real `<button>`s with `aria-pressed` (were `<span
  onClick>` — keyboard-unreachable); tiles carry "all time" / range notes so global and
  range-scoped numbers are distinguishable; content dims while refetching.
  Also synced `apps/web/src/lib/api.ts`, whose duplicate `AdminReport` had drifted (missing
  `segmentBreakdown`/`range`).
  Verified against Neon: new SQL is **identical** to the old logic for ALL/QUARTER/YTD; the
  only diffs are RANGE_30 and they are the intended completions fix (Class 12 0→3, Cllass 10
  0→1). 261–326ms vs 1.5–1.8s for the old path even on a 30-row dataset. Separately checked
  the avgScore expression (64.4 for 7/10, 9/10, 1/3, returned as a JS number), the NULL-safe
  Unassigned join, and that the trend bucketer drops zero enrolments at the exact `from`/`now`
  edges and rolls over correctly at year boundaries. All three apps typecheck.
  NOT browser-verified — `/admin/reports` needs an admin sign-in.
- **Admin Reports: range switcher + by-segment table + CSV export (2026-07-16).**
  From the admin design audit — these were the "buildable today" Reports gaps (data
  already existed, just wasn't queried). No migration.
  API: `getAdminReport(range)` accepts `RANGE_30 | QUARTER | YTD | ALL` via
  `?range=` (`reports.controller.ts` whitelists the value, defaults ALL). `rangeStart()`
  maps it to a cutoff; enrolments AND attempts are both filtered by it. New private
  `getSegmentBreakdown(from)` returns per-segment `{students, enrollments, completions,
  avgScore}` — **completions = a student who has viewed every lesson of a course they're
  enrolled in**, derived from LessonView (no completion flag exists). Response gained
  `segmentBreakdown` + `range`.
  Admin UI: range segmented switcher, "↓ Export CSV" (client-side, quotes fields so names
  with commas survive, filename carries range + date), and a "By segment" table
  (SEGMENT/STUDENTS/ENROLLMENTS/COMPLETIONS/AVG SCORE, x-scrolls under 560px).
  `loading && !report` so switching range keeps showing prior data instead of blanking.
  `ReportRange`/`SegmentReportRow` added to the admin api client.
  Verified: ALL=9 enrolments vs RANGE_30=8 (one enrolment older than 30d), and switching
  to Last 30 days dropped "Cllass 10" to 0 — the range genuinely re-scopes. CSV captured
  in-browser and matched the table. NOTE: avgScore is "—" because every existing mock test
  has `courseId: null`, and the attempts query filters on `test.courseId != null`
  (pre-existing behaviour, not introduced here).
- **Real course difficulty — kills the fake `pseudoLevel()` catalog filter (2026-07-16).**
  **MIGRATION `20260716140000_add_course_difficulty` (already applied to Neon).** Adds
  `enum CourseDifficulty { EASY MEDIUM HARD }` and a **nullable** `Course.difficulty`.
  Nullable on purpose: existing courses are genuinely "not rated" rather than being
  defaulted into a level nobody chose.
  **This was the only gap that actively misled users** — the student catalog's LEVEL
  filter previously ran on `pseudoLevel()`, which hashed the course id into Easy/Medium/
  Hard, so students filtered by a difficulty that did not exist. `pseudoLevel` is now
  deleted from BOTH `student/courses/page.tsx` and `student/dashboard/page.tsx`.
  Behaviour: unrated courses show **no badge** and are **excluded** from level filtering
  (so a filter never claims more than it knows). Admin course edit modal gained a
  Difficulty select with a "Not rated" option; difficulty flows through create + update
  (`updateCourse` spreads the dto, so no service change was needed there).
  `CourseDifficulty` + `Course.difficulty` added to BOTH api clients (web + admin), and
  to the `update` Pick / `create` signature.
  Verified: set Maths=EASY / Biology=HARD via the API; a temp published course in the
  student's segment rendered the Medium badge with the right tokens (#a35a06 on #fdf0dd),
  filtering by Hard excluded it ("No courses match"), Medium included it; temp course then
  deleted. tsc clean on api + admin + web.
- **Flashcard SRS scheduling — closes the "no interval/scheduling model" gap (2026-07-16).**
  **MIGRATION `20260716120000_add_flashcard_srs` (already applied to Neon).** Additive:
  `FlashcardProgress` gains `intervalDays Int @default(0)`, `ease Float @default(2.5)`,
  `reps Int @default(0)`, `dueAt DateTime?`. The migration also backfills existing rows so
  KNOWN cards don't resurface instantly (interval 4 / due lastReviewedAt+4d) and LEARNING
  cards get 1 day.
  API: `scheduleFlashcard()` in courses.service.ts is an SM-2 style scheduler —
  AGAIN resets to a 10-minute learning step (ease −0.2, status LEARNING), HARD grows
  slowly (`interval*1.2`, ease −0.15, LEARNING), GOOD multiplies by ease (first success
  = 4 days, status KNOWN); ease clamped to 1.3–3.0. First-time intervals land on
  `<10 min / 1 day / 4 days`, matching the design. `setFlashcardProgress` now takes
  `{ grade?, status? }` — **grade is preferred, bare `status` kept as a legacy path** so
  older callers don't break. The flashcard list returns `intervalDays`, `dueAt` and a
  `preview {again,hard,good}` of human labels, so the client never re-implements the maths.
  Web: `flashcardsApi.grade()`; FlashcardReview replaced 2-way (Got it / Practice again)
  with the design's 3-way Again/Hard/Got it buttons carrying per-card interval sub-labels,
  plus NEW/LEARNING/KNOWN count pills that update live from the grade response.
  Verified against real data: a matured card walked 4→lapse→4→10→12 days across
  AGAIN/GOOD/GOOD/HARD; UI showed `Again <10 min / Hard 14 days / Got it 29 days` for that
  card and `5 days / 10 days` for the next one (labels are genuinely per-card); pills moved
  1 LEARNING→0, 2 KNOWN→3 on grading; 3 buttons fit one row at 375px, no overflow.
- **Closed the three "buildable today" API gaps: batch leaderboard, batch median, global search (2026-07-16).**
  From a full design-system audit of every `⚠ NEEDS API` marker. These three were flagged
  as blocked but were NOT schema-blocked — `Batch`/`BatchEnrollment` already existed.
  1. **Batch-scoped leaderboard.** `getLeaderboard(user, testId, scope)` + `?scope=batch`
     on the controller; new private `myBatchPeerIds()` helper (students sharing any batch
     with the caller). Response gained `scope` + `batchAvailable`; `batchAvailable:false`
     when the student is in no batch, so the UI says "you're not in a batch" instead of
     showing an empty board. Leaderboard page refetches on scope change; the ⚠ placeholder
     and its fallback copy are gone.
  2. **Batch median** on the Results trend. `getMyResults` now also collects batch peers'
     best scores per test and returns `batchMedianPercentile` (the batch's median score
     expressed as a percentile in the *same* full field, so it shares the chart's axis) +
     `batchAvailable`. Trend renders paired bars (orange = you, `--line` = batch median)
     with a combined tooltip; legend/median hidden when no batch.
  3. **Global search + ⌘K.** New `SearchModule` (`GET /search?q=`) over courses / tests /
     mentors — published-only, and courses scoped to the student's segment/subsegment
     (mirrors CoursesService) so search can't surface unopenable content. StudentShell's
     header input became a real debounced (220ms) typeahead with a results dropdown
     (CRS/TEST/MTR chips → course/mock-test/mentor routes), a ⌘K hint, and a
     window-level ⌘K/Ctrl-K focus shortcut. `searchApi` + `SearchHit` added to the client.
  Verified: `?scope=batch` returns the batch-filtered field, search `q=phy` → Physics,
  trend shows 5 paired bars with tooltip "you 0th · batch median 50th", ⌘K focuses the
  input, no horizontal overflow at 375px. tsc clean on web + api.
  (Testing note: React maps `onFocus` to the bubbling `focusin` event — dispatching a raw
  non-bubbling `focus` in a browser-automation check will NOT open the dropdown.)
- **Mock Test: align taking + results views to S3 (2026-07-16).**
  Third of the three requested screens; an alignment of the existing
  `mock-test/[testId]/page.tsx` (not net-new — data was already present).
  Taking view: header now shows the test title (+ a "Comprehension" pill for passage Qs);
  new per-question meta row = `Q x/N` mono chip · difficulty pill (Easy/Med/Hard from
  q.difficulty) · `+marks` (green) / `−neg` (red) mono chips · "avg. time on this Q"
  (when answerTimeSeconds set); options gained A/B/C/D lettered key circles (orange when
  selected); palette cells now use solid fills (green=answered, purple=marked, white=
  unanswered) with an ink ring on the current Q; palette legend gained live counts
  (Answered/Unanswered/Marked · N) and a SECTION TIME progress bar (TIMED tests only, via
  `totalSeconds = durationMinutes*60`). Results view: added the S3 "All / Wrong only /
  Skipped" review filter (with counts) above Question review; badges keep the real
  question number (`origIndex`) after filtering.
  Verified live: Q-chip "Q 1-a / 36", Medium pill, lettered keys, answering flips the
  palette cell green + bumps "Answered · N" + turns the key orange, review filter shows
  Wrong-only=1 correctly, no horizontal overflow at 375px. tsc clean. Pure frontend — no
  API change.
- **Results & Analytics: standalone screen (Design System screen 1) (2026-07-16).**
  Second of three requested screens (Mock Test S3 still to do). New route
  `app/student/results/page.tsx` + `.ra-*` in globals.css + a "Results" nav item
  (ResultsIcon) in StudentShell between Mock Test and Answer Correction.
  **New backend endpoint** `GET /results/me` (`getMyResults` in test-attempts.service.ts,
  route in the controller) → `{ attempts, subjects }`: every SUBMITTED attempt across all
  tests (title, date, score, scorePct, accuracy, timeSeconds, and percentile within that
  test's best-per-student field), plus accuracy-by-subject aggregated from answer→question
  tag rollup. Web api client gained `myResults()` + `MockResult`/`SubjectAccuracy`/
  `MyResults` types.
  Screen: range switch (30/90/All time, filters by submittedAt), 4 KPI tiles (tests taken,
  avg percentile + first→latest delta, best score %, avg accuracy), a **Percentile trend**
  bar chart (Your score real; **Batch median is ⚠ NEEDS API** — flagged in the legend, no
  batch model), Accuracy-by-subject bars (real from tags; "no tagged questions" fallback
  when a test's Qs are untagged), a data-driven Focus recommendation (weakest subject),
  and a Recent-attempts table (TEST/SCORE/PERCENTILE/ACCURACY/TIME + Review link).
  Verified on real data (3 Comprehension attempts: percentiles 0/50/0, accuracy 100/43/14%,
  KPIs computed correctly), range switch toggles, mobile drops KPIs to 2-up + stacks the
  split + scrolls the table, no horizontal overflow. tsc clean on web + api.
  (Heads-up: a stale `.next/dev` cache from a killed dev server can make `tsc` report
  errors in generated `routes.d.ts`/`validator.ts` — `rm -rf apps/web/.next` clears it.)
- **Leaderboard: standalone screen (Design System screen 3) (2026-07-16).**
  First of three requested screens (Mock Test S3 + Results & Analytics still to do).
  New route `app/student/mock-test/[testId]/leaderboard/page.tsx` + `.lb-*` in globals.css;
  linked via a "Full leaderboard →" button added to the embedded leaderboard on the
  results view. Layout matches the design: header + `<test> · N attempts` + All learners /
  My batch segmented toggle, podium (top 3 cards, gold/silver/bronze medal tints), a
  "You" pinned row when outside the top 20, and a RANK/LEARNER/SCORE/ACCURACY/TIME table.
  **Backend extended:** `getLeaderboard` (test-attempts.service.ts) now returns `accuracy`
  (correct/answered on the best attempt, derived in one pass over answers) and
  `timeSeconds` (submittedAt−startedAt) per entry, and returns top 20 (was 5); added those
  two fields to `LeaderboardEntry` in web `lib/api.ts`.
  **Known data gaps (deviations from the mockup, no source):** per-row **city** (no field
  on User) is omitted; the **"My batch"** scope has no backend — the toggle renders the
  design's "⚠ NEEDS API" note + a fallback message and keeps "All learners" as the live
  view. The mockup's "▲ Up N places since Mock 13" is omitted (no cross-test history).
  Verified against real data (Comprehension test: 2 ranked attempts, accuracy 43%/30%,
  times 58s/29s), batch toggle shows the notice + hides the podium, mobile stacks the
  podium and the table scrolls in its own container, no horizontal overflow. tsc clean.
- **Course detail: sidebar CONTENT rewritten to match S2 (2026-07-16).**
  Follow-up to the sidebar-position flip — the position matched S2 but the content was
  still the old accordion (expandable chapter cards, circle-numbers, chevrons). Replaced
  with S2's flat list: `app/student/courses/[id]/page.tsx` + `.cd-section-head` /
  `.cd-lesson-row` in `globals.css`.
  Mono `CH n · TITLE · status` section headers (`· locked` / `· done` / `n/n done`);
  36×24 mono type chips (VID purple, PDF blue, QZ teal, LIVE pink, CARD orange — greyed
  when locked); right-side state glyphs (green ✓ viewed, orange ▶ ring active, empty ○
  ring to-do, lock icon); NOW badge + orange-soft bg + 3px orange left border on the
  active row; a bottom full-width "Continue →" button (shown only when there's an
  unviewed lesson). Tests render as `QZ` rows linking to `/student/mock-test/:id`.
  Removed as dead code: `LessonIcon`/`LessonNavItem`/`TestNavItem` helpers, `ChapterTest`
  type, `expandedChapterId` state — all only served the accordion.
  **Bug fixed:** the active row's 3px orange left border wasn't rendering — a later
  `border: "none"` in the same style object was resetting the earlier `borderLeft`;
  split into per-side border resets so only the left one is meaningful.
  Chip colours are a deliberate departure from the mockup (VID/PDF look near-identical
  lavender there) — colour-coded per type for scannability; revert to a single
  colour in `CHIP_META` if exact-match is wanted instead.
  Verified: 3 section headers / 15 rows on a real course, chip geometry pixel-matches
  (36×24/r7/#f5f2ff/#5a2ed6 mono), active row border+badge correct after the fix,
  Continue jumps to the next unviewed lesson and disappears once all are viewed, QZ
  row links correctly, no horizontal overflow at 375px. tsc --noEmit clean.
- **Course detail: match S2 layout — sidebar to the RIGHT (2026-07-16).**
  Completes the one structural gap left from the ①②③ pass. `app/student/courses/[id]/page.tsx`
  + `.course-pane-*` in `globals.css`. The course-content sidebar moved from LEFT to
  RIGHT (flex `order:2`, width 286→340, `border-left`; player pane `order:1`), matching
  S2's `1fr/340px`. Per user decision, three app-only elements were REMOVED: the dark
  "Enrolled Course" card, the "Rate course" box (**and its now-dead `CourseRatingCard`
  component, ~90 lines — students can no longer rate a course from this page**), and the
  beside-video lesson list (the VIDEO-multi branch collapsed to the plain `LessonViewer`,
  so the video spans the full player column for all types). Lesson meta kept simple (no
  faculty/rating enrichment — user's call). Mobile drill-down unchanged (class-based, not
  DOM-order based): `.course-pane-list` mobile rule `border-right:none`→`border-left:none`,
  orphaned `.lesson-video-grid` rule dropped. NOTE: flip done via flex `order`, so
  keyboard tab order still follows DOM (sidebar-then-player) — reorder the DOM if visual
  and tab order must match.
- **Course detail: implement Design System S2 markers ①②③ (2026-07-16).**
  The designer annotated "S2 · COURSE DETAIL + LESSON PLAYER" with the exact deltas from
  the gap analysis. `app/student/courses/[id]/page.tsx` + `.cd-*` in `globals.css`.
  ① Course progress + "Continue →" in the lesson header (track 120×6 `--line2` r999,
  fill `--progress`, % in `--green` mono). Continue targets the first unlocked+unviewed
  lesson via `nextLesson`, and hides once everything is viewed.
  ② "⤓ Resources" — downloads the lesson's own presigned `contentUrl`; only rendered for
  VIDEO/PDF (LIVE/FLASHCARD have no file).
  ③ "Chapters" heading → "Course content" + `viewedCount/allLessons.length`; per-chapter
  meta now "5/8 done" instead of "N lessons".
  ④ Flashcards → 3-way SRS: **NOT DONE — user decided to keep flashcards as-is.** The
  design itself stamps it "⚠ NEEDS API — no interval/scheduling model" (only three flat
  statuses NEW/LEARNING/KNOWN exist, nothing schedules intervals).
  **Untouched on purpose** (the design says so explicitly): the lesson tab-strip internal
  scroll and the PDF "Open PDF" fallback — both are earlier deliberate fixes; verified
  still intact. On mobile `.cd-progress` is hidden (the sidebar card already shows the
  same %). KNOWN DIFF (not a marker, left alone): the design puts the course-content
  sidebar on the RIGHT (`1fr/340px`, border-left); the app has it on the LEFT, and
  flipping it would also mean reworking the mobile drill-down CSS.
- **Planner redesigned to match Design System screen 4 (2026-07-16).**
  The design was previously STALE — it showed a "Weekly" tab (per-chapter % bars) that
  `a707d79` had already replaced with Timetable (Study Plan: batch timetables + personal
  `planApi` items), and the design had zero mention of "timetable". The designer has now
  redrawn it as **"4 · PLANNER — Timetable (Month · Week · Day) / Reflection / Tasks"**,
  matching reality, so the app follows the new design rather than regressing to Weekly.
  `app/student/planner/page.tsx` + `.tt-*` / `.pl-*` rules in `globals.css`.
  Timetable: Month·Week·Day segmented switcher, ‹ › range nav + label, 5-type legend;
  Week = 7 clickable day columns of cards (type chip + ✕ + 2-line-clamped title +
  "time · by"); Month = 42 cells with chips + today pill + "Tap a date to open its day
  view."; Day = "time · chip · title · by · ✕" rows with a dashed empty state. "Add your
  own plan" now takes its date from the grid selection ("adds to <day> · pick any date
  above to change") with TYPE + TIME chip rows replacing the old date/time inputs.
  TIME presets (06:00/09:00/14:00/19:00) are a local choice — the design only shows four
  placeholders. Reflection: 2-col (1.15fr/.85fr) warm gradient card
  (#fffdf6→#fff6ef, #ffd0ac border) with a "✓ Saved" pill + Past-entries column.
  Tasks: add-row + black "+ Add" above a bordered list card ("Today | N left", ✕ delete,
  "All clear — add your first task above 🌤" empty).
  **Two bugs fixed:** (1) week/day labels rendered "Week of 13–Jul 19" because a
  month-first locale reorders parts — now built by hand ("13–19 Jul", month-spanning
  "29 Jun–5 Jul"). (2) **Reflections were saved to the previous day** east of UTC:
  `ReflectionsService.dayOnly` truncates to UTC midnight but the client sent LOCAL
  midnight (IST 16 Jul 00:00 = 15 Jul 18:30Z → filed as 15 Jul), so today's entry never
  pre-filled and appeared under "Past entries". Client now sends UTC midnight of the
  local date (`utcDayIso`) and reads back UTC parts (`utcDayKey`/`utcDayLabel`). Todos
  are unaffected (TodosService stores the raw instant, no truncation).
  **KNOWN DATA ISSUE:** reflection rows written before this fix are still stored one day
  early — a one-off migration would be needed to correct them.
- **Calendar redesigned to match Design System screens 5 / 5m (2026-07-15).**
  `components/calendar/CalendarApp.tsx` + `.cal-*` rules in `globals.css`. Shared by
  student AND faculty (the design is explicitly "shell-agnostic"), so both changed.
  Desktop (screen 5): one card split `1fr/300px` by an internal divider (was two separate
  cards + gap), radius 24, `--bg` body / white right rail. Month cells now render labelled
  event chips (`600 10px`, soft tint + 3px left border, radius 4, ellipsis; live chips
  pulse via `dotPulse`) instead of dots; day number moved top-right with today as a 24px
  orange pill in mono. Agenda rows are white + 1px `--line` + a 3px colour bar (was tinted
  bg + icon + type label) with a "· done" + green ✓ past state. Mobile (5m): stacks to one
  column, divider moves to bottom, 44px centred cells, chips collapse to dots, legend
  hidden, and the LIVE card reflows to a single row (`● LIVE | title | time · who | Join`).
  Right rail keeps To-do + Upcoming stacked under the agenda (user's call — the design
  shows agenda only, but both are wired to real APIs).
  **Bug fixed:** `eventColor()` returned `--orange` for `LIVE_LESSON` while the legend
  drew Live as `--live` — live events showed orange dots under a pink key. All type colours
  now derive from one `EVENT_STYLE` map that the legend also reads, so they can't drift.
  Unlock moved to `--progress` (#14b077) per the design. NOTE: mentor `#ece6ff` and test
  `#fff6ef` chip tints are design-sourced literals, deliberately deeper than
  `--purple-soft`/`--orange-soft` (which wash out at 10px) — promote to tokens if reused.
- **Login UX (show password + remember me + 3-day session) & course-page mobile fixes (2026-07-14).**
  Login page (`apps/web/.../(auth)/login/page.tsx`): added a Show/Hide password toggle
  and a "Remember me on this device" checkbox (default checked). "Remember me" now
  controls token storage in both frontends' `lib/api.ts`: checked → `localStorage`
  (persists across restarts), unchecked → `sessionStorage` (cleared when the tab/browser
  closes); a silent refresh writes new tokens back to whichever storage the session lives
  in. Session lifetime shortened to **3 days**: `REFRESH_TOKEN_TTL` `'7d'→'3d'` in
  `auth.service.ts` + matching `REFRESH_COOKIE_MAX_AGE_MS` in `auth.controller.ts`.
  Course page (`apps/web/.../student/courses/[id]/page.tsx`): fixed horizontal
  "screen slides left" overflow — the lesson tab strip (Overview/Flashcards/Cheat
  Sheet/Doubt) was wider than a phone and pushed the whole pane sideways; it now scrolls
  internally (`.lesson-tabbar` `overflow-x:auto` + hidden scrollbar, tabs `flex:none`),
  the content scroller is clamped (`overflowX:hidden` + `maxWidth:100%`). PDF lessons now
  render inside a `maxWidth:100%` wrapper and gained an "Open PDF" link (native full-screen
  viewer) since inline PDF-in-iframe is unreliable on iOS Safari. Verified at 375px:
  document no longer overflows X, tab strip scrolls internally, tokens land in
  sessionStorage when remember unchecked; all three apps `tsc --noEmit` clean.
- **Fix: mobile login didn't work + broken auth-page layout on mobile (2026-07-14).**
  Two issues on `/login` (and `/register`): (1) the `(auth)` layout was a two-column
  flex split (purple hero + form) with no responsive rule, so on phones both columns
  squeezed into unreadable half-width strips — now the hero is hidden below 860px and
  the form fills the screen (`apps/web/.../(auth)/layout.tsx` + `.auth-*` rules in
  `globals.css`). (2) Login succeeded but never persisted on mobile Safari/Chrome
  because the session is a cross-domain (vercel.app↔onrender.com) **third-party cookie**,
  which those browsers block by default. Fix: **token-based auth alongside cookies**.
  API now returns `accessToken`/`refreshToken` in the login/register/refresh body and
  the JWT strategies accept the token from the `Authorization: Bearer` header OR the
  cookie (`ExtractJwt.fromExtractors`). Both frontends' `lib/api.ts` (duplicated — web
  + admin) store the tokens in `localStorage`, send the access token as a Bearer header
  on every request (incl. the raw `enrollCsv` fetch), refresh via a Bearer refresh
  header, and clear on logout. Cookies remain as a fallback; CORS already reflects the
  `Authorization` header. Verified locally: header-only `/auth/me` and `/auth/refresh`
  → 200 with cookies omitted, browser login stores tokens + reaches dashboard; all
  three apps `tsc --noEmit` clean. NOTE: this is the interim fix; a shared custom
  domain remains the cleaner long-term option.
- **Fix: monorepo build failed on Vercel — API Prisma client not generated (2026-07-14).**
  A Vercel project builds from the repo ROOT, running the root `build` (`web && admin &&
  api`). `apps/api`'s build was just `nest build` — no `prisma generate` — so the API
  failed with hundreds of `Cannot find module '../../generated/prisma/client'` /
  `Property X does not exist on PrismaService` errors (web+admin compiled fine). Render
  only worked because its buildCommand runs `prisma generate` first. Fix: `apps/api`
  `build` is now `prisma generate && nest build` (self-sufficient wherever it runs;
  harmless double-generate on Render). Also added a **root `vercel.json`** with
  `git.deploymentEnabled.main: false` to stop that redundant repo-root project from
  auto-deploying (there are now root + apps/web + apps/admin vercel.jsons, all disabling
  main auto-deploy → CLI is the single deploy path). Verified `npm run build` (full root)
  exits 0.

- **Deploys are now CLI-only (2026-07-14, `86c9f8f`).** Vercel's Git integration was
  auto-deploying BOTH projects (web + admin) on every push to `main`, racing the CLI
  deploys and producing failing "0/2" commit checks. Disabled Git-triggered deploys for
  `main` via `git.deploymentEnabled.main: false` in `apps/web/vercel.json` +
  `apps/admin/vercel.json`. **The ONLY deploy path now is the CLI:** from the app dir run
  `npx vercel --prod --yes` (web from `apps/web`, admin from `apps/admin`). CLI/manual
  deploys are unaffected by the setting. To re-enable auto-deploy later, flip those flags
  to `true` (and fix the underlying monorepo cross-trigger — each project rebuilt on the
  other's changes; a per-project `ignoreCommand` git-diff would scope that).
- **PWA SW registration race fix (`79f6383`).** `ServiceWorkerRegister` waited for the
  `window` `load` event, which had already fired on fast loads so the SW never registered;
  now registers immediately when `document.readyState === "complete"`. Verified live: SW
  active + controlling the page on the prod alias.

- **Student app is now an installable PWA (2026-07-14).** apps/web only (student+faculty
  web app). Added: `src/app/manifest.ts` (→ `/manifest.webmanifest`, standalone display,
  theme #f26a1b, bg #faf8f6), generated icons in `public/icons/` (192/512/maskable-512 +
  apple-touch-icon 180, orange square + white play triangle via a one-off sharp script),
  `public/sw.js` (conservative service worker — same-origin GET only, so the cross-origin
  API is never cached; navigations network-first w/ `/offline` fallback; `/_next/static` +
  `/icons` cache-first), `src/components/ServiceWorkerRegister.tsx` (registers on window
  load, **production only** — dev SWs break HMR), `src/app/offline/page.tsx`, and
  PWA/`viewport` metadata (manifest link, appleWebApp, apple-touch-icon, theme-color) in
  `layout.tsx`. Verify PWA on the Vercel prod deploy, not localhost (SW is prod-gated).

- **Admin edit-in-modal conversion (2026-07-14, `4925d46` + type-fix `c23e87a`).** Every admin entity's
  "Edit" now opens a Design-System `Modal` popup editing the entity's full own-settings,
  instead of inline row-edit or navigating to the detail page; each card/row keeps a
  separate "View" (eye) affordance to reach the builder/detail page. Converted:
  **Courses** (title, description, banner, type, price[PAID], duration, dripType,
  completionRule[SEQUENTIAL], published — was a detail-page link), **Segments** (name +
  banner — was inline), **Sub-segments** (name — had no edit before; new EditIcon in
  `segments/[id]`), **Tests** (title, description, banner, type, publishMode + TIMED
  window/duration, passPercent, published — was inline), **Question banks** (title,
  description, banner, published — was inline), **Subscriptions** (title, description —
  card restructured Link→div+View/Edit footer), **Batches** (name, status, start/end
  dates, faculty; segment fixed at creation — card restructured), **Notes banks** (title,
  batch assignment, published — new edit modal, card gained View/Edit/Delete footer).
  Verified live on the admin app (each modal opens prefilled + saves) with no console
  errors. Deployed via `npx vercel --prod` from apps/admin (Vercel git auto-deploy still
  stalled). Also: earlier this session the web gate-consolidation fix (`5c5d39c`) and the
  Ascent student-screen pixel-match pass were deployed via CLI.

- **Ascent Design System pixel-match pass (2026-07-09 → 07-10).** New `Design System/`
  mockup export (`.dc.html`) replaced the old `design-reference/` folder (`5a9b53a`
  removed old, `e32dbe0` added new; `a67f9dc` added `Student Screens 3.dc.html` for the
  three previously-undesigned screens Feedback/Faculty Notes/Profile). Student web+mobile
  pixel-matched to the mockups, one screen per commit, each verified live and deployed:
  - `cd09c3d` — Login/Register (purple gradient brand panel + testimonial) + Course-detail
    **tab-strip rebuild** (Overview/Flashcards/Deck/Cheat Sheet/Notes/Doubt built from each
    lesson's enabled features; Notes + Doubt-chat moved inline into their own tabs).
  - `edc4dc3` — Catalog: added Level/Rating/Duration filter facets + active-filter chip row.
  - `a450390` — Mock Test: mark-for-review toggle + clear-response + purple palette state;
    Subscription: bundle cards restyled (elevated, checkmark list, CURRENT PLAN badge).
    Did NOT build the mockup's fixed 3-tier pricing/switch flow — no price field on the
    admin-defined `Subscription` model.
  - `0e8d6de` — Feedback (white-active tab pills, emoji chip icons) + Profile (avatar
    header, larger fields, orange CTA). Faculty Notes already matched.
  - `4518fd1` — Calendar: square nav buttons, Live/Mentor/Test/Unlock legend, "N events"
    count, dark LIVE-NOW card for currently-live events. Messenger already matched, left as-is.
  - `1ddf100` — Forum: vertical category sidebar → horizontal chips; thread list as rows in
    one card; derived HOT badge (≥5 replies); "answered"/green-border MENTOR replies from
    real post author role. Removed dead `forum-shell`/`forum-categories` CSS.
  - `7e22f16` — Workout: step-header ("Ungraded practice" badge + 3-dot indicator), count
    chips (was slider), orange CTA, session progress bar, "Nice reps 💪" done screen. No
    difficulty filter — workout API only supports chapter/types/count/comprehension.
  - `43afa02` — Planner: pill-toggle tabs → underline tabs, title "Study Planner"→"Planner"
    (no dark variant — app has no dark-mode toggle). Mentor: mentor **card grid** (MENTOR
    badge) replacing dropdown, dow/num day chips, dashed no-slots card, green "Session
    booked!" success state in the dark summary. No exp/rating chips — not on `Mentor` model.
  - `a8eb4a7` + **gate-consolidation follow-up** — Storefront Selector: catalog's static
    "Scoped to {class}" is now an interactive class/track pill + two-column popover (YOUR
    CLASS / TRACK) that **persists** the switch via `updateMe` and re-scopes the app (the
    only honest behavior — students can't browse other classes' courses server-side).
    Onboarding: `a8eb4a7` wrongly ADDED a duplicate `OnboardingGate.tsx` in the student
    layout — there was already a `SegmentOnboardingGate.tsx` wired into `StudentShell`
    (`a91da3c`). Follow-up fix: ported the mockup's 2-step class→track tile design INTO the
    existing `SegmentOnboardingGate` (keeps its `onDone`→`loadProfile` callback, no full
    reload), deleted the duplicate `OnboardingGate.tsx`, reverted the layout wrapper.
  - **Ops:** Vercel git-integration auto-deploy stalled this session (last auto-deploy was
    a day stale); deployed each commit manually via `npx vercel --prod --yes` from
    `apps/web`. Added `apps/api` to `.claude/launch.json` for local preview. **Remaining
    student mockup: Answer Correction — Student.** Then all remaining screens are
    admin/faculty (deprioritized per user — student web+mobile first).

- **Study Plan feature + course-image fix (2026-07-08).**
  - **Course image now editable** (`85d967f`, deployed): thumbnail could only be set at course
    CREATE — added a "Course image" upload/replace card to admin + faculty course settings
    (`courses/[id]`). Sets `thumbnailUrl` → already presigned in listCourses/getCourseTree, so it
    now shows on dashboard/catalog/detail (everywhere the course appears). Also hardened
    `onSaveChapterEdit` (both apps) — it had no catch, so failed saves silently did nothing.
  - **Study Plan** (scope via AskUserQuestion: **specific dates · linked to real resources ·
    managed in the Batch page, merged timetable for students**). Replaces the planner's old
    "Weekly" (per-chapter %) tab with a **Timetable**. Data: `StudyPlanItem` (scheduledFor, type
    enum VIDEO/NOTES/TEST/PRACTICE/OTHER, title, denormalized `resourceKind`/`resourceId`/`courseId`
    link so deleting a resource never breaks the plan, owner = `batchId` XOR `studentId`), migration
    `20260708120000_add_study_plan`. Module `apps/api/src/study-plan/`: batch-plan CRUD
    (FACULTY/ADMIN, faculty gated to `Batch.facultyId`), `GET /plan/mine?from&to` (student, merged
    batch-items-from-my-batches + personal, with `source` flag), personal create, owner-checked
    update/delete. Frontend: `planApi` both clients; admin `BatchStudyPlan.tsx` dropped into the
    Batch detail page (add item: type/title/date/time + course→chapter or test link); student
    Planner Timetable tab (week nav, day-grouped, batch+personal merged, click-through via
    `planHref`, add-your-own personal items). Reflection + Tasks unchanged.
    **FACULTY-SIDE GAP:** backend allows faculty, but there's no faculty batches UI in `apps/web`
    yet — faculty can't reach the batch plan editor. Follow-up: add `/faculty/batches`.
    API + migration deploy via Render; web + admin build clean.
- **Notes Bank / "Faculty Notes" feature (2026-07-07).** New: admin+faculty create notes
  banks (like question banks); each bank is shared with **one or more batches** (m2m); each
  note is an **uploaded file** (PDF/image) tagged to a course + optional chapter. Students get
  a **"Faculty Notes"** tab that lists notes from banks shared with their batches, searchable
  by name and filterable by course/chapter. Scope chosen via AskUserQuestion (file uploads /
  admin+faculty authoring / m2m batches). Data model: `NotesBank` (title, published, createdBy),
  `NotesBankBatch` (join), `Note` (name, fileUrl R2 key, fileName, courseId, chapterId?, order);
  migration `20260707140000_add_notes_bank`. Backend module `apps/api/src/notes/` (NotesBanks +
  Notes controllers, NotesService — bank/note CRUD FACULTY/ADMIN, `GET /notes/mine` student-scoped
  by BatchEnrollment with q/courseId/chapterId filters + presigned download URLs). Frontend:
  `facultyNotesApi` in both clients (**named to avoid the existing AI-lesson `notesApi`**);
  `/admin/notes` + `/admin/notes/[id]`, `/faculty/notes` + `[id]` (standalone `<main>`, linked from
  the faculty dashboard), `/student/notes`; nav items in AdminShell + StudentShell. Files reuse
  `uploadsApi.uploadFile` (R2 presign). Web + admin build clean; API + migration deploy via Render.
- **Design-system redesign to "Ascent" (2026-07-07, in progress, module-by-module).**
  Source: `Design System/` (Claude Design mockups — tokens + component library + all
  screens, brand "Ascent": warm neutrals, primary orange `#f26a1b`, violet `#7c5cfc`,
  live-pink `#e63368`, Plus Jakarta Sans + JetBrains Mono). Decision: **retrofit into the
  existing inline-style architecture** (NOT a Tailwind/shadcn migration), paced
  module-by-module. Modules shipped:
  - **M1 · Foundation tokens** (`b6e397c`, deployed web+admin) — retrofitted both apps'
    `globals.css` `:root`, preserving every existing var NAME, warming values onto the
    Ascent scale and adding role tokens (`--live`, `--progress`, `--diff-easy/med/hard`,
    `--e1..--e4` elevation, `--rxs..--rxl` radius, `-ink`/`-bright`/`-deep` brand steps,
    `--font-sans/--font-mono`). Recolored `.live-pulse` (→pink), `.entity-card` shadow,
    banner gradients, body bg. Everything downstream inherits automatically.
  - **M2 · Student dashboard** (`apps/web/.../student/dashboard/page.tsx`) — the screen was
    already ~fully token-driven, so this was a compliance+polish pass: brand gradient
    constants → Ascent orange-400→600, greeting bumped toward H1 scale, "Live now"
    indicator moved off generic `--red` onto the dedicated `--live` pink role. NOTE:
    deliberately NOT a structural rebuild — the mockup's continue-learning/recommended/
    streak/reflection sections were left for a future scoped module (the current dashboard
    is analytics-heavy with real data and was recently redesigned).
  - **M3 · Shared shells** (`StudentShell.tsx` + `AdminShell.tsx`) — highest-leverage
    retrofit (on every page; there is NO shared Button/input component — primitives are
    inline everywhere — so the shells ARE the leverage point). Brand gradients → Ascent
    orange-400→600; **active nav item** changed from the old solid-black pill to the
    mockup's orange-tinted treatment (`background: --orange-soft`, text/icon
    `--orange-deep` #e0540e, radius `--rs`). Bottom nav already used orange.
  - **M4 · Real backing fields + student catalog redesign** — user chose (via AskUserQuestion)
    to ADD REAL DATA rather than fake the mockup's rating/price/hours chips. New backend:
    `Course.priceCents` + `durationMinutes` (migration `20260707120000`), and a **`CourseReview`**
    model (migration `20260707130000`, one rating/student/course, 1–5 + comment) → `avgRating`/
    `reviewCount` on course list + detail; endpoints `GET/POST /courses/:id/reviews`,
    `GET :id/reviews/me` (enrolled-only upsert). Price/duration inputs added to admin + faculty
    course settings forms (₹ whole-rupees → stored as paise; hours → stored as minutes). Student
    **catalog** (`student/courses/page.tsx`) rebuilt to the Ascent mockup: filter sidebar
    (Subject facets from segments + Free-only + sort popular/rating/newest), result count, rich
    cards (segment badge on thumbnail, ★rating, duration, price/Free), skeleton + empty states,
    and a mobile filter **bottom-sheet** (`.catalog-shell`/`.catalog-filters`/`.catalog-filter-toggle`).
    Course-detail sidebar got a `CourseRatingCard` (avg + student's own star rating/comment).
    IMPORTANT: auto-mode blocks `prisma migrate deploy` AND `prisma generate` here — the migrations
    apply via Render's deploy (its start runs migrate deploy); API build verified by Render, not
    locally. Web + admin build clean locally.
  - **M5 · Student dashboard rebuilt to mockup S1/S1m** (`student/dashboard/page.tsx`) — the
    full structural rebuild deferred in M2. Now matches the Ascent S1 (desktop `1fr/360px`)
    + S1m (mobile stack): greeting + 🔥 streak, **Continue learning** cards (thumbnail +
    progress), **Study activity** heatmap, **Recommended for you** (real catalog courses
    w/ rating+price via M4), and a right rail = **On-track** syllabus ring + avg/best, **LIVE
    NOW** card, **Today's schedule**, **Evening reflection** (from today's `Reflection`). All
    real data (added catalog + reflection fetch). Dropped the old analytics-heavy render
    (performance ring, exam-score bar/trend charts, completion donut, course-progress bars,
    mentor timeline, stat strip) and removed ~350 lines of now-dead code (910→560). New mobile
    CSS: `.dash-continue-grid`/`.dash-rec-grid` stack. Priority note: user directed
    **student → admin → faculty**, matching Design System/ pages on web + mobile.
  - **M5.1 · dashboard pixel-match to the S1 screenshot** (user supplied an annotated shot):
    Continue-learning cards now show the **recently-studied chapter + next lesson** ("Ch 4 ·
    <lesson>") with striped-gradient dummy thumbnails (play glyph / PDF chip) + green progress;
    Recommended now shows **enrolled + purchasable** courses (enrolled hide price → "Enrolled/
    Continue") with striped thumbnails, BESTSELLER/NEW badge (derived), instructor avatar+name
    (backend `listCourses` now includes `faculty.fullName`), rating, price/FREE, Enroll; Today's
    schedule uses colored bars + type tag chips (LIVE/Test/Unlock/Session). **Placeholders (no
    real data yet, user OK'd dummy "to see how it looks"):** per-course difficulty chip
    (Easy/Med/Hard = deterministic hash of course id — needs a real Course.difficulty field to
    be true), striped thumbnails (until courses have real images), and the "82 days to exam"
    line was OMITTED (no exam-date field — would be a permanently-wrong countdown). Removed the
    old event-icon helpers. Web builds clean; API `faculty` include deploys via Render.
  Next: remaining student screens (course-detail/player S2, mock-test, workout, planner,
  calendar, mentor, subscription), then admin, then faculty.
  Verify each live via production (local http can't hold the Secure auth cookie).
- `760ce53` (2026-07-06 audit, deployed) — order-tiebreaker + bank-question
  order-assignment fixes (`question-banks`/`tests`/`batch-status-types` services now
  assign `max+1` on create and sort `[{order},{createdAt}]`); question-bank editor
  hardening in both apps (silent `refresh()` instead of full-page `load()` on
  mutations, plus try/catch + `actionError` banner + in-flight `saving` guard on
  publish/title/add/edit/delete); this context file cleanup (missing commits added,
  Cheat Sheet illustration contradiction resolved, changelog restructured). No
  migration (pure query logic). Deployed: Render (API push) + Vercel ×2, all 200.
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

*Last updated: 2026-07-16 (admin Reports: range switcher, by-segment table, CSV export).*
