/**
 * Removes exactly the rows seed-demo.js created, using the ids recorded in
 * demo-manifest.json. Never touches anything not in that manifest.
 *
 *   node apps/api/prisma/demo/seed-demo-undo.js
 *
 * Order is child-first. Several relations here are required-and-restricted (a User
 * cannot be deleted while an Enrollment, TestAttempt, ForumThread or Course still
 * points at them), so the sequence matters even though some FKs cascade.
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '../../../..');
const API = path.join(REPO, 'apps/api');
for (const line of fs.readFileSync(path.join(API, '.env'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"\r\n]*)"?\s*$/);
  if (m) process.env[m[1]] = m[2];
}
const { Client } = require(path.join(REPO, 'node_modules/pg'));

const MANIFEST = path.join(__dirname, 'demo-manifest.json');
const client = new Client({ connectionString: process.env.DATABASE_URL });

const ORDER = [
  'TestAnswer', 'TestAttempt', 'TestQuestion', 'Test',
  'SubscriptionEnrollment', 'SubscriptionTest', 'SubscriptionCourse', 'Subscription',
  'MentorBooking', 'MentorAvailability',
  'StudyPlanItem', 'Reflection', 'Todo',
  'NotesBankBatch', 'Note', 'NotesBank',
  'CheatSheet', 'SummaryDeck', 'LessonNote', 'FlashcardProgress', 'Flashcard',
  'MessageRecipient', 'Message', 'ConversationParticipant', 'Conversation',
  'ForumThreadLike', 'ForumPost', 'ForumThread', 'ForumCategory',
  'Session', 'BatchEnrollment', 'Batch',
  'CourseReview', 'ChapterCompletion', 'LessonView', 'Enrollment',
  'Lesson', 'Chapter', 'Course',
  'User', 'Subsegment',
];

(async () => {
  if (!fs.existsSync(MANIFEST)) {
    console.error(`No manifest at ${MANIFEST} — nothing to undo.`);
    process.exit(1);
  }
  const { ids } = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  await client.connect();

  const unknown = Object.keys(ids).filter((t) => !ORDER.includes(t));
  if (unknown.length) throw new Error(`Manifest has tables missing from the delete order: ${unknown.join(', ')}`);

  let total = 0;
  await client.query('BEGIN');
  try {
    for (const table of ORDER) {
      const list = ids[table] || [];
      if (!list.length) continue;
      let removed = 0;
      for (let i = 0; i < list.length; i += 1000) {
        const chunk = list.slice(i, i + 1000);
        const r = await client.query(`DELETE FROM "${table}" WHERE id = ANY($1::text[])`, [chunk]);
        removed += r.rowCount;
      }
      total += removed;
      console.log(`  ${String(removed).padStart(5)}  ${table}${removed !== list.length ? `  (${list.length - removed} already gone)` : ''}`);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('\nRolled back — nothing was deleted.');
    throw e;
  }

  fs.renameSync(MANIFEST, MANIFEST.replace('.json', `.removed-${Date.now()}.json`));
  console.log(`\nRemoved ${total} demo rows. Manifest archived.`);
  await client.end();
})().catch(async (e) => {
  console.error('FAILED:', e.message);
  try { await client.end(); } catch {}
  process.exit(1);
});
