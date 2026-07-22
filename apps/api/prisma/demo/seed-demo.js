/**
 * Demo data seeder — fills every major area of the app for a pre-production walkthrough.
 *
 * Additive and reversible. Nothing existing is read-modified or deleted; every row this
 * creates is recorded in demo-manifest.json, and seed-demo-undo.js deletes exactly those
 * ids and nothing else. Demo accounts also carry a @demo.paperlms.in email domain as a
 * second, human-readable marker in case the manifest is ever lost.
 *
 *   node apps/api/prisma/demo/seed-demo.js
 *   node apps/api/prisma/demo/seed-demo-undo.js
 *
 * Raw SQL rather than Prisma Client: the generated client is TypeScript source, and the
 * repo has no ts-node path that resolves its internal .js imports.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO = path.resolve(__dirname, '../../../..');
const API = path.join(REPO, 'apps/api');
for (const line of fs.readFileSync(path.join(API, '.env'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"\r\n]*)"?\s*$/);
  if (m) process.env[m[1]] = m[2];
}
const { Client } = require(path.join(REPO, 'node_modules/pg'));
const bcrypt = require(path.join(REPO, 'node_modules/bcrypt'));

const MANIFEST = path.join(__dirname, 'demo-manifest.json');
const DEMO_DOMAIN = '@demo.paperlms.in';
const DEMO_PASSWORD = 'Demo123@';

const client = new Client({ connectionString: process.env.DATABASE_URL });
const manifest = {};
const uid = () => crypto.randomUUID();
const track = (table, ids) => {
  manifest[table] = (manifest[table] || []).concat(ids);
  return ids;
};

const DAY = 86400000;
const daysAgo = (n) => new Date(Date.now() - n * DAY);
const daysAhead = (n) => new Date(Date.now() + n * DAY);
let seed = 42;
/** Deterministic PRNG so a re-run after an undo produces the same shape of data. */
function rnd() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const pickN = (arr, n) => {
  const c = [...arr];
  const out = [];
  while (out.length < Math.min(n, c.length)) out.push(c.splice(Math.floor(rnd() * c.length), 1)[0]);
  return out;
};
const intBetween = (a, b) => a + Math.floor(rnd() * (b - a + 1));

/** Bulk insert. Chunks so a few thousand rows don't exceed the parameter limit. */
async function insert(table, cols, rows) {
  if (!rows.length) return [];
  const CHUNK = Math.max(1, Math.floor(60000 / cols.length));
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const params = [];
    const tuples = slice.map((r) => {
      const ph = cols.map((c) => {
        params.push(r[c] === undefined ? null : r[c]);
        return `$${params.length}`;
      });
      return `(${ph.join(',')})`;
    });
    const colList = cols.map((c) => `"${c}"`).join(',');
    await client.query(`INSERT INTO "${table}" (${colList}) VALUES ${tuples.join(',')} ON CONFLICT DO NOTHING`, params);
  }
  track(table, rows.map((r) => r.id).filter(Boolean));
  return rows;
}

// ---------------------------------------------------------------- content pools
const FIRST = ['Aarav','Vivaan','Aditya','Vihaan','Arjun','Sai','Reyansh','Krishna','Ishaan','Rudra','Ananya','Diya','Aadhya','Saanvi','Pari','Anika','Navya','Myra','Sara','Ira','Rohan','Kabir','Neha','Meera','Riya','Kunal','Tara','Nikhil','Priya','Karthik','Lakshmi','Farhan','Zoya','Devansh','Ritika','Manish','Sneha','Varun','Divya','Yash'];
const LAST = ['Sharma','Verma','Nair','Iyer','Menon','Reddy','Patel','Desai','Khan','Bose','Gupta','Rao','Pillai','Joshi','Kulkarni','Chatterjee','Mehta','Banerjee','Shetty','Kapoor'];

const REVIEW_TEXT = [
  'Concepts are broken down really well. The practice sets after each chapter are what made it click for me.',
  'Faculty explains the tricky derivations step by step. Wish the pace was slightly slower in the last module.',
  'Best structured course I have taken. The doubt-solving turnaround is genuinely quick.',
  'Solid content and the mock tests match the actual exam pattern closely.',
  'The flashcards are underrated — used them daily on commute and retention improved a lot.',
  'Good coverage. Would love a few more solved examples in the second chapter.',
  'Cleared my basics completely. Moving to the advanced course next.',
  'Very exam-focused. No filler content, which I appreciated.',
  'The AI notes save so much time. I stopped writing everything down.',
  'Helped me move from 60 percentile to 90+ in three months.',
  'Teaching quality is excellent, production quality could be a bit better.',
  'Worth every rupee. The live sessions are the highlight.',
];

