"use client";

import { useEffect, useMemo, useState } from "react";
import { mentorApi, ApiError, type Mentor, type MentorSlot, type MentorBooking } from "@/lib/api";
import { useConfirm } from "@/components/ConfirmProvider";

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase();
}

function dateLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export default function StudentMentorPage() {
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [mentorId, setMentorId] = useState<string>("");
  const [slots, setSlots] = useState<MentorSlot[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<MentorSlot | null>(null);
  const [bookings, setBookings] = useState<MentorBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [justBooked, setJustBooked] = useState<{ mentorName: string; date: string; time: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirm();

  useEffect(() => {
    setLoading(true);
    Promise.all([mentorApi.listMentors(), mentorApi.listBookingsAsStudent()])
      .then(([m, b]) => {
        setMentors(m);
        setBookings(b);
        if (m.length > 0) setMentorId(m[0].id);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load mentors"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!mentorId) return;
    setSlots([]);
    setSelectedDate("");
    setSelectedSlot(null);
    setJustBooked(null);
    mentorApi
      .getSlots(mentorId, 14)
      .then((s) => {
        setSlots(s);
        const firstOpenDate = s.find((slot) => !slot.booked)?.date ?? s[0]?.date ?? "";
        setSelectedDate(firstOpenDate);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load availability"));
  }, [mentorId]);

  const mentor = mentors.find((m) => m.id === mentorId) ?? null;

  const availableDates = useMemo(() => {
    const seen = new Set<string>();
    const dates: string[] = [];
    for (const s of slots) {
      if (!seen.has(s.date)) {
        seen.add(s.date);
        dates.push(s.date);
      }
    }
    return dates;
  }, [slots]);

  const slotsForDate = slots.filter((s) => s.date === selectedDate);

  async function onConfirm() {
    if (!mentor || !selectedSlot) return;
    setError(null);
    setBooking(true);
    try {
      await mentorApi.createBooking(mentor.id, { availabilityId: selectedSlot.availabilityId, date: selectedSlot.date });
      const [s, b] = await Promise.all([mentorApi.getSlots(mentor.id, 14), mentorApi.listBookingsAsStudent()]);
      setSlots(s);
      setBookings(b);
      setJustBooked({ mentorName: mentor.fullName, date: selectedSlot.date, time: selectedSlot.time });
      setSelectedSlot(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to book session");
    } finally {
      setBooking(false);
    }
  }

  async function onCancel(id: string) {
    if (!(await confirm({ message: "Cancel this mentor session?" }))) return;
    setError(null);
    try {
      await mentorApi.cancelBooking(id);
      const b = await mentorApi.listBookingsAsStudent();
      setBookings(b);
      if (mentor) setSlots(await mentorApi.getSlots(mentor.id, 14));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to cancel session");
    }
  }

  if (loading) {
    return (
      <main className="fade-in mobile-page-pad" style={{ padding: "30px 30px 60px", maxWidth: 1040, margin: "0 auto" }}>
        <p style={{ color: "var(--ink2)" }}>Loading…</p>
      </main>
    );
  }

  return (
    <main className="fade-in mobile-page-pad" style={{ padding: "30px 30px 60px", maxWidth: 1040, margin: "0 auto" }}>
      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, marginBottom: 22 }}>Book a Mentor</div>

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {mentors.length === 0 ? (
        <p style={{ color: "var(--ink2)" }}>No mentors are available for booking right now.</p>
      ) : (
        <div className="mobile-stack-grid" style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 26 }}>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.3, marginBottom: 16 }}>Pick a mentor</div>

            <div className="mentor-card-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 22 }}>
              {mentors.map((m) => {
                const active = mentorId === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setMentorId(m.id)}
                    style={{
                      textAlign: "left",
                      border: active ? "1.5px solid var(--orange)" : "1px solid var(--line)",
                      background: active ? "var(--orange-soft)" : "var(--card)",
                      borderRadius: 14,
                      padding: 14,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    <div style={{ position: "relative", width: 40, height: 40, flex: "none", marginBottom: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--purple-soft)", color: "var(--purple-ink)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13 }}>
                        {initials(m.fullName)}
                      </div>
                      <div style={{ position: "absolute", bottom: -5, left: "50%", transform: "translateX(-50%)", fontSize: 7, fontWeight: 800, letterSpacing: 0.4, background: "var(--orange)", color: "#fff", borderRadius: 4, padding: "2px 4px", whiteSpace: "nowrap" }}>
                        MENTOR
                      </div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.fullName}</div>
                    <div style={{ fontSize: 11, color: "var(--ink3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.mentorSpecialty ?? "Mentor"}</div>
                  </button>
                );
              })}
            </div>

            {availableDates.length === 0 ? (
              <div style={{ border: "1.5px dashed var(--line)", borderRadius: 16, padding: 26, textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>No open slots</div>
                <div style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--ink3)", marginTop: 4 }}>
                  {mentor?.fullName ?? "This mentor"} has no availability in the next two weeks. Try another mentor.
                </div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Pick a day</div>
                <div style={{ display: "flex", gap: 8, margin: "0 0 22px", flexWrap: "wrap" }}>
                  {availableDates.map((d) => {
                    const sel = selectedDate === d;
                    const dObj = new Date(d);
                    return (
                      <button
                        key={d}
                        onClick={() => {
                          setSelectedDate(d);
                          setSelectedSlot(null);
                          setJustBooked(null);
                        }}
                        style={{
                          minWidth: 52,
                          padding: "8px 0",
                          borderRadius: 12,
                          border: `1.5px solid ${sel ? "var(--orange)" : "var(--line)"}`,
                          background: sel ? "var(--orange-soft)" : "var(--card)",
                          color: sel ? "var(--orange-deep)" : "var(--ink)",
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        <div style={{ fontSize: 10, fontWeight: 600, opacity: 0.75 }}>{dObj.toLocaleDateString(undefined, { weekday: "short" })}</div>
                        <div style={{ fontSize: 15, fontWeight: 800, fontFamily: "var(--font-mono)" }}>{dObj.getDate()}</div>
                      </button>
                    );
                  })}
                </div>

                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Available slots</div>
                <div className="mentor-slot-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, maxWidth: 480 }}>
                  {slotsForDate.map((s) => {
                    const sel = selectedSlot?.availabilityId === s.availabilityId && selectedSlot?.date === s.date;
                    return (
                      <button
                        key={s.availabilityId}
                        disabled={s.booked}
                        onClick={() => {
                          setSelectedSlot(s);
                          setJustBooked(null);
                        }}
                        style={{
                          padding: 11,
                          borderRadius: 10,
                          fontSize: 13,
                          fontWeight: 700,
                          fontFamily: "inherit",
                          cursor: s.booked ? "default" : "pointer",
                          border: `1px solid ${sel ? "var(--orange)" : "var(--line)"}`,
                          background: sel ? "var(--orange)" : s.booked ? "var(--bg)" : "var(--card)",
                          color: sel ? "#fff" : s.booked ? "var(--ink3)" : "var(--ink)",
                          textDecoration: s.booked ? "line-through" : "none",
                        }}
                      >
                        {s.time}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div
            className="mentor-summary-card"
            style={{
              alignSelf: "start",
              background: "var(--ink)",
              color: "#fff",
              borderRadius: "var(--rl)",
              padding: 24,
              position: "sticky",
              top: 0,
            }}
          >
            <div style={{ fontSize: 13, opacity: 0.6, letterSpacing: 0.5, textTransform: "uppercase" }}>Booking Summary</div>
            {justBooked ? (
              <div className="pop-in" style={{ textAlign: "center", padding: "10px 0" }}>
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--green)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, margin: "0 auto 12px" }}>✓</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>Session booked!</div>
                <div style={{ fontSize: 12, lineHeight: 1.6, color: "rgba(255,255,255,.66)", marginTop: 6 }}>
                  {justBooked.mentorName} · {dateLabel(justBooked.date)} · {justBooked.time}
                  <br />
                  Added to your sessions below.
                </div>
                <button
                  onClick={() => setJustBooked(null)}
                  style={{ marginTop: 14, height: 34, padding: "0 14px", background: "#2a2620", color: "#e8e5e0", border: "1px solid #403b35", borderRadius: 9, fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}
                >
                  Book another
                </button>
              </div>
            ) : (
              <>
            {mentor && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0" }}>
                <div
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 14,
                    background: "linear-gradient(135deg,#f7902b,#f24d1b)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                  }}
                >
                  {initials(mentor.fullName)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{mentor.fullName}</div>
                  <div style={{ fontSize: 12, opacity: 0.6, whiteSpace: "nowrap" }}>{mentor.mentorSpecialty ?? "Mentor"}</div>
                </div>
              </div>
            )}
            <div
              style={{
                display: "grid",
                gap: 10,
                fontSize: 13,
                padding: "16px 0",
                borderTop: "1px solid rgba(255,255,255,.1)",
                borderBottom: "1px solid rgba(255,255,255,.1)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ opacity: 0.6 }}>Date</span>
                <span style={{ fontWeight: 600 }}>{selectedSlot ? dateLabel(selectedSlot.date) : "—"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ opacity: 0.6 }}>Time</span>
                <span style={{ fontWeight: 600 }}>{selectedSlot?.time ?? "—"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ opacity: 0.6 }}>Duration</span>
                <span style={{ fontWeight: 600 }}>30 min</span>
              </div>
            </div>
            <button
              onClick={onConfirm}
              disabled={!selectedSlot || booking}
              style={{
                width: "100%",
                marginTop: 16,
                padding: 14,
                background: "var(--orange)",
                color: "#fff",
                border: "none",
                borderRadius: 12,
                fontSize: 15,
                fontWeight: 700,
                fontFamily: "inherit",
                cursor: !selectedSlot || booking ? "default" : "pointer",
                opacity: !selectedSlot || booking ? 0.6 : 1,
              }}
            >
              {booking ? "Booking…" : "Confirm Booking"}
            </button>
              </>
            )}
          </div>
        </div>
      )}

      {bookings.length > 0 && (
        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 24, marginTop: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>Your booked sessions</div>
          <div style={{ display: "grid", gap: 12 }}>
            {bookings.map((b) => (
              <div
                key={b.id}
                style={{ display: "flex", alignItems: "center", gap: 14, border: "1px solid var(--line)", borderRadius: "var(--rm)", padding: "14px 16px", flexWrap: "wrap" }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 13,
                    background: "linear-gradient(135deg,#f7902b,#f24d1b)",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    flex: "none",
                  }}
                >
                  {b.mentor ? initials(b.mentor.fullName) : "?"}
                </div>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{b.mentor?.fullName}</div>
                  <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 2 }}>{b.mentor?.mentorSpecialty ?? "Mentor"}</div>
                </div>
                <div style={{ textAlign: "right", flex: "none" }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{dateLabel(b.date)}</div>
                  <div style={{ fontSize: 12, color: "var(--ink2)" }}>{b.availability?.time} · 30 min</div>
                </div>
                <button
                  onClick={() => onCancel(b.id)}
                  style={{
                    padding: "9px 16px",
                    background: "var(--card)",
                    border: "1px solid var(--red-line)",
                    color: "var(--red)",
                    borderRadius: 10,
                    fontSize: 12.5,
                    fontWeight: 700,
                    fontFamily: "inherit",
                    cursor: "pointer",
                    flex: "none",
                  }}
                >
                  Cancel
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
