# Claude Code Brief — AI Descriptive-Answer Evaluation Engine

> Paste this as your kickoff prompt in Claude Code. Treat the **CUSTOMIZE** blocks as the
> only things you need to edit before running. Everything else is the spec.

---

## 0. Customize before running

```
CUSTOMIZE:
- Existing repo? ............ [yes / no — if yes, adapt to current stack, don't scaffold blindly]
- Backend language ......... [default: Python 3.11 + FastAPI]
- Frontend ................. [default: React + TypeScript + Tailwind]
- DB ....................... [default: PostgreSQL]
- Job queue / async ........ [default: Celery + Redis  (or RQ)]
- Object storage ........... [default: S3-compatible bucket for answer images]
- LLM access ............... [OpenRouter during testing; key in env OPENROUTER_API_KEY]
- OCR provider ............. [default: Google Document AI — alt: Azure Document Intelligence / AWS Textract]
```

If a repo already exists, **first inspect it and conform to its conventions** before writing
any code. Confirm the stack with me if it diverges from the defaults above.

---

## 1. What we're building

An evaluation engine for **handwritten descriptive answers** (UPSC Mains is the first use case,
but the engine must generalize to *any* descriptive answer — essays, law answers, board exams).
A learner uploads photos of a handwritten answer; the system returns:

1. A faithful **transcript** of the handwriting (errors preserved).
2. The original answer image with **examiner-style annotations drawn on it** (underlines,
   circles, checkmarks, margin notes) anchored to the exact words.
3. **Detailed, actionable feedback**: per-dimension scores, strengths to keep, ranked
   priority actions, and a micro-rewrite for each issue.
4. A **marks breakdown** that sums to a total, plus a **vetted model answer** and an
   **"upgraded version of the learner's own answer."**

The differentiator vs competitors is grading **consistency**, **on-paper precision**, and
feedback that **teaches the fix** rather than just naming the flaw.

---

## 2. Non-negotiable architecture principles

Build these in from the start — they are the whole point:

1. **Two separate engines. Never merge them.**
   - **OCR/layout engine** → faithful text extraction *with word- and line-level bounding
     boxes and reading order*. This is a dedicated document-OCR provider, **not** the LLM.
   - **Reasoning engine (LLM)** → evaluates and writes feedback, referencing the answer by
     **line IDs**, never by re-quoting text.
   - Rationale: the LLM is unreliable at pixel coordinates and silently "corrects" learner
     errors. The OCR engine owns geometry and verbatim text; the LLM owns judgment.

2. **Annotations are anchored by ID, not by string-matching.**
   The OCR stage emits an ordered list of lines, each `{line_id, text, bbox}`. The LLM
   receives that numbered list and returns annotations that reference `line_ids`. We map
   `line_id → bbox` deterministically. **No fuzzy quote matching anywhere.**

3. **Grading is driven by an admin-authored, per-question rubric — not by the LLM's own taste.**
   The marks and feedback come from a structured rubric the admin defines when creating the
   question (see §3). The LLM's job is **detection, not judgment of what "good" is**: for each
   admin-defined expected point it decides present / partial / absent **by meaning**, with
   `line_id` evidence. The admin owns the standard; the model owns the matching.

4. **Semantic matching, with credit for valid equivalents.**
   Expected points are matched by **meaning, never by keyword/string**. A learner who makes the
   same point with a different example or phrasing gets credit, and the grader returns the
   learner's actual phrasing + `line_ids` as proof. Strong valid points that aren't on the
   admin's list are captured as **bonus**, not ignored. For open questions, the admin can mark a
   set of points as "any N of M required" so the rubric isn't over-strict (see §3).

5. **Faithful transcription.** The OCR text keeps the learner's spelling/grammar errors. The
   LLM may flag low-confidence OCR regions but must **never "fix" the learner's own mistakes**
   in the transcript — language quality is being graded.

6. **Async by default.** Evaluation is multi-second and multi-call. Submissions run as
   background jobs with a status/progress API. No blocking request handlers.

---

## 3. The grading model — admin-authored, part-structured rubric

Grading is configured per question by the admin. The structure of an answer (its parts) is
**data, not code**, so essays, GS answers, law answers, and short notes each grade against
their own shape. Two objects:

### 3a. Question Type (reusable template — defines the parts)

```yaml
question_type:
  type_id: "gs_analytical"
  name: "GS Analytical (Intro–Body–Conclusion)"
  parts:
    - { part_id: "intro", name: "Introduction", default_weight: 0.15 }
    - { part_id: "body",  name: "Body",         default_weight: 0.65 }
    - { part_id: "concl", name: "Conclusion",   default_weight: 0.20 }
```