const THREADS = [
  ['How do you approach rotational dynamics problems?', 'I keep losing marks on angular momentum questions. What order do you work through the constraints in?'],
  ['Best strategy for the last 30 days?', 'Should I focus on revision or keep attempting new mocks? Currently at 2 mocks a week.'],
  ['Organic chemistry reaction map', 'Made a one-page map of all named reactions from the syllabus. Sharing below — corrections welcome.'],
  ['Doubt: limits and continuity', 'Struggling to see when to apply L\'Hopital vs series expansion. Any rule of thumb?'],
  ['Study group for weekend mocks?', 'Anyone up for a Saturday morning mock + discussion session on the call?'],
  ['How many hours are you putting in daily?', 'Trying to benchmark. I am at 6 hours on weekdays and it feels like not enough.'],
  ['Physics numericals — speed vs accuracy', 'I can solve most problems but not in time. How do you build speed without silly mistakes?'],
  ['Notes vs video — what works for revision?', 'For the third revision I find notes far faster. Curious what everyone else does.'],
  ['Thank you to the faculty', 'Just wanted to say the doubt sessions this month have been outstanding.'],
  ['Anyone tried the new mock series?', 'Attempted the first two. Difficulty feels a notch above last year.'],
];
const POSTS = [
  'Start with the constraint equations before touching energy conservation — it removes half the unknowns.',
  'I would say revision. New mocks this late mostly tell you what you already know.',
  'This is genuinely useful, thanks for putting it together.',
  'Series expansion when you can see the standard forms, L\'Hopital when it is a clean 0/0.',
  'Count me in for Saturday.',
  'Quality over hours. I do 4 focused hours and it beats 8 distracted ones.',
  'Time yourself per question, not per section. That fixed it for me.',
  'Notes for the third pass, definitely. Video only for topics I got wrong.',
  'Agreed, the turnaround on doubts has been quick this month.',
  'Attempted all three so far — section 2 is where the difficulty jumped.',
  'Try solving it backwards from the answer options, saves time in MCQs.',
  'Same issue here. What helped was writing the given/find before starting.',
];
const MESSAGES = [
  'Reminder: live doubt session tomorrow at 7 PM. Bring your pending questions.',
  'Uploaded the revision notes for chapter 4 to the notes bank.',
  'Great work on the last mock — batch average is up 8 marks.',
  'Sir, could you re-explain the third numerical from yesterday?',
  'Sure, I will cover it at the start of tomorrow\'s session.',
  'The test window closes tonight at 11 PM, please submit before then.',
  'Thank you sir, that cleared it up.',
  'Weekly schedule for next week is now on your calendar.',
];

