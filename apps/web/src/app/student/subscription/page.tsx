"use client";

import { useEffect, useState } from "react";
import { subscriptionsApi, ApiError, type Subscription, type SubscriptionDetail } from "@/lib/api";
import { useConfirm } from "@/components/ConfirmProvider";

export default function StudentSubscriptionPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SubscriptionDetail | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const confirm = useConfirm();

  function load() {
    setLoading(true);
    subscriptionsApi
      .listAvailable()
      .then(setSubscriptions)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load subscriptions"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function openDetail(id: string) {
    setOpenId(id);
    subscriptionsApi.getDetail(id).then(setDetail).catch(() => {});
  }

  async function onSubscribe(id: string, title: string) {
    if (!(await confirm({ message: `Subscribe to "${title}"? You'll get access to every course and test included.` }))) return;
    setSubscribing(true);
    try {
      await subscriptionsApi.subscribe(id);
      load();
      setOpenId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to subscribe");
    } finally {
      setSubscribing(false);
    }
  }

  if (openId && detail) {
    return (
      <main className="fade-in" style={{ padding: "30px 30px 60px", maxWidth: 700, margin: "0 auto" }}>
        <button
          onClick={() => setOpenId(null)}
          style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 15px", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", marginBottom: 18 }}
        >
          ← Back
        </button>
        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: "28px 30px" }}>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.4 }}>{detail.title}</div>
          {detail.description && <p style={{ color: "var(--ink2)", marginTop: 8, fontSize: 14 }}>{detail.description}</p>}

          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 10 }}>Courses included ({detail.courses.length})</div>
            {detail.courses.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--ink3)" }}>No courses in this bundle.</p>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {detail.courses.map(({ course }) => (
                  <div key={course.id} style={{ padding: "10px 14px", background: "var(--bg)", borderRadius: 10, fontSize: 13.5 }}>
                    {course.title}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 10 }}>Tests included ({detail.tests.length})</div>
            {detail.tests.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--ink3)" }}>No standalone tests in this bundle.</p>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {detail.tests.map(({ test }) => (
                  <div key={test.id} style={{ padding: "10px 14px", background: "var(--bg)", borderRadius: 10, fontSize: 13.5 }}>
                    {test.title}
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <p style={{ color: "var(--red)", fontSize: 13, marginTop: 16 }}>{error}</p>}

          {detail.subscribed ? (
            <div style={{ marginTop: 24, padding: "13px 16px", background: "var(--green-soft)", borderRadius: 11, fontSize: 13, color: "var(--green)", fontWeight: 700, textAlign: "center" }}>
              ✓ You're subscribed
            </div>
          ) : (
            <button
              onClick={() => onSubscribe(detail.id, detail.title)}
              disabled={subscribing}
              style={{ width: "100%", marginTop: 24, padding: 15, background: "var(--ink)", color: "#fff", border: "none", borderRadius: 13, fontSize: 15, fontWeight: 700, fontFamily: "inherit", cursor: subscribing ? "default" : "pointer", opacity: subscribing ? 0.7 : 1 }}
            >
              {subscribing ? "Subscribing…" : "Subscribe"}
            </button>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="fade-in" style={{ padding: "30px 30px 60px" }}>
      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, marginBottom: 6 }}>Subscriptions</div>
      <p style={{ fontSize: 13, color: "var(--ink3)", marginBottom: 22 }}>Subscribe to a bundle to unlock every course and test included.</p>

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {loading ? (
        <p style={{ color: "var(--ink2)" }}>Loading…</p>
      ) : subscriptions.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--ink3)", fontSize: 14, background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rm)" }}>
          No subscriptions are available yet.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 18 }}>
          {subscriptions.map((sub) => (
            <button
              key={sub.id}
              onClick={() => openDetail(sub.id)}
              className="entity-card"
              style={{ textAlign: "left", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 18, display: "grid", gap: 8, cursor: "pointer", fontFamily: "inherit" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{sub.title}</div>
                {sub.subscribed && (
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--green)", background: "var(--green-soft)", padding: "2px 8px", borderRadius: 6, flex: "none" }}>SUBSCRIBED</span>
                )}
              </div>
              {sub.description && <div style={{ fontSize: 12.5, color: "var(--ink3)" }}>{sub.description}</div>}
              <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 4 }}>
                {sub._count.courses} course{sub._count.courses === 1 ? "" : "s"} · {sub._count.tests} test{sub._count.tests === 1 ? "" : "s"}
              </div>
            </button>
          ))}
        </div>
      )}
    </main>
  );
}
