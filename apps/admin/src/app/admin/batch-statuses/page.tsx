"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { batchStatusTypesApi, ApiError, type BatchStatusType } from "@/lib/api";
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
  background: "var(--bg)",
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

export default function BatchStatusesPage() {
  const confirm = useConfirm();
  const [statuses, setStatuses] = useState<BatchStatusType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<BatchStatusType | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#f26a1b");
  const [order, setOrder] = useState(0);
  const [isDefault, setIsDefault] = useState(false);
  const [isCompletionTarget, setIsCompletionTarget] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    batchStatusTypesApi
      .list()
      .then(setStatuses)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load statuses"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function openAdd() {
    setEditing(null);
    setName("");
    setColor("#f26a1b");
    setOrder(statuses.length);
    setIsDefault(false);
    setIsCompletionTarget(false);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(status: BatchStatusType) {
    setEditing(status);
    setName(status.name);
    setColor(status.color ?? "#f26a1b");
    setOrder(status.order);
    setIsDefault(status.isDefault);
    setIsCompletionTarget(status.isCompletionTarget);
    setFormError(null);
    setShowForm(true);
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const data = { name, color, order, isDefault, isCompletionTarget };
      if (editing) {
        await batchStatusTypesApi.update(editing.id, data);
      } else {
        await batchStatusTypesApi.create(data);
      }
      setShowForm(false);
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to save status");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(status: BatchStatusType) {
    if (!(await confirm({ message: `Delete the status "${status.name}"? This cannot be undone.` }))) return;
    try {
      await batchStatusTypesApi.remove(status.id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete status");
    }
  }

  return (
    <div className="fade-in" style={{ padding: "30px 40px 60px" }}>
      <Link href="/admin/batches" style={{ color: "var(--ink3)", fontSize: 13, fontWeight: 700 }}>
        ← Back to Batches
      </Link>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "14px 0 22px" }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4 }}>Batch Statuses</div>
        <button onClick={openAdd} style={{ ...btnStyle, display: "flex", alignItems: "center", gap: 8 }}>
          <PlusIcon />
          Add status
        </button>
      </div>

      {showForm && (
        <Modal title={editing ? "Edit status" : "Add status"} onClose={() => setShowForm(false)}>
          <form onSubmit={onSave} style={{ display: "grid", gap: 14 }}>
            <input required autoFocus placeholder="Status name" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink2)", marginBottom: 6 }}>Color</div>
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: "100%", height: 40, border: "1px solid var(--line)", borderRadius: 10 }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink2)", marginBottom: 6 }}>Order</div>
                <input type="number" value={order} onChange={(e) => setOrder(Number(e.target.value))} style={{ ...inputStyle, width: "100%" }} />
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink2)" }}>
              <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
              Default status for new batches
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink2)" }}>
              <input type="checkbox" checked={isCompletionTarget} onChange={(e) => setIsCompletionTarget(e.target.checked)} />
              Auto-complete target (batches move here once their end date passes)
            </label>
            <button
              type="submit"
              disabled={saving}
              style={{ ...btnStyle, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: saving ? 0.7 : 1 }}
            >
              {saving && <Spinner />}
              {saving ? "Saving…" : editing ? "Save changes" : "Add status"}
            </button>
            {formError && <span style={{ color: "var(--red)", fontSize: 12 }}>{formError}</span>}
          </form>
        </Modal>
      )}

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {loading ? (
        <p style={{ color: "var(--ink2)" }}>Loading…</p>
      ) : statuses.length === 0 ? (
        <p style={{ color: "var(--ink2)" }}>No statuses yet — add the first one above.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {statuses.map((status) => (
            <div
              key={status.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 16px",
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 14, height: 14, borderRadius: 4, background: status.color ?? "var(--ink3)", flex: "none" }} />
                <span style={{ fontWeight: 700, fontSize: 14 }}>{status.name}</span>
                {status.isDefault && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--green)", background: "var(--green-soft)", padding: "2px 8px", borderRadius: 6 }}>
                    Default
                  </span>
                )}
                {status.isCompletionTarget && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--orange)", background: "var(--orange-soft)", padding: "2px 8px", borderRadius: 6 }}>
                    Auto-complete target
                  </span>
                )}
              </div>
              <span style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <button onClick={() => openEdit(status)} title="Edit" style={{ display: "flex", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  <EditIcon />
                </button>
                <button onClick={() => onDelete(status)} title="Delete" style={{ display: "flex", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
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
