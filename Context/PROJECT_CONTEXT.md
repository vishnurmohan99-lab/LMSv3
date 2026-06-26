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
  `vishnu@test.com`/`Vishnu123@` (STUDENT, no segment),
  `testfaculty_mentor@test.com`/`Vishnu123@` (FACULTY, isMentor=false).
  `aparna@test.com` is a separate real STUDENT account.
  `aparna.mentor@test.com` is the real mentor account (FACULTY,
  "Front-end · 6y", 50 weekly recurring slots).
- Real courses in prod: Maths, Chemistry, Physics (Class 12/JEE), Biology
  (Class 12/NEET), JEE MAINS (Cllass 10 — typo'd segment, leave as-is). Real
  segments: "Class 11", "Class 12" (sub: "NEET").

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
- A student with no segmentId/subsegmentId sees ALL segment-scoped content
  unfiltered — intentional, mirrored across Course/Test/Answer-Correction
  question visibility.
- **Always give `orderBy: { order: 'asc' }` a secondary tiebreaker**
  (`createdAt`/`id`) wherever lessons/tests/chapters are queried. Many rows
  share `order: 0` until a user explicitly reorders them, and Postgres
  doesn't guarantee tie order without a secondary sort key — without one, an
  unrelated update (e.g. toggling a feature flag on a lesson) can make a
  fresh fetch return ties in a different sequence, looking like the order
  silently changed even though nothing touched it. Fixed in
  `getCourseTree()` and the SEQUENTIAL-drip sibling queries in
  `courses.service.ts`; apply the same pattern to any new ordered query.
- **This codebase is ~100% inline-style, zero CSS Modules.** Inline styles
  can't express `@media` queries. Established pattern: add named utility
  classes (`mobile-page-pad`, `mobile-stack-header`, `course-pane-list`, etc.)
  to `globals.css` with `!important` mobile overrides, and attach those
  classNames alongside existing inline styles in JSX. Inline styles still
  carry all non-breakpoint-dependent values; only responsive deltas live in
  CSS classes.
- **Browser automation in this environment cannot shrink the real browser
  viewport** (`window.innerWidth` stays 1920 despite `resize_window` calls —
  the browser runs maximized in a remote/virtual display). Mobile CSS changes
  are verified by (a) build success, (b) inspecting the deployed stylesheet
  text directly via `document.styleSheets`, (c) code review of media-query
  logic — **not** by an actual mobile-width screenshot. Flag this limitation
  if true visual verification is ever required.

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
- **Not yet started:** Calendar, Messages/Forum/Feedback, and the unread back
  half of the mockup (Workout/Mock Test/Mentor/Planner/Profile). Faculty and
  Admin apps explicitly excluded from this rollout's scope for now.

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

## Outstanding / known gaps

- Answer Correction: PDF upload rejected (image-only for v1); free-tier
  vision model untested on real handwriting; no rate-limiting/abuse-control;
  no "My submissions" history page; multi-page answers not supported.
- Cheat Sheet: PDF-only (no video support yet, despite the original feature
  request describing video too — explicitly deferred); no extraction of
  images/diagrams from the source PDF (AI-generated illustrations only).
  **Illustrations are currently blocked**: OpenRouter returns 402 Payment
  Required on every image call (no $0 image tier exists; confirmed live via
  added error logging) — text/bullets/table/exam-tip generation works fine,
  pages just render with no picture until the OpenRouter account has a
  credit balance added at openrouter.ai/credits. Flagged to the user as a
  billing action, not a code fix. One orphaned test `CheatSheet` row + a few
  R2 images remain attached to the real "Test Lesson" PDF lesson in Physics
  from end-to-end verification (harmless, but not cleaned up).
- Mobile UI rollout partial — see above. Faculty/Admin apps not in scope yet.
- Prior-session gaps still open: no DB-level "comprehension group" beyond
  shared `passageId`, PASS_TEST 50% threshold hardcoded, sequential
  lesson-gating simplification (display order ≠ gating order), no custom
  domain, no payment gateway, no bulk/CSV import, no real notification
  center, student-side Feedback fill-page UI still not interactively
  browser-verified.

## Roadmap status

All original roadmap phases complete. Current work is post-roadmap: (1) the
AI Answer-Correction feature (done, deployed), (2) the AI Cheat Sheet
Generator (done, deployed, PDF-only for v1), (3) the mobile-responsiveness
initiative (in progress, picked module-by-module live in conversation, not a
fixed backlog).

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
*Last updated: 2026-06-26, after the mobile UI rollout commits (shell, course
list, course detail/lesson player, flashcards+AI deck, dashboard), the
Answer Correction feature, the AI Cheat Sheet Generator, the lesson/test/
chapter order-tiebreak fix, and diagnosing the Cheat Sheet image 402.*