Admins can create any number of types with their own parts, e.g.:
- **Essay** → Introduction · Thesis · Arguments For · Counter-arguments · Conclusion
- **Ethics case** → Stakeholders · Ethical issues · Options & evaluation · Decision
- **Law (IRAC)** → Issue · Rule · Application · Conclusion
- **Short note** → single part

Part `default_weight`s must sum to 1.0. They're defaults; a question can override per-part marks.

### 3b. Question (instance — what the admin fills in)

This is exactly the admin "Add question" form: question, marks, type (3), model answer (4),
must-include per part (5), must-not-include (6).

```yaml
question:
  question_id: "g7_2024"
  text: "The G7, once the steering committee... Examine the validity of this statement."
  directive: "Examine"
  max_marks: 15
  type_id: "gs_analytical"
  model_answer: "<vetted full-marks answer, segmented per part>"

  parts:
    - part_id: "intro"
      marks: 2
      must_include:                      # (5) per-part expected points
        - { point_id: "p1", text: "Defines G7 / lists members", marks: 0.5 }
        - { point_id: "p2", text: "Frames the 'steering committee' claim with G7's 1975 origin", marks: 1.5 }
    - part_id: "body"
      marks: 10
      # 'any N of M' group: open question, not all points mandatory
      groups:
        - group_id: "challenges"
          min_required: 3
          marks: 6
          points:
            - { point_id: "b1", text: "Falling share of global GDP (~60–70% → lower)" }
            - { point_id: "b2", text: "Representation deficit / Global South" }
            - { point_id: "b3", text: "Rise of G20 & BRICS+ as alternatives" }
            - { point_id: "b4", text: "Internal divisions (e.g. US–EU trade disputes)" }
            - { point_id: "b5", text: "Exclusion of China & Russia limits problem-solving" }
      must_include:
        - { point_id: "b6", text: "Continued relevance — a concrete recent action (PGI / Russia sanctions / AI governance)", marks: 4 }
    - part_id: "concl"
      marks: 3
      must_include:
        - { point_id: "c1", text: "Takes a clear stand on the statement's validity", marks: 2 }
        - { point_id: "c2", text: "Balanced, forward-looking close", marks: 1 }

  must_not_include:                       # (6) things that lose marks if present
    - { text: "Factual error: claims G7 includes China/Russia/India", type: "factual_error", penalty: 1 }
    - { text: "Vague unverifiable example (e.g. 'Iran blockade in Strait of Hormuz')", type: "weak_evidence", penalty: 0.5 }
    - { text: "Communal / biased framing", type: "prohibited", penalty: "flag_hard" }

  # optional secondary layer (admin toggles per type) — language/analysis quality
  qualitative:
    enabled: true
    dimensions: ["analysis", "expression"]
    max_adjustment: 1   # can nudge total within ±1, never overrides the checklist
```

Rules the system enforces at question-creation time:
- Part `marks` (and any group/point marks) **must reconcile to `max_marks`** — validate in the
  admin UI before save.
- `must_not_include[].penalty` is a number, or `flag_hard` for content that should halt/flag
  (bias, plagiarism, etc.).
- The **model answer (4)** is the vetted exemplar shown to the learner *and* the reference the
  grader uses to disambiguate "does this learner sentence satisfy point pX?" — it is **not**
  diffed against literally.

This admin rubric **replaces** the old fixed-dimension spine as the primary grader. The
qualitative dimensions survive only as an optional, bounded secondary nudge the admin can
enable per type.

---

## 4. The pipeline (build in this order)

**Stage 1 — Ingest & preprocess**
Accept multi-page image/PDF upload + a `question_id` (or raw question text + directive +
max_marks). Deskew, auto-crop to page, normalize contrast, order pages. Persist originals to
object storage.

**Stage 2 — OCR with geometry**
Call the document-OCR provider. Output: ordered `lines[] = {line_id, text, bbox, page,
confidence}`. Optional light LLM pass to repair *obvious OCR artifacts only* (never learner
errors), flagging low-confidence regions. **Build a provider interface** so Document AI /
Azure / Textract are swappable; we will benchmark all three on real copies.

**Stage 3 — Question understanding**
Resolve `question_id` to its full **admin rubric** (§3): directive, max_marks, the question
type's `parts`, the model answer, per-part `must_include` / `groups`, and `must_not_include`.
This is just a config fetch — the rubric is authored once in admin and cached, never derived
per submission.