async function main() {
  await client.connect();
  if (fs.existsSync(MANIFEST)) {
    throw new Error('demo-manifest.json already exists — run seed-demo-undo.js first, or delete it if the data is already gone.');
  }
  const q = (s, p) => client.query(s, p).then((r) => r.rows);
  const log = (label, n) => console.log(`  ${String(n).padStart(5)}  ${label}`);
  console.log('Reading existing data (not modifying any of it)…');

  const segments = await q(`SELECT id, name FROM "Segment"`);
  const segBy = Object.fromEntries(segments.map((s) => [s.name, s.id]));
  const existingFaculty = await q(`SELECT id FROM "User" WHERE role IN ('FACULTY','ADMIN')`);
  const existingStudents = await q(`SELECT id, email FROM "User" WHERE role='STUDENT'`);
  const statuses = await q(`SELECT id, name, "isCompletionTarget" FROM "BatchStatusType"`);
  const stBy = Object.fromEntries(statuses.map((s) => [s.name, s.id]));
  const banks = await q(`SELECT id, title FROM "QuestionBank"`);
  const bankQs = await q(`SELECT id, "questionBankId", prompt, options, "correctOption", type, difficulty, marks FROM "Question" WHERE array_length(options,1) > 0`);
  // Reuse real uploaded media so demo videos, PDFs and thumbnails actually resolve.
  const media = await q(`SELECT DISTINCT "contentUrl" u FROM "Lesson" WHERE "contentUrl" IS NOT NULL`);
  const videoUrls = media.map((m) => m.u).filter((u) => /\.(mp4|mov|webm)$/i.test(u));
  const pdfUrls = media.map((m) => m.u).filter((u) => /\.pdf$/i.test(u));
  const thumbs = (await q(`SELECT DISTINCT "thumbnailUrl" u FROM "Course" WHERE "thumbnailUrl" IS NOT NULL`)).map((r) => r.u);
  const noteFiles = await q(`SELECT DISTINCT "fileUrl" u, "fileName" n FROM "Note"`);
  const vishnu = existingStudents.find((s) => s.email === 'vishnu@test.com');
  console.log(`  reusable media: ${videoUrls.length} video, ${pdfUrls.length} pdf, ${thumbs.length} thumbnail`);

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const now = new Date();

  // ------------------------------------------------------------------ subsegments
  const subDefs = [
    ['Class 11', 'JEE Foundation'], ['Class 11', 'NEET Foundation'],
    ['CA', 'Foundation'], ['CA', 'Intermediate'], ['CA', 'Final'],
    ['Cllass 10', 'Board Prep'],
  ];
  const subs = subDefs.filter(([s]) => segBy[s]).map(([s, name], i) => ({
    id: uid(), name, order: i, segmentId: segBy[s], createdAt: now, updatedAt: now,
  }));
  await insert('Subsegment', ['id','name','order','segmentId','createdAt','updatedAt'], subs);
  const subBy = Object.fromEntries(subs.map((s) => [s.name, s.id]));
  log('subsegments', subs.length);

  // ------------------------------------------------------------------ users
  const facultyDefs = [
    ['Dr. Meera Nair', 'Physics', true], ['Rahul Deshpande', 'Mathematics', false],
    ['Dr. Anjali Rao', 'Chemistry', true], ['Suresh Iyer', 'Biology', false],
    ['Kavya Menon', 'Quantitative Aptitude', true], ['Arjun Pillai', 'Logical Reasoning', true],
  ];
  const faculty = facultyDefs.map(([fullName, spec, isMentor], i) => ({
    id: uid(), email: `faculty${i + 1}${DEMO_DOMAIN}`, passwordHash, fullName,
    role: 'FACULTY', isMentor, mentorSpecialty: isMentor ? spec : null,
    createdAt: daysAgo(300), updatedAt: now, segmentId: null, subsegmentId: null,
  }));
  const segList = segments.map((s) => s.id);
  const students = Array.from({ length: 40 }, (_, i) => {
    const segmentId = segList[i % segList.length];
    const eligible = subs.filter((s) => s.segmentId === segmentId);
    return {
      id: uid(), email: `student${i + 1}${DEMO_DOMAIN}`, passwordHash,
      fullName: `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}`,
      role: 'STUDENT', isMentor: false, mentorSpecialty: null,
      createdAt: daysAgo(intBetween(20, 280)), updatedAt: now,
      segmentId, subsegmentId: eligible.length ? pick(eligible).id : null,
    };
  });
  const userCols = ['id','email','passwordHash','fullName','role','isMentor','mentorSpecialty','createdAt','updatedAt','segmentId','subsegmentId'];
  await insert('User', userCols, faculty);
  await insert('User', userCols, students);
  log('faculty', faculty.length);
  log('students', students.length);

  const allStudents = [...students.map((s) => s.id), ...existingStudents.map((s) => s.id)];
  const mentors = faculty.filter((f) => f.isMentor);

  // ------------------------------------------------------------------ courses
  const courseDefs = [
    ['Class 12','JEE Foundation','JEE Advanced Physics — Mechanics','Rotational dynamics, SHM and rigid bodies worked through past-paper patterns.','HARD','PAID',499000,1680],
    ['Class 12','JEE Foundation','Organic Chemistry Masterclass','Reaction mechanisms built from first principles, with a named-reaction map.','HARD','PAID',449000,1440],
    ['Class 12','JEE Foundation','Calculus for JEE Main & Advanced','Limits through definite integrals, tuned to the marks distribution.','MEDIUM','PAID',399000,1260],
    ['Class 12','JEE Foundation','Coordinate Geometry Intensive','Conic sections and 3D geometry with a heavy problem bank.','MEDIUM','FREE',null,720],
    ['Class 12','NEET Foundation','NEET Biology — Human Physiology','Every system covered with NCERT line-by-line mapping.','MEDIUM','PAID',429000,1560],
    ['Class 12','NEET Foundation','NEET Biology — Genetics & Evolution','High-yield chapter with inheritance problems solved end to end.','HARD','PAID',379000,960],
    ['Class 12','NEET Foundation','NEET Physics Crash Course','Eight-week sprint covering the full mechanics and electricity syllabus.','MEDIUM','PAID',349000,840],
    ['Class 12',null,'Physical Chemistry — Thermodynamics','Enthalpy, entropy and equilibrium with numerical drilling.','HARD','FREE',null,600],
    ['Class 12',null,'Inorganic Chemistry — Periodic Trends','Memory-light approach built on periodic logic rather than rote.','EASY','FREE',null,480],
    ['Class 11','JEE Foundation','Class 11 Physics Foundations','Kinematics, laws of motion and work-energy from scratch.','EASY','FREE',null,900],
    ['Class 11','JEE Foundation','Algebra & Trigonometry Basics','The Class 11 groundwork that Class 12 quietly assumes.','EASY','FREE',null,720],
    ['Class 11','NEET Foundation','Class 11 Biology — Plant Physiology','Photosynthesis and respiration with diagram-led explanations.','MEDIUM','PAID',299000,840],
    ['Class 11',null,'Chemical Bonding Deep Dive','VSEPR, hybridisation and MO theory, visually.','MEDIUM','FREE',null,540],
    ['CA','Foundation','CA Foundation — Principles of Accounting','Journals through final accounts with full worked ledgers.','MEDIUM','PAID',549000,1800],
    ['CA','Foundation','CA Foundation — Business Mathematics','Ratio, statistics and logical reasoning for the quantitative paper.','EASY','PAID',329000,960],
    ['CA','Intermediate','CA Inter — Direct Taxation','Income heads, deductions and assessment with current-year amendments.','HARD','PAID',699000,2100],
    ['CA','Intermediate','CA Inter — Cost & Management Accounting','Costing methods with the full set of standard formats.','HARD','PAID',649000,1920],
    ['CA','Final','CA Final — Financial Reporting','Ind AS applied to consolidation and fair value questions.','HARD','PAID',899000,2400],
    ['Cllass 10','Board Prep','Class 10 Science — Board Prep','Full board syllabus with previous-year question mapping.','EASY','FREE',null,1080],
    ['Cllass 10','Board Prep','Class 10 Mathematics — Board Prep','Every chapter with the board marking scheme in mind.','EASY','FREE',null,1020],
    ['Cllass 10',null,'Class 10 Social Science — Complete','History, geography and civics condensed for revision.','EASY','FREE',null,780],
    ['Class 12',null,'English Communication & Comprehension','Reading speed, inference and precis for competitive papers.','EASY','FREE',null,420],
  ];
  const courses = courseDefs.map(([segName, subName, title, description, difficulty, type, priceCents, durationMinutes], i) => ({
    id: uid(), title, description, thumbnailUrl: thumbs.length ? thumbs[i % thumbs.length] : null,
    published: true, type, difficulty, priceCents, durationMinutes,
    dripType: 'NONE', completionRule: 'ALL_LESSONS_VIEWED',
    createdAt: daysAgo(intBetween(120, 320)), updatedAt: now,
    facultyId: faculty[i % faculty.length].id,
    segmentId: segBy[segName] ?? null,
    subsegmentId: subName ? (subBy[subName] ?? null) : null,
  }));
  await insert('Course', ['id','title','description','thumbnailUrl','published','type','difficulty','priceCents','durationMinutes','dripType','completionRule','createdAt','updatedAt','facultyId','segmentId','subsegmentId'], courses);
  log('courses', courses.length);

  // ------------------------------------------------------------------ chapters + lessons
  const CH_NAMES = ['Foundations','Core Concepts','Applied Problems','Advanced Techniques','Revision & Mocks'];
  const chapters = [];
  const lessons = [];
  for (const c of courses) {
    const nCh = intBetween(4, 5);
    for (let ci = 0; ci < nCh; ci++) {
      const ch = { id: uid(), title: `${ci + 1}. ${CH_NAMES[ci % CH_NAMES.length]}`, order: ci, bannerUrl: null, unlockAt: null, unlockAfterDays: null, courseId: c.id };
      chapters.push(ch);
      const nL = intBetween(4, 6);
      for (let li = 0; li < nL; li++) {
        const isVideo = rnd() < 0.55 && videoUrls.length;
        const isLive = !isVideo && rnd() < 0.12;
        const type = isVideo ? 'VIDEO' : isLive ? 'LIVE' : 'PDF';
        lessons.push({
          id: uid(), title: `${ci + 1}.${li + 1} ${pick(['Introduction','Core theory','Worked examples','Problem set','Common mistakes','Speed techniques','Past paper walkthrough','Concept recap'])}`,
          order: li, type,
          contentUrl: type === 'VIDEO' ? pick(videoUrls) : type === 'PDF' && pdfUrls.length ? pick(pdfUrls) : null,
          liveAt: isLive ? daysAhead(intBetween(1, 25)) : null,
          flashcardsEnabled: rnd() < 0.45, aiNotesEnabled: rnd() < 0.5, askMeEnabled: rnd() < 0.6,
          summaryDeckEnabled: rnd() < 0.35, cheatSheetEnabled: rnd() < 0.3,
          transcript: null, captionsVtt: null, videoChapters: null,
          createdAt: c.createdAt, updatedAt: now, chapterId: ch.id,
        });
      }
    }
  }
  await insert('Chapter', ['id','title','order','bannerUrl','unlockAt','unlockAfterDays','courseId'], chapters);
  await insert('Lesson', ['id','title','order','type','contentUrl','liveAt','flashcardsEnabled','aiNotesEnabled','askMeEnabled','summaryDeckEnabled','cheatSheetEnabled','transcript','captionsVtt','videoChapters','createdAt','updatedAt','chapterId'], lessons);
  log('chapters', chapters.length);
  log('lessons', lessons.length);

  const lessonsByCourse = new Map();
  const chapterCourse = Object.fromEntries(chapters.map((c) => [c.id, c.courseId]));
  for (const l of lessons) {
    const cid = chapterCourse[l.chapterId];
    if (!lessonsByCourse.has(cid)) lessonsByCourse.set(cid, []);
    lessonsByCourse.get(cid).push(l);
  }

  // ------------------------------------------------------------------ enrolments + progress
  const enrollments = [];
  const seenEnrol = new Set();
  for (const sid of allStudents) {
    for (const c of pickN(courses, intBetween(4, 9))) {
      const key = `${sid}|${c.id}`;
      if (seenEnrol.has(key)) continue;
      seenEnrol.add(key);
      enrollments.push({ id: uid(), studentId: sid, courseId: c.id, enrolledAt: daysAgo(intBetween(1, 240)), source: pick(['SELF','SELF','BATCH','ADMIN']) });
    }
  }
  await insert('Enrollment', ['id','studentId','courseId','enrolledAt','source'], enrollments);
  log('enrolments', enrollments.length);

  const views = [];
  const chapterDone = [];
  const seenView = new Set();
  for (const e of enrollments) {
    const ls = lessonsByCourse.get(e.courseId) || [];
    if (!ls.length) continue;
    const roll = rnd();
    const frac = roll < 0.18 ? 1 : roll < 0.5 ? 0.55 + rnd() * 0.35 : rnd() * 0.5;
    const n = Math.max(1, Math.round(ls.length * frac));
    for (const l of ls.slice(0, n)) {
      const key = `${l.id}|${e.studentId}`;
      if (seenView.has(key)) continue;
      seenView.add(key);
      const after = e.enrolledAt.getTime() + rnd() * (Date.now() - e.enrolledAt.getTime());
      views.push({ id: uid(), lessonId: l.id, studentId: e.studentId, viewedAt: new Date(after) });
    }
    if (frac === 1) {
      for (const chId of [...new Set(ls.map((l) => l.chapterId))]) {
        chapterDone.push({ id: uid(), chapterId: chId, studentId: e.studentId, completedAt: daysAgo(intBetween(1, 60)) });
      }
    }
  }
  await insert('LessonView', ['id','lessonId','studentId','viewedAt'], views);
  await insert('ChapterCompletion', ['id','chapterId','studentId','completedAt'], chapterDone);
  log('lesson views', views.length);
  log('chapter completions', chapterDone.length);

  // ------------------------------------------------------------------ reviews (catalog stars)
  const reviews = [];
  for (const c of courses) {
    const enrolled = enrollments.filter((e) => e.courseId === c.id).map((e) => e.studentId);
    for (const sid of pickN([...new Set(enrolled)], intBetween(6, 14))) {
      reviews.push({
        id: uid(), rating: rnd() < 0.62 ? 5 : rnd() < 0.8 ? 4 : intBetween(2, 4),
        comment: rnd() < 0.8 ? pick(REVIEW_TEXT) : null,
        createdAt: daysAgo(intBetween(2, 200)), updatedAt: now, courseId: c.id, studentId: sid,
      });
    }
  }
  await insert('CourseReview', ['id','rating','comment','createdAt','updatedAt','courseId','studentId'], reviews);
  log('course reviews', reviews.length);

  // ------------------------------------------------------------------ tests linked to courses
  const bankFor = (title) => {
    const t = title.toLowerCase();
    const match = banks.find((b) => t.includes(b.title.toLowerCase().split(' ')[0]));
    return (match || pick(banks)).id;
  };
  const tests = [];
  const testQuestions = [];
  for (const c of pickN(courses, 16)) {
    for (let k = 0; k < intBetween(1, 2); k++) {
      const bankId = bankFor(c.title);
      const pool = bankQs.filter((q2) => q2.questionBankId === bankId);
      const chosen = pickN(pool.length >= 10 ? pool : bankQs, 20);
      if (!chosen.length) continue;
      const t = {
        id: uid(), title: `${c.title} — ${k === 0 ? 'Mock Test' : 'Chapter Test'} ${k + 1}`,
        description: 'Timed practice paper. Negative marking applies.', bannerUrl: null, order: k,
        type: 'FREE', published: true, publishMode: 'MANUAL', availableFrom: null, availableUntil: null,
        durationMinutes: pick([45, 60, 90, 120]), passPercent: 40,
        createdAt: daysAgo(intBetween(60, 200)), updatedAt: now,
        facultyId: c.facultyId, chapterId: null, courseId: c.id,
        segmentId: c.segmentId, subsegmentId: c.subsegmentId,
      };
      tests.push(t);
      chosen.forEach((qq, qi) => {
        testQuestions.push({
          id: uid(), type: qq.type, prompt: qq.prompt, order: qi, imageUrl: null,
          options: qq.options, correctOption: qq.correctOption, difficulty: qq.difficulty,
          marks: qq.marks || 1, negativeMarks: 0.25, answerTimeSeconds: null,
          createdAt: t.createdAt, updatedAt: now, testId: t.id, passageId: null,
        });
      });
    }
  }
  await insert('Test', ['id','title','description','bannerUrl','order','type','published','publishMode','availableFrom','availableUntil','durationMinutes','passPercent','createdAt','updatedAt','facultyId','chapterId','courseId','segmentId','subsegmentId'], tests);
  await insert('TestQuestion', ['id','type','prompt','order','imageUrl','options','correctOption','difficulty','marks','negativeMarks','answerTimeSeconds','createdAt','updatedAt','testId','passageId'], testQuestions);
  log('tests (course-linked)', tests.length);
  log('test questions', testQuestions.length);

  // Attempts spread over time and across the score range, so the admin report's
  // distribution chart and per-segment averages both have something to show.
  const tqByTest = new Map();
  for (const tq of testQuestions) {
    if (!tqByTest.has(tq.testId)) tqByTest.set(tq.testId, []);
    tqByTest.get(tq.testId).push(tq);
  }
  const attempts = [];
  const answers = [];
  for (const t of tests) {
    const qs = tqByTest.get(t.id) || [];
    if (!qs.length) continue;
    const takers = pickN(allStudents, intBetween(8, 22));
    for (const sid of takers) {
      const maxScore = qs.reduce((s, x) => s + x.marks, 0);
      const ability = 0.25 + rnd() * 0.72;
      let score = 0;
      const aid = uid();
      const started = daysAgo(intBetween(1, 210));
      for (const qq of qs) {
        const correct = rnd() < ability;
        if (correct) score += qq.marks;
        answers.push({ id: uid(), selectedOption: correct ? qq.correctOption : pick(qq.options) || null, isCorrect: correct, attemptId: aid, testQuestionId: qq.id });
      }
      attempts.push({
        id: aid, status: 'SUBMITTED', score, maxScore, startedAt: started,
        submittedAt: new Date(started.getTime() + (t.durationMinutes || 60) * 60000),
        testId: t.id, studentId: sid,
      });
    }
  }
  await insert('TestAttempt', ['id','status','score','maxScore','startedAt','submittedAt','testId','studentId'], attempts);
  await insert('TestAnswer', ['id','selectedOption','isCorrect','attemptId','testQuestionId'], answers);
  log('test attempts', attempts.length);
  log('test answers', answers.length);

  // ------------------------------------------------------------------ batches + sessions
  const batchDefs = [
    ['JEE 2027 — Morning Batch','Class 12','Active'], ['JEE 2027 — Evening Batch','Class 12','Active'],
    ['NEET 2027 — Weekend Intensive','Class 12','Active'], ['NEET 2026 — Completed Cohort','Class 12','Completed'],
    ['Class 11 Foundation — Batch A','Class 11','Active'], ['CA Foundation — Nov Attempt','CA','Active'],
    ['CA Inter — May Attempt','CA','Completed'], ['Class 10 Boards — Fast Track','Cllass 10','Completed'],
    ['JEE 2026 — Archive','Class 12','Inactive'],
  ];
  const batches = batchDefs.map(([name, segName, status], i) => ({
    id: uid(), name, startDate: daysAgo(intBetween(60, 300)),
    endDate: status === 'Completed' ? daysAgo(intBetween(5, 50)) : daysAhead(intBetween(60, 260)),
    createdAt: daysAgo(intBetween(60, 300)), updatedAt: now,
    statusId: stBy[status] || stBy['Active'], segmentId: segBy[segName] ?? null,
    subsegmentId: null, facultyId: faculty[i % faculty.length].id,
  }));
  await insert('Batch', ['id','name','startDate','endDate','createdAt','updatedAt','statusId','segmentId','subsegmentId','facultyId'], batches);
  const batchEnrol = [];
  const seenBE = new Set();
  for (const b of batches) {
    for (const sid of pickN(allStudents, intBetween(10, 22))) {
      const key = `${b.id}|${sid}`;
      if (seenBE.has(key)) continue;
      seenBE.add(key);
      batchEnrol.push({ id: uid(), joinedAt: daysAgo(intBetween(5, 200)), accessExpiresAt: null, studentId: sid, batchId: b.id });
    }
  }
  await insert('BatchEnrollment', ['id','joinedAt','accessExpiresAt','studentId','batchId'], batchEnrol);
  const sessions = [];
  for (const b of batches) {
    for (let i = 0; i < 8; i++) {
      const past = i < 5;
      const at = past ? daysAgo(intBetween(1, 70)) : daysAhead(intBetween(1, 30));
      sessions.push({
        id: uid(), title: `${pick(['Doubt Clearing','Live Lecture','Mock Discussion','Revision Marathon','Problem Solving'])} — ${b.name.split('—')[0].trim()}`,
        scheduledAt: at, durationMin: pick([60, 90, 120]),
        status: past ? 'COMPLETED' : 'SCHEDULED',
        actualStartAt: past ? at : null, actualEndAt: past ? new Date(at.getTime() + 90 * 60000) : null,
        createdAt: daysAgo(80), updatedAt: now, batchId: b.id, lessonId: null,
      });
    }
  }
  await insert('Session', ['id','title','scheduledAt','durationMin','status','actualStartAt','actualEndAt','createdAt','updatedAt','batchId','lessonId'], sessions);
  log('batches', batches.length);
  log('batch enrolments', batchEnrol.length);
  log('live sessions', sessions.length);

  // ------------------------------------------------------------------ forum
  const adminId = existingFaculty[0].id;
  const cats = [
    { id: uid(), name: 'General Discussion', scopeType: 'GENERAL' },
    { id: uid(), name: 'Exam Strategy', scopeType: 'GENERAL' },
    { id: uid(), name: 'Doubts & Solutions', scopeType: 'GENERAL' },
  ].map((c) => ({ ...c, createdAt: daysAgo(200), updatedAt: now, batchId: null, courseId: null,
    audienceFacultyMode: 'ALL', audienceStudentMode: 'ALL', postFacultyMode: 'ALL', postStudentMode: 'ALL',
    commentFacultyMode: 'ALL', commentStudentMode: 'ALL', createdById: adminId }));
  await insert('ForumCategory', ['id','name','scopeType','createdAt','updatedAt','batchId','courseId','audienceFacultyMode','audienceStudentMode','postFacultyMode','postStudentMode','commentFacultyMode','commentStudentMode','createdById'], cats);
  const allCats = [...cats.map((c) => c.id), ...(await q(`SELECT id FROM "ForumCategory"`)).map((r) => r.id)];
  const threads = [];
  for (let i = 0; i < 34; i++) {
    const [title, body] = THREADS[i % THREADS.length];
    threads.push({ id: uid(), title: i < THREADS.length ? title : `${title} (${Math.floor(i / THREADS.length) + 1})`, body,
      pinned: i < 2, locked: false, createdAt: daysAgo(intBetween(1, 180)),
      categoryId: pick(allCats), authorId: pick(allStudents) });
  }
  await insert('ForumThread', ['id','title','body','pinned','locked','createdAt','categoryId','authorId'], threads);
  const posts = [];
  const likes = [];
  const seenLike = new Set();
  for (const t of threads) {
    for (let i = 0; i < intBetween(1, 6); i++) {
      posts.push({ id: uid(), body: pick(POSTS), createdAt: new Date(t.createdAt.getTime() + intBetween(1, 72) * 3600000), threadId: t.id, authorId: rnd() < 0.25 ? pick(faculty).id : pick(allStudents) });
    }
    for (const uidv of pickN(allStudents, intBetween(2, 12))) {
      const key = `${t.id}|${uidv}`;
      if (seenLike.has(key)) continue;
      seenLike.add(key);
      likes.push({ id: uid(), threadId: t.id, userId: uidv });
    }
  }
  await insert('ForumPost', ['id','body','createdAt','threadId','authorId'], posts);
  await insert('ForumThreadLike', ['id','threadId','userId'], likes);
  log('forum threads', threads.length);
  log('forum posts', posts.length);
  log('forum likes', likes.length);

  // ------------------------------------------------------------------ messenger
  const convs = [];
  const parts = [];
  const msgs = [];
  const recips = [];
  for (let i = 0; i < 10; i++) {
    const type = i < 4 ? 'BATCH_BROADCAST' : i < 7 ? 'COURSE_BROADCAST' : 'DIRECT';
    const b = pick(batches);
    const c = pick(courses);
    const conv = { id: uid(), type, createdAt: daysAgo(intBetween(10, 120)),
      courseId: type === 'COURSE_BROADCAST' ? c.id : null, batchId: type === 'BATCH_BROADCAST' ? b.id : null,
      createdById: pick(faculty).id };
    convs.push(conv);
    const members = type === 'DIRECT'
      ? [conv.createdById, vishnu ? vishnu.id : pick(allStudents)]
      : [conv.createdById, ...pickN(allStudents, 12)];
    for (const m of [...new Set(members)]) parts.push({ id: uid(), conversationId: conv.id, userId: m });
    for (let k = 0; k < intBetween(4, 10); k++) {
      const sender = k % 3 === 2 ? pick(members.slice(1)) : conv.createdById;
      const msg = { id: uid(), body: pick(MESSAGES), createdAt: new Date(conv.createdAt.getTime() + k * 3600000 * 6), conversationId: conv.id, senderId: sender };
      msgs.push(msg);
      for (const m of [...new Set(members)].filter((x) => x !== sender)) {
        recips.push({ id: uid(), readAt: rnd() < 0.6 ? new Date(msg.createdAt.getTime() + 3600000) : null, messageId: msg.id, userId: m });
      }
    }
  }
  await insert('Conversation', ['id','type','createdAt','courseId','batchId','createdById'], convs);
  await insert('ConversationParticipant', ['id','conversationId','userId'], parts);
  await insert('Message', ['id','body','createdAt','conversationId','senderId'], msgs);
  await insert('MessageRecipient', ['id','readAt','messageId','userId'], recips);
  log('conversations', convs.length);
  log('messages', msgs.length);

  // ------------------------------------------------------------------ AI artefacts + flashcards
  const fcLessons = lessons.filter((l) => l.flashcardsEnabled).slice(0, 90);
  const flashcards = [];
  for (const l of fcLessons) {
    for (let i = 0; i < intBetween(4, 8); i++) {
      flashcards.push({ id: uid(), front: pick(['Define the term','State the formula','What is the SI unit?','Name the reaction','State the law','What is the exception?']) + ` (${l.title.split(' ')[0]})`, back: pick(['Refer to the derivation in the lesson notes.','Standard result — memorise the form, not the derivation.','Applies only under equilibrium conditions.','Watch the sign convention here.']), order: i, lessonId: l.id });
    }
  }
  await insert('Flashcard', ['id','front','back','order','lessonId'], flashcards);
  const fcProg = [];
  const seenFc = new Set();
  for (const f of pickN(flashcards, 420)) {
    const sid = pick(allStudents);
    const key = `${sid}|${f.id}`;
    if (seenFc.has(key)) continue;
    seenFc.add(key);
    fcProg.push({ id: uid(), studentId: sid, flashcardId: f.id, status: pick(['NEW','LEARNING','KNOWN','KNOWN']) });
  }
  const fcCols = (await q(`SELECT column_name FROM information_schema.columns WHERE table_name='FlashcardProgress'`)).map((r) => r.column_name);
  await insert('FlashcardProgress', fcCols.filter((c) => ['id','studentId','flashcardId','status'].includes(c)), fcProg);
  const lNotes = pickN(lessons.filter((l) => l.aiNotesEnabled), 70).map((l) => ({
    id: uid(), summary: 'This lesson covers the core derivation, the two standard problem patterns built on it, and the sign conventions that most commonly cost marks in the exam.',
    keyPoints: ['Start from the constraint equations before applying conservation laws','The standard result holds only for rigid bodies about a fixed axis','Watch the sign convention when the direction of motion reverses','Two past-paper patterns are built directly on this derivation'],
    updatedAt: now, lessonId: l.id,
  }));
  await insert('LessonNote', ['id','summary','keyPoints','updatedAt','lessonId'], lNotes);
  const decks = pickN(lessons.filter((l) => l.summaryDeckEnabled), 40).map((l) => ({
    id: uid(), cards: ['Core idea in one line','The derivation in three steps','Where students lose marks','One past-paper application','Quick self-check question'], updatedAt: now, lessonId: l.id,
  }));
  await insert('SummaryDeck', ['id','cards','updatedAt','lessonId'], decks);
  // CheatSheet.pages is jsonb — CheatSheetPage[] of { title, bullets[], table?, examTip? }.
  const sheets = pickN(lessons.filter((l) => l.cheatSheetEnabled), 35).map((l) => ({
    id: uid(), lessonId: l.id, updatedAt: now, posterImageKey: null,
    pages: JSON.stringify([
      { title: 'Key formulae', bullets: ['State the standard form before substituting','Check dimensions on every result','Note which constants are given vs assumed'], examTip: 'Two marks are usually reserved for the correct form alone.' },
      { title: 'Standard results', bullets: ['Applies to rigid bodies about a fixed axis','Reduces to the simple case when damping is zero','Holds only at equilibrium'], table: { headers: ['Case', 'Result'], rows: [['Symmetric', 'Simplifies to the standard form'], ['Asymmetric', 'Retain the correction term']] } },
      { title: 'Common traps', bullets: ['Sign convention flips when motion reverses','Do not mix radians and degrees','The approximation fails for large amplitude'], examTip: 'Most lost marks here are sign errors, not concept errors.' },
    ]),
  }));
  await insert('CheatSheet', ['id','pages','posterImageKey','updatedAt','lessonId'], sheets);
  log('flashcards', flashcards.length);
  log('AI notes / decks / sheets', lNotes.length + decks.length + sheets.length);

  // ------------------------------------------------------------------ notes banks
  const nbs = Array.from({ length: 4 }, (_, i) => ({ id: uid(), title: pick(['Formula Handbooks','Previous Year Papers','Revision Capsules','Chapter Summaries']) + ` ${i + 1}`, published: true, createdAt: daysAgo(150), updatedAt: now, createdById: adminId }));
  await insert('NotesBank', ['id','title','published','createdAt','updatedAt','createdById'], nbs);
  const notes = [];
  if (noteFiles.length) {
    for (const nb of nbs) {
      for (let i = 0; i < 5; i++) {
        const f = pick(noteFiles);
        const c = pick(courses);
        notes.push({ id: uid(), name: pick(['Formula Sheet','Solved Paper 2025','Quick Revision','Chapter Notes','Practice Set']) + ` ${i + 1}`, fileUrl: f.u, fileName: f.n, order: i, createdAt: daysAgo(intBetween(10, 140)), updatedAt: now, notesBankId: nb.id, courseId: c.id, chapterId: null });
      }
    }
  }
  await insert('Note', ['id','name','fileUrl','fileName','order','createdAt','updatedAt','notesBankId','courseId','chapterId'], notes);
  // Join table: composite PK, no id column. Cascades from NotesBank, so the undo
  // script removes these implicitly and they need no manifest entry.
  const nbLinks = [];
  const seenNb = new Set();
  for (const nb of nbs) {
    for (const b of pickN(batches, 2)) {
      const k = `${nb.id}|${b.id}`;
      if (seenNb.has(k)) continue;
      seenNb.add(k);
      nbLinks.push({ notesBankId: nb.id, batchId: b.id });
    }
  }
  await insert('NotesBankBatch', ['notesBankId','batchId'], nbLinks);
  log('notes banks / notes', nbs.length + notes.length);

  // ------------------------------------------------------------------ planner: todos, reflections, plan items
  const focusStudents = [...(vishnu ? [vishnu.id] : []), ...pickN(students.map((s) => s.id), 14)];
  const todos = [];
  const reflections = [];
  const seenRef = new Set();
  for (const sid of focusStudents) {
    for (let i = 0; i < intBetween(4, 9); i++) {
      const d = new Date(Date.now() + (intBetween(-8, 10)) * DAY);
      d.setUTCHours(0, 0, 0, 0);
      todos.push({ id: uid(), date: d, text: pick(['Revise rotational dynamics','Attempt mock test 3','Finish organic reactions map','Review yesterday\'s mistakes','Read NCERT chapter 6','Solve 20 numericals','Flashcards: 15 minutes','Watch the doubt session recording']), completed: rnd() < 0.45, createdAt: daysAgo(5), updatedAt: now, userId: sid });
    }
    for (let i = 0; i < intBetween(2, 5); i++) {
      const d = daysAgo(intBetween(1, 30)); d.setUTCHours(0, 0, 0, 0);
      const key = `${sid}|${d.toISOString()}`;
      if (seenRef.has(key)) continue;
      seenRef.add(key);
      reflections.push({ id: uid(), date: d, wentWell: pick(['Finished the full problem set without checking solutions.','Stayed consistent for all five days this week.','Mock score improved by 12 marks.','Cleared two long-standing doubts.']), toImprove: pick(['Spent too long on one question.','Need to start revision earlier in the day.','Silly mistakes in calculation — slow down.','Skipped flashcards three days running.']), createdAt: now, updatedAt: now, studentId: sid });
    }
  }
  await insert('Todo', ['id','date','text','completed','createdAt','updatedAt','userId'], todos);
  await insert('Reflection', ['id','date','wentWell','toImprove','createdAt','updatedAt','studentId'], reflections);
  const planItems = [];
  for (const b of batches.slice(0, 6)) {
    for (let i = 0; i < 10; i++) {
      const c = pick(courses);
      const ls = lessonsByCourse.get(c.id) || [];
      planItems.push({ id: uid(), scheduledFor: new Date(Date.now() + intBetween(-20, 25) * DAY), type: pick(['VIDEO','NOTES','TEST','PRACTICE','OTHER']), title: pick(['Watch: core derivation','Read: chapter summary','Attempt: sectional test','Practice: 25 numericals','Revise: formula sheet']), resourceKind: ls.length ? 'lesson' : null, resourceId: ls.length ? pick(ls).id : null, courseId: c.id, createdAt: now, updatedAt: now, createdById: pick(faculty).id, batchId: b.id, studentId: null });
    }
  }
  await insert('StudyPlanItem', ['id','scheduledFor','type','title','resourceKind','resourceId','courseId','createdAt','updatedAt','createdById','batchId','studentId'], planItems);
  log('todos / reflections / plan items', todos.length + reflections.length + planItems.length);

  // ------------------------------------------------------------------ mentors
  const avail = [];
  for (const m of mentors) {
    for (const d of [1, 2, 3, 4, 5]) {
      for (const t of ['10:00', '11:00', '16:00', '17:00', '18:00']) {
        avail.push({ id: uid(), dayOfWeek: d, time: t, createdAt: daysAgo(100), mentorId: m.id });
      }
    }
  }
  await insert('MentorAvailability', ['id','dayOfWeek','time','createdAt','mentorId'], avail);
  const bookings = [];
  const seenBk = new Set();
  for (const a of pickN(avail, 40)) {
    const d = new Date(Date.now() + intBetween(-14, 14) * DAY);
    d.setUTCHours(0, 0, 0, 0);
    const key = `${a.id}|${d.toISOString()}`;
    if (seenBk.has(key)) continue;
    seenBk.add(key);
    bookings.push({ id: uid(), date: d, createdAt: daysAgo(intBetween(1, 20)), cancelledAt: rnd() < 0.12 ? now : null, availabilityId: a.id, mentorId: a.mentorId, studentId: pick(focusStudents) });
  }
  await insert('MentorBooking', ['id','date','createdAt','cancelledAt','availabilityId','mentorId','studentId'], bookings);
  log('mentor slots / bookings', avail.length + bookings.length);

  // ------------------------------------------------------------------ subscriptions
  const subsc = [
    ['JEE Complete — Annual', 'Every JEE course, all mock series, and live doubt sessions for 12 months.'],
    ['NEET Complete — Annual', 'Full NEET Biology, Physics and Chemistry with weekly tests.'],
    ['CA Foundation Bundle', 'Accounting, Business Maths and mock papers in one plan.'],
  ].map(([title, description]) => ({ id: uid(), title, description, createdAt: daysAgo(180), updatedAt: now }));
  await insert('Subscription', ['id','title','description','createdAt','updatedAt'], subsc);
  const scLinks = [];
  const stLinks = [];
  const seLinks = [];
  const seenSC = new Set(); const seenST = new Set(); const seenSE = new Set();
  for (const s of subsc) {
    for (const c of pickN(courses, 6)) { const k = `${s.id}|${c.id}`; if (seenSC.has(k)) continue; seenSC.add(k); scLinks.push({ id: uid(), subscriptionId: s.id, courseId: c.id }); }
    for (const t of pickN(tests, 4)) { const k = `${s.id}|${t.id}`; if (seenST.has(k)) continue; seenST.add(k); stLinks.push({ id: uid(), subscriptionId: s.id, testId: t.id }); }
    for (const sid of pickN(allStudents, 12)) { const k = `${s.id}|${sid}`; if (seenSE.has(k)) continue; seenSE.add(k); seLinks.push({ id: uid(), subscriptionId: s.id, studentId: sid, enrolledAt: daysAgo(intBetween(5, 150)) }); }
  }
  await insert('SubscriptionCourse', ['id','subscriptionId','courseId'], scLinks);
  await insert('SubscriptionTest', ['id','subscriptionId','testId'], stLinks);
  await insert('SubscriptionEnrollment', ['id','subscriptionId','studentId','enrolledAt'], seLinks);
  log('subscriptions + links', subsc.length + scLinks.length + stLinks.length + seLinks.length);

  fs.writeFileSync(MANIFEST, JSON.stringify({ createdAt: new Date().toISOString(), demoDomain: DEMO_DOMAIN, demoPassword: DEMO_PASSWORD, ids: manifest }, null, 2));
  const total = Object.values(manifest).reduce((s, a) => s + a.length, 0);
  console.log(`\nSeeded ${total} rows across ${Object.keys(manifest).length} tables.`);
  console.log(`Manifest: ${MANIFEST}`);
  console.log(`Demo logins: student1${DEMO_DOMAIN} … student40${DEMO_DOMAIN}, faculty1..6${DEMO_DOMAIN}  password: ${DEMO_PASSWORD}`);
}

main()
  .then(() => client.end())
  .catch(async (e) => {
    console.error('\nFAILED:', e.message);
    if (Object.keys(manifest).length) {
      fs.writeFileSync(MANIFEST, JSON.stringify({ createdAt: new Date().toISOString(), partial: true, demoDomain: DEMO_DOMAIN, ids: manifest }, null, 2));
      console.error(`Partial manifest written to ${MANIFEST} — run seed-demo-undo.js to roll back.`);
    }
    try { await client.end(); } catch {}
    process.exit(1);
  });
