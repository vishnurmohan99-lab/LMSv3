"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { subscriptionsApi, ApiError, type Subscription } from "@/lib/api";
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

export default function AdminSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    subscriptionsApi
      .listAll()
      .then(setSubscriptions)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load subscriptions"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function openAdd() {
    setTitle("");
    setDescription("");
    setSaveError(null);
    setShowAdd(true);
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      await subscriptionsApi.create({ title, description });
      setShowAdd(false);
      load();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Failed to create subscription");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fade-in" style={{ padding: "30px 40px 60px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>Subscriptions</h1>
          <p style={{ color: "var(--ink2)", marginTop: 4, fontSize: 13.5 }}>
            Bundle courses and standalone tests. Enrolling a student grants every course and test in the bundle.
          </p>
        </div>
        <button onClick={openAdd} style={{ ...btnStyle, display: "flex", alignItems: "center", gap: 7 }}>
          <PlusIcon />
          New subscription
        </button>
      </div>

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {showAdd && (
        <Modal title="New subscription" onClose={() => setShowAdd(false)}>
          <form onSubmit={onSave} style={{ display: "grid", gap: 14 }}>
            <input required autoFocus placeholder="Title (e.g. JEE Crash Course Bundle)" value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
            <textarea
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
            />
            <button
              type="submit"
              disabled={!title.trim() || saving}
              style={{ ...btnStyle, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: !title.trim() || saving ? 0.7 : 1 }}
            >
              {saving && <Spinner />}
              {saving ? "Creating…" : "Create"}
            </button>
            {saveError && <span style={{ color: "var(--red)", fontSize: 12 }}>{saveError}</span>}
          </form>
        </Modal>
      )}

      {loading ? (
        <p style={{ color: "var(--ink2)" }}>Loading…</p>
      ) : subscriptions.length === 0 ? (
        <p style={{ color: "var(--ink2)" }}>No subscriptions yet — create the first one above.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 18 }}>
          {subscriptions.map((sub) => (
            <Link
              key={sub.id}
              href={`/admin/subscriptions/${sub.id}`}
              className="entity-card"
              style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 18, display: "grid", gap: 8 }}
            >
              <div style={{ fontWeight: 700, fontSize: 15 }}>{sub.title}</div>
              {sub.description && <div style={{ fontSize: 12.5, color: "var(--ink3)" }}>{sub.description}</div>}
              <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 4 }}>
                {sub._count.courses} course{sub._count.courses === 1 ? "" : "s"} · {sub._count.tests} test{sub._count.tests === 1 ? "" : "s"} · {sub._count.enrollments} subscriber
                {sub._count.enrollments === 1 ? "" : "s"}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