**Stage 4 — Evaluation (LLM, structured detection against the rubric)**
The LLM receives: question + directive + max_marks + the part structure + the model answer
(as exemplar) + every expected point + every forbidden point + the numbered `lines[]`. It does
**detection, not free grading**:
1. **Segment** the learner's `lines[]` into the defined parts (which lines are intro / body /
   conclusion / etc.). If a whole part is absent, mark it missing.
2. For **each part**, for **each expected point** (`must_include` + `groups`): decide
   `present | partial | absent` **by meaning**, returning the learner's matched phrasing +
   `evidence_line_ids` when present. Honour `groups.min_required` (any-N-of-M).
3. Detect each **`must_not_include`** point; if present, flag it with `line_ids` and apply its
   penalty (`flag_hard` items short-circuit to a review flag).
4. Capture strong **bonus** points the learner made that aren't on the list.
5. **Score deterministically in code, not by the LLM's vibe:** part marks = sum of credited
   point marks (full / partial) − penalties, capped at the part's marks; total = Σ parts; then
   apply the optional bounded `qualitative` adjustment if enabled. The LLM returns
   present/partial/absent + evidence; **your code computes the marks** from the rubric weights.
   This is what makes marks consistent and explainable.

Per part the output therefore yields exactly what the product promises: the **plus points
present** and the **points missing**. Each missing point carries a `suggested_addition`; each
forbidden hit carries `why_it_costs`; both map to annotations via `line_ids`.

Other requirements: `response_format: json_schema` (with `provider.require_parameters: true`
on OpenRouter), reject+retry on schema failure, and N-sample/high-effort config to stabilise
the present/partial/absent calls. Keep a `priority_actions` list ordered by marks-per-effort,
built from the missing points and forbidden hits with the largest `marks` impact.

**Stage 5 — Annotation rendering**
Map each issue's `line_ids → bbox`. Render an **SVG/canvas overlay layer on top of the
original image** (do NOT burn pixels into the photo):
- `underline` → jittered line under bbox
- `circle` → ellipse around bbox group
- `check` → glyph at line's right edge (for strengths)
- `margin_note` → handwriting-style text in the right margin + thin connector to the bbox
Add slight randomized jitter + a handwriting font so it reads as marking, not machine overlay.
Margin notes are **hoverable/tappable** in-app (hover → highlights the linked feedback item).
Also export a flattened PNG/PDF.

**Stage 6 — Model answer + upgraded answer**
Surface the **vetted reference** as the model answer (don't regenerate — avoids hallucinated
stats). Generate an **"upgraded version of the learner's own answer"**: keep their points,
apply the minimal edits that would raise the mark. If a reference is missing, generate one but
ground facts via retrieval/web-search and mark unverifiable claims qualitatively.

**Stage 7 — Assemble report & persist**
Bundle: transcript, annotated image (interactive + flat), feedback object, marks breakdown,
model answer, upgraded answer. Persist per-dimension scores to enable a **progress-over-time**
view per learner.

---

## 5. Canonical data contract (single source of truth)

The evaluation engine returns exactly this. It's organised **by part**, so the UI can show,
per part, the plus points present and the points missing. The UI and annotation renderer both
consume it.

```json
{
  "submission_id": "string",
  "question_id": "string",
  "type_id": "gs_analytical",
  "transcript": [
    { "line_id": 1, "text": "verbatim line incl. errors", "page": 1 }
  ],
  "overall": { "marks": 6, "max": 15, "verdict": "1-2 sentence overall judgment" },

  "parts": [
    {
      "part_id": "body",
      "name": "Body",
      "marks_awarded": 4.5,
      "marks_max": 10,
      "detected": true,                       // false if the part was missing entirely
      "present_points": [
        {
          "point_id": "b3",
          "text": "Rise of G20 & BRICS+ as alternatives",   // the admin's expected point
          "credit": "full",                   // full | partial
          "learner_phrasing": "faces competition from G20 and BRICS",
          "line_ids": [9]
        }
      ],
      "missing_points": [
        {
          "point_id": "b6",
          "text": "Continued relevance — a concrete recent action (PGI / Russia sanctions)",
          "marks_lost": 4,
          "why_it_matters": "ties to the 'examine validity' demand — needs current evidence",
          "suggested_addition": "Add: coordinated sanctions on Russia after the 2022 invasion."
        }
      ],
      "part_comment": "Challenges covered well; contemporary-relevance leg absent."
    }
  ],

  "forbidden_found": [
    {
      "text": "Vague unverifiable example ('Iran blockade in Strait of Hormuz')",
      "type": "weak_evidence",
      "penalty": 0.5,
      "line_ids": [4],
      "why_it_costs": "unverifiable assertion earns nothing under 'examine'"
    }
  ],

  "bonus_points": [
    { "text": "valid point the learner made that wasn't on the rubric", "line_ids": [15] }
  ],

  "priority_actions": [
    { "rank": 1, "action": "Add the contemporary-relevance point in the Body",
      "expected_gain": 4, "quick_win": false, "part_id": "body", "point_id": "b6" }
  ],

  "qualitative_adjustment": { "applied": -0.5, "note": "loose expression in places" },

  "model_answer_ref": "question_id_or_inline",
  "upgraded_answer": "the learner's answer, minimally edited to full-marks standard"
}
```

