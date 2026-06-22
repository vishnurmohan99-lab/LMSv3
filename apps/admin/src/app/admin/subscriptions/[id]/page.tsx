"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { subscriptionsApi, coursesApi, testsApi, usersApi, ApiError, type SubscriptionDetail, type Course, type Test, type Profile } from "@/lib/api";
import { useConfirm } from "@/components/ConfirmProvider";

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  border: "1px solid var(--line)",
  borderRadius: 10,
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  background: "var(--card)",
};

const btnStyle: React.CSSProperties = {
  padding: "9px 16px",
  background: "var(--ink)",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 700,
  fontFamily: "inherit",
  cursor: "pointer",
};

export default function AdminSubscriptionDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const confirm = useConfirm();

  const [sub, setSub] = useState<SubscriptionDetail | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [students, setStudents] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [addCourseId, setAddCourseId] = useState("");
  const [addTestId, setAddTestId] = useState("");
  const [addStudentId, setAddStudentId] = useState("");

  function load() {
    setLoading(true);
    Promise.all([subscriptionsApi.getDetail(id), coursesApi.list(), testsApi.list(), usersApi.list()])
      .then(([s, c, t, users]) => {
        setSub(s);
        setCourses(c);
        setTests(t);
        setStudents(users.filter((u) => u.role === "STUDENT"));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load subscription"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]);

  async function onAddCourse() {
    if (!addCourseId) return;
    await subscriptionsApi.addCourse(id, addCourseId);
    setAddCourseId("");
    load();
  }

  async function onRemoveCourse(courseId: string) {
    if (!(await confirm({ message: "Remove this course from the subscription?" }))) return;
    await subscriptionsApi.removeCourse(id, courseId);
    load();
  }

  async function onAddTest() {
    if (!addTestId) return;
    await subscriptionsApi.addTest(id, addTestId);
    setAddTestId("");
    load();
  }

  async function onRemoveTest(testId: string) {
    if (!(await confirm({ message: "Remove this test from the subscription?" }))) return;
    await subscriptionsApi.removeTest(id, testId);
    load();
  }

  async function onEnrollStudent() {
    if (!addStudentId) return;
    await subscriptionsApi.enrollStudent(id, addStudentId);
    setAddStudentId("");
    load();
  }

  async function onUnenrollStudent(studentId: string) {
    if (!(await confirm({ message: "Remove this student from the subscription?" }))) return;
    await subscriptionsApi.unenrollStudent(id, studentId);
    load();
  }

  if (loading) return <div style={{ padding: 40 }}><p style={{ color: "var(--ink2)" }}>Loading…</p></div>;
  if (error || !sub) return <div style={{ padding: 40 }}><p style={{ color: "var(--red)" }}>{error ?? "Subscription not found"}</p></div>;

  const includedCourseIds = new Set(sub.courses.map((c) => c.course.id));
  const includedTestIds = new Set(sub.tests.map((t) => t.test.id));
  const enrolledStudentIds = new Set(sub.enrollments.map((e) => e.studentId));
  const availableCourses = courses.filter((c) => !includedCourseIds.has(c.id));
  const availableTests = tests.filter((t) => !includedTestIds.has(t.id));
  const availableStudents = students.filter((s) => !enrolledStudentIds.has(s.id));

  return (
    <div className="fade-in" style={{ padding: "30px 40px 60px", maxWidth: 880 }}>
      <Link href="/admin/subscriptions" style={{ color: "var(--orange)", fontWeight: 700, fontSize: 13 }}>
        ← Back to subscriptions
      </Link>

      <h1 style={{ fontSize: 24, fontWeight: 800, marginTop: 12 }}>{sub.title}</h1>
      {sub.description && <p style={{ color: "var(--ink2)", marginTop: 6 }}>{sub.description}</p>}
      <div style={{ fontSize: 13, color: "var(--ink3)", marginTop: 8 }}>{sub._count.enrollments} subscriber{sub._count.enrollments === 1 ? "" : "s"}</div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 28, marginBottom: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Courses ({sub.courses.length})</div>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <select value={addCourseId} onChange={(e) => setAddCourseId(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
          <option value="">Select a course to add…</option>
          {availableCourses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title} ({c.type})
            </option>
          ))}
        </select>
        <button onClick={onAddCourse} disabled={!addCourseId} style={{ ...btnStyle, opacity: addCourseId ? 1 : 0.6 }}>
          Add
        </button>
      </div>
      {sub.courses.length === 0 ? (
        <p style={{ color: "var(--ink3)", fontSize: 13, marginBottom: 24 }}>No courses added yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 8, marginBottom: 24 }}>
          {sub.courses.map(({ course }) => (
            <div key={course.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10 }}>
              <span style={{ fontSize: 13.5 }}>{course.title} <span style={{ color: "var(--ink3)" }}>({course.type})</span></span>
              <button onClick={() => onRemoveCourse(course.id)} style={{ background: "none", border: "none", color: "var(--red)", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Tests ({sub.tests.length})</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <select value={addTestId} onChange={(e) => setAddTestId(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
          <option value="">Select a test to add…</option>
          {availableTests.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
        <button onClick={onAddTest} disabled={!addTestId} style={{ ...btnStyle, opacity: addTestId ? 1 : 0.6 }}>
          Add
        </button>
      </div>
      {sub.tests.length === 0 ? (
        <p style={{ color: "var(--ink3)", fontSize: 13, marginBottom: 24 }}>No tests added yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 8, marginBottom: 24 }}>
          {sub.tests.map(({ test }) => (
            <div key={test.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10 }}>
              <span style={{ fontSize: 13.5 }}>{test.title}</span>
              <button onClick={() => onRemoveTest(test.id)} style={{ background: "none", border: "none", color: "var(--red)", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Subscribers ({sub.enrollments.length})</div>
      <p style={{ fontSize: 12.5, color: "var(--ink3)", marginBottom: 12 }}>No payment gateway yet — enroll manually after confirming payment outside the system.</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <select value={addStudentId} onChange={(e) => setAddStudentId(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
          <option value="">Select a student…</option>
          {availableStudents.map((s) => (
            <option key={s.id} value={s.id}>
              {s.fullName} ({s.email})
            </option>
          ))}
        </select>
        <button onClick={onEnrollStudent} disabled={!addStudentId} style={{ ...btnStyle, opacity: addStudentId ? 1 : 0.6 }}>
          Enroll
        </button>
      </div>
      {sub.enrollments.length === 0 ? (
        <p style={{ color: "var(--ink3)", fontSize: 13 }}>No subscribers yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {sub.enrollments.map((e) => (
            <div key={e.studentId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10 }}>
              <span style={{ fontSize: 13.5 }}>
                <b>{e.student.fullName}</b> <span style={{ color: "var(--ink3)" }}>{e.student.email}</span>
              </span>
              <button onClick={() => onUnenrollStudent(e.studentId)} style={{ background: "none", border: "none", color: "var(--red)", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
