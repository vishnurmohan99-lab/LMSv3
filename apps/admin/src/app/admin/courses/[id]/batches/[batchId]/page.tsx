"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  batchesApi,
  sessionsApi,
  usersApi,
  batchStatusTypesApi,
  bulkOperationsApi,
  ApiError,
  type BatchTree,
  type BatchStatusType,
  type Session,
  type SessionStatus,
  type Profile,
} from "@/lib/api";
import Modal from "@/components/Modal";
import Spinner from "@/components/Spinner";
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

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink2)" strokeWidth="1.8">
      <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="1.8">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" />
    </svg>
  );
}

function toLocalDatetimeValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function BatchDetailPage() {
  const params = useParams<{ id: string; batchId: string }>();
  const courseId = params.id;
  const batchId = params.batchId;
  const confirm = useConfirm();

  const [batch, setBatch] = useState<BatchTree | null>(null);
  const [students, setStudents] = useState<Profile[]>([]);
  const [statusTypes, setStatusTypes] = useState<BatchStatusType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showEditBatch, setShowEditBatch] = useState(false);
  const [editName, setEditName] = useState("");
  const [editStatusId, setEditStatusId] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [savingBatch, setSavingBatch] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);

  const [showExtend, setShowExtend] = useState(false);
  const [extendDate, setExtendDate] = useState("");
  const [extending, setExtending] = useState(false);
  const [extendError, setExtendError] = useState<string | null>(null);

  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [enrolling, setEnrolling] = useState(false);
  const [importingCsv, setImportingCsv] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [lastEnroll, setLastEnroll] = useState<{ bulkOperationId?: string; enrolled: number } | null>(null);

  const [showAddSession, setShowAddSession] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [sessionTitle, setSessionTitle] = useState("");
  const [sessionScheduledAt, setSessionScheduledAt] = useState("");
  const [sessionDuration, setSessionDuration] = useState(60);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("SCHEDULED");
  const [savingSession, setSavingSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    Promise.all([batchesApi.get(batchId), usersApi.list(), batchStatusTypesApi.list()])
      .then(([b, users, statuses]) => {
        setBatch(b);
        setStudents(users.filter((u) => u.role === "STUDENT"));
        setStatusTypes(statuses);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load batch"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [batchId]);

  function openEditBatch() {
    if (!batch) return;
    setEditName(batch.name);
    setEditStatusId(batch.statusId);
    setEditStartDate(batch.startDate.slice(0, 10));
    setEditEndDate(batch.endDate ? batch.endDate.slice(0, 10) : "");
    setBatchError(null);
    setShowEditBatch(true);
  }

  async function onSaveBatch(e: React.FormEvent) {
    e.preventDefault();
    setSavingBatch(true);
    setBatchError(null);
    try {
      await batchesApi.update(batchId, {
        name: editName,
        statusId: editStatusId,
        startDate: new Date(editStartDate).toISOString(),
        endDate: editEndDate ? new Date(editEndDate).toISOString() : undefined,
      });
      setShowEditBatch(false);
      load();
    } catch (err) {
      setBatchError(err instanceof ApiError ? err.message : "Failed to save batch");
    } finally {
      setSavingBatch(false);
    }
  }

  function openExtend() {
    if (!batch) return;
    setExtendDate(batch.endDate ? batch.endDate.slice(0, 10) : "");
    setExtendError(null);
    setShowExtend(true);
  }

  async function onExtend(e: React.FormEvent) {
    e.preventDefault();
    setExtending(true);
    setExtendError(null);
    try {
      await batchesApi.extend(batchId, new Date(extendDate).toISOString());
      setShowExtend(false);
      load();
    } catch (err) {
      setExtendError(err instanceof ApiError ? err.message : "Failed to extend batch");
    } finally {
      setExtending(false);
    }
  }

  async function onEnrollSelected() {
    if (selectedStudentIds.length === 0) return;
    setEnrolling(true);
    setEnrollError(null);
    try {
      const result = await batchesApi.bulkEnroll(batchId, selectedStudentIds);
      setSelectedStudentIds([]);
      setLastEnroll({ bulkOperationId: result.bulkOperationId, enrolled: result.enrolled });
      load();
    } catch (err) {
      setEnrollError(err instanceof ApiError ? err.message : "Failed to enroll students");
    } finally {
      setEnrolling(false);
    }
  }

  async function onImportCsv(file: File) {
    setImportingCsv(true);
    setEnrollError(null);
    try {
      const result = await batchesApi.enrollCsv(batchId, file);
      setLastEnroll({ bulkOperationId: result.bulkOperationId, enrolled: result.enrolled });
      load();
    } catch (err) {
      setEnrollError(err instanceof ApiError ? err.message : "Failed to import CSV");
    } finally {
      setImportingCsv(false);
    }
  }

  async function onUndoEnroll() {
    if (!lastEnroll?.bulkOperationId) return;
    await bulkOperationsApi.undo(lastEnroll.bulkOperationId);
    setLastEnroll(null);
    load();
  }

  async function onRemoveStudent(studentId: string) {
    if (!(await confirm({ message: "Remove this student from the batch?" }))) return;
    await batchesApi.unenroll(batchId, studentId);
    load();
  }

  function openAddSession() {
    setSessionTitle("");
    setSessionScheduledAt("");
    setSessionDuration(60);
    setSessionStatus("SCHEDULED");
    setSessionError(null);
    setShowAddSession(true);
  }

  function openEditSession(session: Session) {
    setSessionTitle(session.title);
    setSessionScheduledAt(toLocalDatetimeValue(session.scheduledAt));
    setSessionDuration(session.durationMin);
    setSessionStatus(session.status);
    setSessionError(null);
    setEditingSession(session);
  }

  async function onSaveSession(e: React.FormEvent) {
    e.preventDefault();
    setSavingSession(true);
    setSessionError(null);
    try {
      const data = {
        title: sessionTitle,
        scheduledAt: new Date(sessionScheduledAt).toISOString(),
        durationMin: sessionDuration,
        status: sessionStatus,
      };
      if (editingSession) {
        await sessionsApi.update(editingSession.id, data);
        setEditingSession(null);
      } else {
        await sessionsApi.create(batchId, data);
        setShowAddSession(false);
      }
      load();
    } catch (err) {
      setSessionError(err instanceof ApiError ? err.message : "Failed to save session");
    } finally {
      setSavingSession(false);
    }
  }

  async function onDeleteSession(id: string) {
    if (!(await confirm({ message: "Delete this session? This cannot be undone." }))) return;
    await sessionsApi.remove(id);
    load();
  }

  if (loading) return <div style={{ padding: 40 }}><p style={{ color: "var(--ink2)" }}>Loading…</p></div>;
  if (error || !batch) return <div style={{ padding: 40 }}><p style={{ color: "var(--red)" }}>{error ?? "Batch not found"}</p></div>;

  const enrolledIds = new Set(batch.enrollments.map((e) => e.studentId));
  const availableStudents = students.filter((s) => !enrolledIds.has(s.id));

  return (
    <div className="fade-in" style={{ padding: "30px 40px 60px" }}>
      <Link href={`/admin/courses/${courseId}`} style={{ color: "var(--orange)", fontWeight: 700, fontSize: 13 }}>
        ← Back to course
      </Link>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>{batch.name}</h1>
          <div style={{ fontSize: 13, color: "var(--ink2)", marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: batch.status.color ?? "var(--ink3)" }} />
            {batch.status.name} · {new Date(batch.startDate).toLocaleDateString()}
            {batch.endDate ? ` – ${new Date(batch.endDate).toLocaleDateString()}` : ""}
          </div>
        </div>
        <span style={{ display: "flex", gap: 10 }}>
          <button onClick={openExtend} style={{ ...btnStyle, background: "var(--bg)", color: "var(--ink2)" }}>
            Extend batch
          </button>
          <button onClick={openEditBatch} style={{ ...btnStyle, background: "var(--bg)", color: "var(--ink2)", display: "flex", alignItems: "center", gap: 6 }}>
            <EditIcon /> Edit batch
          </button>
        </span>
      </div>

      {showEditBatch && (
        <Modal title="Edit batch" onClose={() => setShowEditBatch(false)}>
          <form onSubmit={onSaveBatch} style={{ display: "grid", gap: 14 }}>
            <input required autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} style={inputStyle} />
            <select value={editStatusId} onChange={(e) => setEditStatusId(e.target.value)} style={inputStyle}>
              {statusTypes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <div style={{ display: "flex", gap: 10 }}>
              <input required type="date" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
              <input type="date" value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            </div>
            <button
              type="submit"
              disabled={savingBatch}
              style={{ ...btnStyle, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: savingBatch ? 0.7 : 1 }}
            >
              {savingBatch && <Spinner />}
              {savingBatch ? "Saving…" : "Save changes"}
            </button>
            {batchError && <span style={{ color: "var(--red)", fontSize: 12 }}>{batchError}</span>}
          </form>
        </Modal>
      )}

      {showExtend && (
        <Modal title="Extend batch" onClose={() => setShowExtend(false)} maxWidth={380}>
          <form onSubmit={onExtend} style={{ display: "grid", gap: 14 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 8 }}>New end date</div>
              <p style={{ fontSize: 12, color: "var(--ink3)", marginBottom: 8 }}>
                Also pushes every enrolled student&apos;s access window to this date.
              </p>
              <input required type="date" value={extendDate} onChange={(e) => setExtendDate(e.target.value)} style={{ ...inputStyle, width: "100%" }} />
            </div>
            <button
              type="submit"
              disabled={extending}
              style={{ ...btnStyle, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: extending ? 0.7 : 1 }}
            >
              {extending && <Spinner />}
              {extending ? "Extending…" : "Extend"}
            </button>
            {extendError && <span style={{ color: "var(--red)", fontSize: 12 }}>{extendError}</span>}
          </form>
        </Modal>
      )}

      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Roster</div>
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 12,
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: "var(--rm)",
          padding: 14,
          alignItems: "flex-end",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink2)", marginBottom: 6 }}>Add students</div>
          <select
            multiple
            value={selectedStudentIds}
            onChange={(e) => setSelectedStudentIds(Array.from(e.target.selectedOptions, (o) => o.value))}
            style={{ ...inputStyle, width: "100%", height: 90 }}
          >
            {availableStudents.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName} ({s.email})
              </option>
            ))}
          </select>
        </div>
        <button onClick={onEnrollSelected} disabled={enrolling || selectedStudentIds.length === 0} style={{ ...btnStyle, opacity: enrolling ? 0.7 : 1 }}>
          {enrolling ? "Enrolling…" : "Enroll"}
        </button>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink2)", marginBottom: 6 }}>Or import a CSV (email column)</div>
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={importingCsv}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImportCsv(file);
              e.target.value = "";
            }}
            style={{ fontSize: 13 }}
          />
        </div>
      </div>

      {enrollError && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 12 }}>{enrollError}</p>}

      {lastEnroll && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 14px",
            background: "var(--green-soft)",
            color: "var(--green)",
            borderRadius: 10,
            fontSize: 13,
            marginBottom: 18,
          }}
        >
          <span>Enrolled {lastEnroll.enrolled} student{lastEnroll.enrolled === 1 ? "" : "s"}.</span>
          {lastEnroll.bulkOperationId && (
            <button onClick={onUndoEnroll} style={{ background: "none", border: "none", color: "var(--green)", fontWeight: 700, fontSize: 13, cursor: "pointer", textDecoration: "underline" }}>
              Undo
            </button>
          )}
        </div>
      )}

      {batch.enrollments.length === 0 ? (
        <p style={{ color: "var(--ink2)", marginBottom: 32 }}>No students enrolled yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 8, marginBottom: 32 }}>
          {batch.enrollments.map((enrollment) => (
            <div
              key={enrollment.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 14px",
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: 10,
              }}
            >
              <div style={{ fontSize: 13 }}>
                <span style={{ fontWeight: 700 }}>{enrollment.student.fullName}</span>{" "}
                <span style={{ color: "var(--ink3)" }}>{enrollment.student.email}</span>
              </div>
              <button
                onClick={() => onRemoveStudent(enrollment.studentId)}
                title="Remove from batch"
                style={{ display: "flex", background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Sessions</div>
        <button onClick={openAddSession} style={{ ...btnStyle, display: "flex", alignItems: "center", gap: 7 }}>
          <PlusIcon />
          Add session
        </button>
      </div>

      {(showAddSession || editingSession) && (
        <Modal title={editingSession ? "Edit session" : "Add session"} onClose={() => (editingSession ? setEditingSession(null) : setShowAddSession(false))}>
          <form onSubmit={onSaveSession} style={{ display: "grid", gap: 14 }}>
            <input required autoFocus placeholder="Session title" value={sessionTitle} onChange={(e) => setSessionTitle(e.target.value)} style={inputStyle} />
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 8 }}>Scheduled at</div>
                <input
                  required
                  type="datetime-local"
                  value={sessionScheduledAt}
                  onChange={(e) => setSessionScheduledAt(e.target.value)}
                  style={{ ...inputStyle, width: "100%" }}
                />
              </div>
              <div style={{ width: 130 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 8 }}>Duration (min)</div>
                <input
                  required
                  type="number"
                  min={1}
                  value={sessionDuration}
                  onChange={(e) => setSessionDuration(Number(e.target.value))}
                  style={{ ...inputStyle, width: "100%" }}
                />
              </div>
            </div>
            <select value={sessionStatus} onChange={(e) => setSessionStatus(e.target.value as SessionStatus)} style={inputStyle}>
              <option value="SCHEDULED">Scheduled</option>
              <option value="LIVE">Live</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="RESCHEDULED">Rescheduled</option>
            </select>
            <button
              type="submit"
              disabled={savingSession}
              style={{ ...btnStyle, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: savingSession ? 0.7 : 1 }}
            >
              {savingSession && <Spinner />}
              {savingSession ? "Saving…" : editingSession ? "Save changes" : "Add session"}
            </button>
            {sessionError && <span style={{ color: "var(--red)", fontSize: 12 }}>{sessionError}</span>}
          </form>
        </Modal>
      )}

      {batch.sessions.length === 0 ? (
        <p style={{ color: "var(--ink2)" }}>No sessions scheduled yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {batch.sessions.map((session) => (
            <div
              key={session.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 14px",
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: 10,
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{session.title}</div>
                <div style={{ fontSize: 12, color: "var(--ink3)" }}>
                  {new Date(session.scheduledAt).toLocaleString()} · {session.durationMin} min · {session.status}
                </div>
              </div>
              <span style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <button onClick={() => openEditSession(session)} title="Edit session" style={{ display: "flex", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  <EditIcon />
                </button>
                <button onClick={() => onDeleteSession(session.id)} title="Delete session" style={{ display: "flex", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  <TrashIcon />
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
