"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  batchesApi,
  segmentsApi,
  usersApi,
  batchStatusTypesApi,
  ApiError,
  type Batch,
  type Segment,
  type Profile,
  type BatchStatusType,
} from "@/lib/api";
import Modal from "@/components/Modal";
import Spinner from "@/components/Spinner";

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  border: "1px solid var(--line)",
  borderRadius: 10,
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  background: "var(--card)",
  width: "100%",
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

export default function AdminBatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [facultyUsers, setFacultyUsers] = useState<Profile[]>([]);
  const [statusTypes, setStatusTypes] = useState<BatchStatusType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [segmentId, setSegmentId] = useState("");
  const [subsegmentId, setSubsegmentId] = useState("");
  const [statusId, setStatusId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [facultyId, setFacultyId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    Promise.all([batchesApi.listAll(), segmentsApi.list(), usersApi.list(), batchStatusTypesApi.list()])
      .then(([b, s, users, statuses]) => {
        setBatches(b);
        setSegments(s);
        setFacultyUsers(users.filter((u) => u.role === "FACULTY"));
        setStatusTypes(statuses);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load batches"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function openAdd() {
    setName("");
    setSegmentId("");
    setSubsegmentId("");
    setStatusId(statusTypes.find((s) => s.isDefault)?.id ?? statusTypes[0]?.id ?? "");
    setStartDate("");
    setEndDate("");
    setFacultyId("");
    setSaveError(null);
    setShowAdd(true);
  }

  const selectedSegment = segments.find((s) => s.id === segmentId);
  const hasSubsegments = (selectedSegment?.subsegments.length ?? 0) > 0;

  function onSegmentChange(id: string) {
    setSegmentId(id);
    setSubsegmentId("");
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      await batchesApi.create({
        name,
        statusId,
        startDate: new Date(startDate).toISOString(),
        endDate: endDate ? new Date(endDate).toISOString() : undefined,
        facultyId: facultyId || undefined,
        segmentId: hasSubsegments ? undefined : segmentId,
        subsegmentId: hasSubsegments ? subsegmentId : undefined,
      });
      setShowAdd(false);
      load();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Failed to create batch");
    } finally {
      setSaving(false);
    }
  }

  const canSave = name.trim().length > 0 && startDate && !!segmentId && (!hasSubsegments || !!subsegmentId);

  return (
    <div className="fade-in" style={{ padding: "30px 40px 60px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>Batches</h1>
          <p style={{ color: "var(--ink2)", marginTop: 4, fontSize: 13.5 }}>
            A batch belongs to a segment or subsegment — every student in it gets access to all courses tagged there.
          </p>
        </div>
        <button onClick={openAdd} style={{ ...btnStyle, display: "flex", alignItems: "center", gap: 7 }}>
          <PlusIcon />
          Add batch
        </button>
      </div>

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {showAdd && (
        <Modal title="Add batch" onClose={() => setShowAdd(false)}>
          <form onSubmit={onSave} style={{ display: "grid", gap: 14 }}>
            <input required autoFocus placeholder="Batch name (e.g. 10A)" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />

            <select required value={segmentId} onChange={(e) => onSegmentChange(e.target.value)} style={inputStyle}>
              <option value="">Select segment…</option>
              {segments.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            {hasSubsegments && (
              <select required value={subsegmentId} onChange={(e) => setSubsegmentId(e.target.value)} style={inputStyle}>
                <option value="">Select subsegment…</option>
                {selectedSegment!.subsegments.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
            )}

            <select value={statusId} onChange={(e) => setStatusId(e.target.value)} style={inputStyle}>
              {statusTypes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 8 }}>Start date</div>
                <input required type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 8 }}>End date (optional)</div>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={inputStyle} />
              </div>
            </div>

            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 8 }}>Lead faculty (optional)</div>
              <select value={facultyId} onChange={(e) => setFacultyId(e.target.value)} style={inputStyle}>
                <option value="">— None —</option>
                {facultyUsers.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.fullName} ({f.email})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={!canSave || saving}
              style={{ ...btnStyle, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: !canSave || saving ? 0.7 : 1 }}
            >
              {saving && <Spinner />}
              {saving ? "Creating…" : "Add batch"}
            </button>
            {saveError && <span style={{ color: "var(--red)", fontSize: 12 }}>{saveError}</span>}
          </form>
        </Modal>
      )}

      {loading ? (
        <p style={{ color: "var(--ink2)" }}>Loading…</p>
      ) : batches.length === 0 ? (
        <p style={{ color: "var(--ink2)" }}>No batches yet — add the first one above.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 18 }}>
          {batches.map((batch) => (
            <Link
              key={batch.id}
              href={`/admin/batches/${batch.id}`}
              className="entity-card"
              style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 18, display: "grid", gap: 10 }}
            >
              <div style={{ fontWeight: 700, fontSize: 15 }}>{batch.name}</div>
              <div style={{ fontSize: 12, color: "var(--ink3)" }}>{batch.segment?.name ?? batch.subsegment?.name ?? "Unscoped"}</div>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "2px 8px",
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  background: "var(--bg)",
                  color: "var(--ink3)",
                  width: "max-content",
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: batch.status.color ?? "var(--ink3)" }} />
                {batch.status.name}
              </span>
              <div style={{ fontSize: 12, color: "var(--ink3)" }}>
                {batch.faculty ? `Faculty: ${batch.faculty.fullName}` : "No faculty assigned"} · {batch._count?.enrollments ?? 0} student
                {(batch._count?.enrollments ?? 0) === 1 ? "" : "s"}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
