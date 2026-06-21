"use client";

import { useEffect, useState } from "react";
import { mentorApi, ApiError, type MentorAvailability, type MentorBooking } from "@/lib/api";
import { useConfirm } from "@/components/ConfirmProvider";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  border: "1px solid var(--line)",
  borderRadius: 10,
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  background: "var(--card)",
};

export default function FacultyMentorPage() {
  const [availability, setAvailability] = useState<MentorAvailability[]>([]);
  const [bookings, setBookings] = useState<MentorBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [time, setTime] = useState("10:00");
  const [adding, setAdding] = useState(false);
  const confirm = useConfirm();

  function loadAll() {
    setLoading(true);
    Promise.all([mentorApi.listOwnAvailability(), mentorApi.listBookingsAsMentor()])
      .then(([a, b]) => {
        setAvailability(a);
        setBookings(b);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load mentor data"))
      .finally(() => setLoading(false));
  }

  useEffect(loadAll, []);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAdding(true);
    try {
      await mentorApi.addAvailability({ dayOfWeek, time });
      loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add slot");
    } finally {
      setAdding(false);
    }
  }

  async function onRemove(id: string) {
    if (!(await confirm({ message: "Remove this availability slot? Any future bookings on it will remain but no new bookings can be made." }))) return;
    setError(null);
    try {
      await mentorApi.removeAvailability(id);
      loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to remove slot");
    }
  }

  const sortedAvailability = [...availability].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.time.localeCompare(b.time));

  return (
    <main style={{ padding: "30px 40px 60px", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4, marginBottom: 6 }}>Mentor Availability</div>
      <p style={{ fontSize: 13, color: "var(--ink3)", marginBottom: 22 }}>
        Set your weekly recurring time slots. Students can book any open slot in the next 14 days.
      </p>

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</p>}

      <section style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 22, marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Add a weekly slot</div>
        <form onSubmit={onAdd} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <select value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))} style={inputStyle}>
            {DAYS.map((d, i) => (
              <option key={i} value={i}>
                {d}
              </option>
            ))}
          </select>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={inputStyle} />
          <button
            type="submit"
            disabled={adding}
            style={{
              padding: "10px 18px",
              background: "var(--ink)",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              fontFamily: "inherit",
              cursor: adding ? "default" : "pointer",
              opacity: adding ? 0.7 : 1,
            }}
          >
            {adding ? "Adding…" : "Add slot"}
          </button>
        </form>
      </section>

      <section style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 22, marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Your weekly slots</div>
        {loading ? (
          <p style={{ color: "var(--ink2)" }}>Loading…</p>
        ) : sortedAvailability.length === 0 ? (
          <p style={{ color: "var(--ink3)", fontSize: 13 }}>No slots yet — add one above.</p>
        ) : (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {sortedAvailability.map((a) => (
              <div
                key={a.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 14px",
                  background: "var(--bg)",
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {DAYS[a.dayOfWeek]} · {a.time}
                <button
                  onClick={() => onRemove(a.id)}
                  style={{ border: "none", background: "none", color: "var(--red)", cursor: "pointer", fontSize: 13, fontWeight: 700, padding: 0 }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 22 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Upcoming bookings</div>
        {loading ? (
          <p style={{ color: "var(--ink2)" }}>Loading…</p>
        ) : bookings.length === 0 ? (
          <p style={{ color: "var(--ink3)", fontSize: 13 }}>No bookings yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {bookings.map((b) => (
              <div
                key={b.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 16px",
                  background: "var(--bg)",
                  borderRadius: 10,
                  fontSize: 13.5,
                }}
              >
                <div>
                  <b>{b.student?.fullName}</b> · {new Date(b.date).toLocaleDateString()} {b.availability?.time}
                </div>
                <span style={{ color: "var(--ink3)", fontSize: 12 }}>{b.student?.email}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
