"use client";

import CalendarApp from "@/components/calendar/CalendarApp";

export default function StudentCalendarPage() {
  return (
    <div className="fade-in mobile-page-pad" style={{ padding: "30px 40px 60px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Calendar</h1>
      <p style={{ color: "var(--ink2)", fontSize: 13.5, marginBottom: 22 }}>
        Live classes from your courses and your booked mentor sessions.
      </p>
      <CalendarApp role="student" />
    </div>
  );
}