Notes:
- `present_points` (green) and `missing_points` (red) per part are the core of the learner UI.
- **Marks are computed in code** from the rubric weights + the LLM's present/partial/absent
  calls — the LLM does not invent `marks_awarded`. `Σ parts.marks_awarded − Σ forbidden.penalty
  + qualitative_adjustment` must reconcile to `overall.marks`.
- `line_ids` on present points, missing-point evidence, and forbidden hits all drive
  annotations (check = present, circle/underline + margin_note = missing/forbidden).
- `priority_actions` is built from the highest-`marks_lost` missing points and forbidden hits.

---

## 6. LLM access (OpenRouter during testing)

- OpenAI-compatible: base URL `https://openrouter.ai/api/v1`, key in `OPENROUTER_API_KEY`.
- Put the **model slug in config**, not hardcoded, so we can A/B graders (e.g. a frontier
  reasoning model vs a cheaper one) without code changes.
- Always pass `provider: { require_parameters: true }` so OpenRouter only routes to providers
  honoring our JSON schema.
- **OpenRouter does NOT do geometry OCR** — Stage 2 always calls the document-OCR provider
  directly. Do not try to route OCR through OpenRouter.
- Build a thin `LLMClient` abstraction so we can later swap to direct provider calls (for
  caching, batch discounts, stricter data terms) without touching pipeline code.
- Treat answer images + transcripts as **student PII**: restrict to no-logging providers,
  keep data out of logs, and make retention configurable.

---

## 7. MVP scope (do this first)

1. **Admin: a question-rubric builder** — create a Question Type (parts) + a Question with
   marks, model answer, per-part `must_include` / `groups`, and `must_not_include`, with the
   marks-reconciliation validation. Seed it with the G7 question (§3b).
2. Upload → Stage 1/2 → render transcript with line IDs. (Prove OCR + geometry.)
3. Stage 4 detection against that rubric → emit the §5 object (per-part present/missing).
4. Render the per-part **plus points / missing points** panel + the annotated-image overlay.
5. Then add: model/upgraded answer, progress tracking, group `min_required`, the optional
   qualitative layer, N-sampling.

Ship a single end-to-end vertical slice for **one real question** (the G7 IR question) before
generalizing.

---

## 8. Quality guardrails / acceptance

- Annotations land on the **correct words** (verify against bbox, not vibes).
- The same answer graded repeatedly stays within a tight marks band (test with N runs).
- A point made with **different wording / a different valid example** is detected as `present`,
  not `missing` (write a semantic-matching test explicitly).
- A valid point **not on the rubric** is captured as `bonus`, never penalised.
- The transcript preserves learner errors verbatim.
- Every `missing_point` has a non-empty `why_it_matters` and `suggested_addition`; every
  `forbidden_found` has `why_it_costs`.
- Marks are computed in code: `Σ parts.marks_awarded − Σ forbidden.penalty +
  qualitative_adjustment` reconciles to `overall.marks`, and the admin builder blocks saving a
  question whose part/point marks don't sum to `max_marks`.
- 5–10% of evaluations are flagged for human review; disagreements are logged as future
  calibration data.

Write tests for the schema contract, the line_id→bbox mapping, the semantic present/partial/
absent matching, and the marks-reconciliation math. Keep secrets in env. Log token usage per
stage for cost monitoring.

---

## 9. How to proceed

1. Confirm/scaffold the stack and the repo layout.
2. Define the §5 schema as the shared type (pydantic + TS types generated from it).
3. Build the MVP vertical slice (§7) end-to-end for the G7 question.
4. Pause and show me the transcript + annotated image + feedback object before expanding.
