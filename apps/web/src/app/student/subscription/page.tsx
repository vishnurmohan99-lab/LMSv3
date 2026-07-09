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
    <main className="fade-in" style={{ padding: "36px 30px 60px" }}>
      <div style={{ textAlign: "center", maxWidth: 520, margin: "0 auto 28px" }}>
        <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>Subscription bundles</div>
        <p style={{ fontSize: 13.5, color: "var(--ink3)", marginTop: 6, lineHeight: 1.6 }}>Subscribe to a bundle to unlock every course and test included — your progress always stays.</p>
      </div>

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16, textAlign: "center" }}>{error}</p>}

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 18, maxWidth: 980, margin: "0 auto" }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="dash-skeleton" style={{ height: 220 }} />
          ))}
        </div>
      ) : subscriptions.length === 0 ? (
        <div style={{ maxWidth: 480, margin: "0 auto", padding: 40, textAlign: "center", color: "var(--ink3)", fontSize: 14, background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)" }}>
          No subscriptions are available yet.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 18, maxWidth: 980, margin: "0 auto" }}>
          {subscriptions.map((sub) => (
            <button
              key={sub.id}
              onClick={() => openDetail(sub.id)}
              className="entity-card"
              style={{
                textAlign: "left",
                background: "var(--card)",
                border: sub.subscribed ? "2px solid var(--orange)" : "1px solid var(--line)",
                boxShadow: sub.subscribed ? "0 8px 24px rgba(242,106,27,.12)" : "none",
                borderRadius: 20,
                padding: 24,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                cursor: "pointer",
                fontFamily: "inherit",
                position: "relative",
              }}
            >
              {sub.subscribed && (
                <span
                  style={{
                    position: "absolute",
                    top: -10,
                    left: "50%",
                    transform: "translateX(-50%)",
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: 0.5,
                    background: "var(--orange)",
                    color: "#fff",
                    borderRadius: 999,
                    padding: "4px 12px",
                    whiteSpace: "nowrap",
                  }}
                >
                  CURRENT PLAN
                </span>
              )}
              <div style={{ fontWeight: 700, fontSize: 16 }}>{sub.title}</div>
              {sub.description && <div style={{ fontSize: 12.5, color: "var(--ink3)", lineHeight: 1.5 }}>{sub.description}</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 8, flex: 1 }}>
                <div style={{ display: "flex", gap: 8, fontSize: 13, color: "var(--ink2)" }}>
                  <span style={{ color: "var(--green)", fontWeight: 700 }}>✓</span>
                  {sub._count.courses} course{sub._count.courses === 1 ? "" : "s"}
                </div>
                <div style={{ display: "flex", gap: 8, fontSize: 13, color: "var(--ink2)" }}>
                  <span style={{ color: "var(--green)", fontWeight: 700 }}>✓</span>
                  {sub._count.tests} test{sub._count.tests === 1 ? "" : "s"}
                </div>
              </div>
              <span
                style={{
                  marginTop: 10,
                  textAlign: "center",
                  fontSize: 13.5,
                  fontWeight: 700,
                  padding: "10px 0",
                  borderRadius: 11,
                  background: sub.subscribed ? "var(--line2)" : "var(--ink)",
                  color: sub.subscribed ? "var(--ink3)" : "#fff",
                }}
              >
                {sub.subscribed ? "✓ You're subscribed" : "View details →"}
              </span>
            </button>
          ))}
        </div>
      )}
    </main>
  );
}
