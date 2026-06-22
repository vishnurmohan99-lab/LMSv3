"use client";

import CalendarApp from "@/components/calendar/CalendarApp";

export default function FacultyCalendarPage() {
  return (
    <main className="fade-in" style={{ padding: "30px 40px 60px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Calendar</h1>
      <p style={{ color: "var(--ink2)", fontSize: 13.5, marginBottom: 22 }}>
        Live classes you've scheduled and your mentor session bookings.
      </p>
      <CalendarApp role="faculty" />
    </main>
  );
}
