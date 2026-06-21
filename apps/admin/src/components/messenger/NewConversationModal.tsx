"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { messengerApi, coursesApi, batchesApi, ApiError, type ConversationType, type Course, type Batch } from "@/lib/api";
import Modal from "@/components/Modal";
import { useMessenger } from "./MessengerContext";

type Contact = { id: string; fullName: string; email: string; role: "STUDENT" | "FACULTY" | "ADMIN" };

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  border: "1px solid var(--line)",
  borderRadius: 10,
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  background: "var(--bg)",
  width: "100%",
};

export default function NewConversationModal({ basePath, mode, onClose }: { basePath: string; mode: "contact-only" | "full"; onClose: () => void }) {
  const router = useRouter();
  const { refresh } = useMessenger();

  const [type, setType] = useState<ConversationType>("DIRECT");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    messengerApi.listContacts().then(setContacts).catch(() => {});
    if (mode === "full") coursesApi.list().then(setCourses).catch(() => {});
  }, [mode]);

  useEffect(() => {
    if (type !== "BATCH_BROADCAST" || !selectedCourseId) {
      setBatches([]);
      return;
    }
    batchesApi.list(selectedCourseId).then(setBatches).catch(() => {});
  }, [type, selectedCourseId]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const conversation = await messengerApi.createConversation(
        type === "DIRECT"
          ? { type: "DIRECT", userId: selectedUserId }
          : type === "COURSE_BROADCAST"
            ? { type: "COURSE_BROADCAST", courseId: selectedCourseId }
            : { type: "BATCH_BROADCAST", batchId: selectedBatchId },
      );
      refresh();
      onClose();
      router.push(`${basePath}/${conversation.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to start conversation");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Modal title="New message" onClose={onClose}>
      <form onSubmit={onCreate} style={{ display: "grid", gap: 14 }}>
        {mode === "full" && (
          <select value={type} onChange={(e) => setType(e.target.value as ConversationType)} style={inputStyle}>
            <option value="DIRECT">Direct message</option>
            <option value="COURSE_BROADCAST">Course announcement</option>
            <option value="BATCH_BROADCAST">Batch announcement</option>
          </select>
        )}

        {type === "DIRECT" && (
          <select required value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} style={inputStyle}>
            <option value="">{mode === "contact-only" ? "Select a faculty or admin…" : "Select a person…"}</option>
            {contacts.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName} ({u.role})
              </option>
            ))}
          </select>
        )}

        {type === "COURSE_BROADCAST" && (
          <select required value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)} style={inputStyle}>
            <option value="">Select a course…</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        )}

        {type === "BATCH_BROADCAST" && (
          <>
            <select required value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)} style={inputStyle}>
              <option value="">Select a course…</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            <select required value={selectedBatchId} onChange={(e) => setSelectedBatchId(e.target.value)} style={inputStyle} disabled={!selectedCourseId}>
              <option value="">Select a batch…</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </>
        )}

        {error && <p style={{ color: "var(--red)", fontSize: 12.5, margin: 0 }}>{error}</p>}

        <button
          type="submit"
          disabled={creating}
          style={{
            padding: "11px 20px",
            background: "var(--ink)",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: creating ? "default" : "pointer",
            opacity: creating ? 0.6 : 1,
          }}
        >
          {creating ? "Starting…" : "Start conversation"}
        </button>
      </form>
    </Modal>
  );
}
