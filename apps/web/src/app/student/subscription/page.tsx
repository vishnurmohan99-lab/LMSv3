"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { subscriptionsApi, ApiError, type Subscription, type SubscriptionDetail } from "@/lib/api";

/**
 * Plans screen, ported from Design System/Student - All Screens.dc.html ("2 · SUBSCRIPTION /
 * PLANS"). Three states: the plan grid, an inline confirm step, and a success state.
 *
 * The mockup prices each tier (₹0 / ₹399 / ₹899 per month) and shows a prorated credit on
 * the confirm step. Subscription has no price or billing-cycle field, so rather than print
 * invented money this renders what the plan actually grants — courses, mock tests, and the
 * exact delta you gain by switching. See the note in the page footer.
 */

type View = "plans" | "confirm" | "done";

/** paise → ₹ in whole rupees, matching the catalog's price formatting. */
const formatPrice = (paise: number) => `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;

/** Plain / highlighted / dark, mirroring the mockup's three card treatments. */
type Tone = "plain" | "current" | "premium";

function Check({ on }: { on: boolean }) {
  return (
    <span style={{ color: on ? "var(--green)" : "var(--line)", fontWeight: 700, flex: "none" }}>{on ? "✓" : "✕"}</span>
  );
}

function PlanFeature({ on, children, dark }: { on: boolean; children: React.ReactNode; dark?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 8, fontSize: 13, color: on ? (dark ? "#e8e5e0" : "var(--ink2)") : "var(--ink3)" }}>
      {/* --green is ~2.2:1 on the dark card; --green-bright is the mockup's on-dark green. */}
      <span style={{ color: on ? (dark ? "var(--green-bright)" : "var(--green)") : "var(--line)", fontWeight: 700, flex: "none" }}>
        {on ? "✓" : "✕"}
      </span>
      <span>{children}</span>
    </div>
  );
}

export default function StudentSubscriptionPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Subscription[]>([]);
  const [details, setDetails] = useState<Record<string, SubscriptionDetail>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("plans");
  const [targetId, setTargetId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    subscriptionsApi
      .listAvailable()
      .then(async (list) => {
        if (cancelled) return;
        setPlans(list);
        // Details drive the comparison table and the switch delta. Settled, not all —
        // one failing plan should not blank the whole screen.
        const settled = await Promise.allSettled(list.map((p) => subscriptionsApi.getDetail(p.id)));
        if (cancelled) return;
        const map: Record<string, SubscriptionDetail> = {};
        settled.forEach((r, i) => {
          if (r.status === "fulfilled") map[list[i].id] = r.value;
        });
        setDetails(map);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load plans");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const current = plans.find((p) => p.subscribed) ?? null;
  const target = targetId ? plans.find((p) => p.id === targetId) ?? null : null;

  /** Richest plan you are not already on gets the dark "premium" card, as in the mockup. */
  const premiumId = useMemo(() => {
    const ranked = [...plans]
      .filter((p) => !p.subscribed)
      .sort((a, b) => b._count.courses + b._count.tests - (a._count.courses + a._count.tests));
    return ranked.length > 1 ? ranked[0].id : null;
  }, [plans]);

  const toneOf = (p: Subscription): Tone => (p.subscribed ? "current" : p.id === premiumId ? "premium" : "plain");

  // Courses the switch would actually add, which is the honest stand-in for the
  // mockup's price delta.
  const delta = useMemo(() => {
    if (!target) return { gained: [] as string[], shared: 0 };
    const to = details[target.id];
    if (!to) return { gained: [], shared: 0 };
    const have = new Set(current && details[current.id] ? details[current.id].courses.map((c) => c.course.id) : []);
    const gained = to.courses.filter((c) => !have.has(c.course.id)).map((c) => c.course.title);
    return { gained, shared: to.courses.length - gained.length };
  }, [target, details, current]);

  async function confirmSwitch() {
    if (!target) return;
    setSaving(true);
    setError(null);
    try {
      await subscriptionsApi.subscribe(target.id);
      setView("done");
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to switch plan");
      setView("plans");
    } finally {
      setSaving(false);
    }
  }

  const shellStyle: React.CSSProperties = { padding: "36px 30px 60px" };

  if (loading) {
    return (
      <main className="fade-in" style={shellStyle}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18, maxWidth: 980, margin: "0 auto" }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="dash-skeleton" style={{ height: 300 }} />
          ))}
        </div>
      </main>
    );
  }

  // ---------------------------------------------------------------- success
  if (view === "done" && target) {
    return (
      <main className="fade-in" style={shellStyle}>
        <div className="pop-in" style={{ maxWidth: 460, margin: "20px auto", textAlign: "center" }}>
          <div
            style={{
              width: 64, height: 64, borderRadius: 999, background: "var(--green)", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 26, fontWeight: 800, margin: "0 auto 16px", boxShadow: "0 8px 24px rgba(20,176,119,.35)",
            }}
          >
            ✓
          </div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>You&apos;re on {target.title}</div>
          <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--ink3)", marginTop: 6 }}>
            {delta.gained.length > 0
              ? `${delta.gained.length} new course${delta.gained.length === 1 ? "" : "s"} ${delta.gained.length === 1 ? "is" : "are"} unlocked and ready in My Courses.`
              : "Everything in this plan is unlocked and ready in My Courses."}
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 18, flexWrap: "wrap" }}>
            <button
              onClick={() => router.push("/student/courses")}
              style={{ fontSize: 13, fontWeight: 600, background: "var(--orange)", color: "#fff", border: "none", borderRadius: 10, height: 40, padding: "0 18px", cursor: "pointer", fontFamily: "inherit" }}
            >
              Browse courses
            </button>
            <button
              onClick={() => { setView("plans"); setTargetId(null); }}
              style={{ fontSize: 13, fontWeight: 600, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, height: 40, padding: "0 18px", cursor: "pointer", fontFamily: "inherit" }}
            >
              View plans
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ---------------------------------------------------------------- confirm
  if (view === "confirm" && target) {
    const to = details[target.id];
    return (
      <main className="fade-in" style={shellStyle}>
        <div className="fade-in-up" style={{ maxWidth: 520, margin: "0 auto" }}>
          <span
            onClick={() => { setView("plans"); setTargetId(null); }}
            style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink3)", cursor: "pointer" }}
          >
            ← Back to plans
          </span>
          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 20, padding: 28, marginTop: 14, boxShadow: "0 8px 24px rgba(28,22,15,.10)" }}>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.2 }}>Confirm your switch</div>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 18, padding: 14, background: "var(--bg-sunk, var(--bg))", borderRadius: 14, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, fontWeight: 600, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 999, padding: "6px 13px" }}>
                {current ? current.title : "No plan"}
              </span>
              <span style={{ fontSize: 14, color: "var(--ink3)" }}>→</span>
              <span style={{ fontSize: 12, fontWeight: 600, background: "var(--ink)", color: "#fff", borderRadius: 999, padding: "6px 13px" }}>
                {target.title}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 18, fontSize: 13, fontWeight: 500 }}>
              {target.priceCents != null && (
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ color: "var(--ink2)" }}>{target.title} · monthly</span>
                  <span style={{ fontWeight: 700 }}>{formatPrice(target.priceCents)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span style={{ color: "var(--ink2)" }}>Courses in {target.title}</span>
                <span style={{ fontWeight: 700 }}>{target._count.courses}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span style={{ color: "var(--ink2)" }}>Mock tests included</span>
                <span style={{ fontWeight: 700 }}>{target._count.tests}</span>
              </div>
              {current && (
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ color: "var(--ink2)" }}>Already yours on {current.title}</span>
                  <span style={{ fontWeight: 700 }}>{delta.shared}</span>
                </div>
              )}
              <div style={{ height: 1, background: "var(--line2)" }} />
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontWeight: 700 }}>
                <span>New courses unlocked</span>
                <span style={{ fontSize: 16, color: "var(--green)" }}>+{delta.gained.length}</span>
              </div>
            </div>

            {delta.gained.length > 0 && (
              <div style={{ marginTop: 14, display: "grid", gap: 6 }}>
                {delta.gained.slice(0, 5).map((t) => (
                  <div key={t} style={{ fontSize: 12.5, color: "var(--ink2)", display: "flex", gap: 8 }}>
                    <span style={{ color: "var(--green)", fontWeight: 700 }}>✓</span>
                    {t}
                  </div>
                ))}
                {delta.gained.length > 5 && (
                  <div style={{ fontSize: 12, color: "var(--ink3)", paddingLeft: 20 }}>and {delta.gained.length - 5} more</div>
                )}
              </div>
            )}

            <p style={{ fontSize: 11.5, color: "var(--ink3)", marginTop: 14, lineHeight: 1.5 }}>
              Your progress is never lost when you change plans{to && to.tests.length > 0 ? ` · ${to.tests.length} mock test${to.tests.length === 1 ? "" : "s"} included` : ""}.
            </p>

            {error && <p style={{ color: "var(--red)", fontSize: 13, marginTop: 12 }}>{error}</p>}

            <button
              onClick={confirmSwitch}
              disabled={saving}
              style={{
                width: "100%", height: 44, marginTop: 18, background: "var(--orange)", color: "#fff",
                border: "none", borderRadius: 11, fontSize: 13.5, fontWeight: 600, fontFamily: "inherit",
                cursor: saving ? "wait" : "pointer", opacity: saving ? 0.75 : 1,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
              }}
            >
              {saving && (
                <span
                  style={{
                    width: 15, height: 15, border: "2.5px solid rgba(255,255,255,.4)", borderTopColor: "#fff",
                    borderRadius: 999, display: "inline-block", animation: "spin .7s linear infinite",
                  }}
                />
              )}
              {saving ? "Switching…" : `Switch to ${target.title}`}
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ---------------------------------------------------------------- plans grid
  return (
    <main className="fade-in" style={shellStyle}>
      <div style={{ textAlign: "center", maxWidth: 520, margin: "0 auto 28px" }}>
        <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.4 }}>Pick your pace</div>
        <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--ink3)", marginTop: 6 }}>
          Change anytime — your progress always stays.
        </p>
      </div>

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16, textAlign: "center" }}>{error}</p>}

      {plans.length === 0 ? (
        <div style={{ maxWidth: 480, margin: "0 auto", padding: 40, textAlign: "center", color: "var(--ink3)", fontSize: 14, background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)" }}>
          No plans are available yet.
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18, maxWidth: 980, margin: "0 auto" }}>
            {plans.map((p) => {
              const tone = toneOf(p);
              const dark = tone === "premium";
              const d = details[p.id];
              const paid = d ? d.courses.filter((c) => c.course.type === "PAID").length : 0;
              return (
                <div
                  key={p.id}
                  style={{
                    background: dark ? "var(--ink)" : "var(--card)",
                    border: tone === "current" ? "2px solid var(--orange)" : dark ? "none" : "1px solid var(--line)",
                    boxShadow: tone === "current" ? "0 8px 24px rgba(242,106,27,.12)" : "none",
                    borderRadius: 20, padding: 24, display: "flex", flexDirection: "column",
                    position: "relative", color: dark ? "#fff" : "inherit",
                  }}
                >
                  {tone === "current" && (
                    <span
                      style={{
                        position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)",
                        fontSize: 9, fontWeight: 800, letterSpacing: 0.7, background: "var(--orange)", color: "#fff",
                        borderRadius: 999, padding: "4px 12px", whiteSpace: "nowrap",
                      }}
                    >
                      CURRENT PLAN
                    </span>
                  )}
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{p.title}</div>
                  <div style={{ fontSize: 30, fontWeight: 800, marginTop: 8, letterSpacing: -0.5 }}>
                    {p.priceCents == null ? (
                      <>
                        {p._count.courses}
                        <span style={{ fontSize: 12, fontWeight: 400, color: dark ? "#a8a29a" : "var(--ink3)" }}>
                          {" "}course{p._count.courses === 1 ? "" : "s"}
                        </span>
                      </>
                    ) : (
                      <>
                        {formatPrice(p.priceCents)}
                        <span style={{ fontSize: 12, fontWeight: 400, color: dark ? "#a8a29a" : "var(--ink3)" }}>/mo</span>
                      </>
                    )}
                  </div>
                  {p.description && (
                    <p style={{ fontSize: 12.5, lineHeight: 1.5, color: dark ? "#a8a29a" : "var(--ink3)", marginTop: 6 }}>{p.description}</p>
                  )}

                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16, flex: 1 }}>
                    {/* Admin-authored bullets when set; otherwise fall back to facts derived
                        from what the plan actually contains, so the card is never empty. */}
                    {p.features && p.features.length > 0 ? (
                      p.features.map((f, i) => (
                        <PlanFeature key={i} on dark={dark}>
                          {f}
                        </PlanFeature>
                      ))
                    ) : (
                      <>
                        <PlanFeature on dark={dark}>
                          {p._count.courses} course{p._count.courses === 1 ? "" : "s"} unlocked
                        </PlanFeature>
                        <PlanFeature on={p._count.tests > 0} dark={dark}>
                          {p._count.tests > 0 ? `${p._count.tests} mock test${p._count.tests === 1 ? "" : "s"}` : "No mock tests"}
                        </PlanFeature>
                        <PlanFeature on={paid > 0} dark={dark}>
                          {paid > 0 ? `${paid} paid course${paid === 1 ? "" : "s"} included` : "Free courses only"}
                        </PlanFeature>
                        <PlanFeature on dark={dark}>AI notes, flashcards &amp; doubt solver</PlanFeature>
                      </>
                    )}
                  </div>

                  {p.subscribed ? (
                    <button
                      disabled
                      style={{
                        width: "100%", height: 42, marginTop: 18, background: "var(--line2)", color: "var(--ink3)",
                        border: "none", borderRadius: 11, fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", cursor: "not-allowed",
                      }}
                    >
                      ✓ You&apos;re on this plan
                    </button>
                  ) : (
                    <button
                      onClick={() => { setTargetId(p.id); setView("confirm"); }}
                      style={{
                        width: "100%", height: 42, marginTop: 18,
                        background: dark ? "var(--orange)" : "var(--card)",
                        color: dark ? "#fff" : "var(--ink)",
                        border: dark ? "none" : "1px solid var(--line)",
                        borderRadius: 11, fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer",
                      }}
                    >
                      {current ? "Switch plan →" : "Choose plan →"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Feature matrix — the mockup's comparison table, with rows that are countable
              facts about each plan rather than invented marketing claims. */}
          <div style={{ maxWidth: 980, margin: "26px auto 0", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <div style={{ minWidth: 520 }}>
                <div
                  style={{
                    display: "grid", gridTemplateColumns: `2fr repeat(${plans.length}, 1fr)`, gap: 10,
                    padding: "10px 20px", background: "var(--bg)", borderBottom: "1px solid var(--line)",
                    fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: "var(--ink3)", textTransform: "uppercase",
                  }}
                >
                  <span>Feature</span>
                  {plans.map((p) => (
                    <span key={p.id} style={{ textAlign: "center", color: p.subscribed ? "var(--orange-deep)" : "var(--ink3)" }}>{p.title}</span>
                  ))}
                </div>
                {[
                  { name: "Courses included", value: (p: Subscription) => p._count.courses },
                  { name: "Mock tests included", value: (p: Subscription) => p._count.tests },
                  { name: "Paid courses unlocked", value: (p: Subscription) => (details[p.id] ? details[p.id].courses.filter((c) => c.course.type === "PAID").length : 0) },
                  { name: "AI notes & flashcards", value: () => true },
                  { name: "Progress kept when switching", value: () => true },
                ].map((row) => (
                  <div
                    key={row.name}
                    style={{
                      display: "grid", gridTemplateColumns: `2fr repeat(${plans.length}, 1fr)`, gap: 10,
                      padding: "9px 20px", borderBottom: "1px solid var(--line2)", fontSize: 12.5, fontWeight: 500, alignItems: "center",
                    }}
                  >
                    <span>{row.name}</span>
                    {plans.map((p) => {
                      const v = row.value(p);
                      return (
                        <span key={p.id} style={{ textAlign: "center" }}>
                          {typeof v === "boolean" ? <Check on={v} /> : v > 0 ? v : <Check on={false} />}
                        </span>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
