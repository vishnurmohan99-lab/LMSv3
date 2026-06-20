"use client";

import { useEffect, useState } from "react";
import { adminApi, ApiError, type AdminStats } from "@/lib/api";

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: "var(--rm)",
        padding: "16px 18px",
      }}
    >
      <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5, color }}>{value}</div>
      <div style={{ fontSize: 12.5, color: "var(--ink2)", marginTop: 4 }}>{label}</div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .stats()
      .then(setStats)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: "30px 30px 60px", maxWidth: 1040, margin: "0 auto" }}>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4, marginBottom: 22 }}>Overview</div>

      {loading ? (
        <p style={{ color: "var(--ink2)" }}>Loading…</p>
      ) : error || !stats ? (
        <p style={{ color: "var(--red)" }}>{error ?? "Failed to load dashboard"}</p>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18, marginBottom: 18 }}>
            <StatCard label="Total users" value={stats.totalUsers} color="var(--ink)" />
            <StatCard label="Students" value={stats.usersByRole.STUDENT} color="var(--orange)" />
            <StatCard label="Faculty" value={stats.usersByRole.FACULTY} color="var(--green)" />
            <StatCard label="Admins" value={stats.usersByRole.ADMIN} color="var(--purple)" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18, marginBottom: 18 }}>
            <StatCard label="Total courses" value={stats.totalCourses} color="var(--ink)" />
            <StatCard label="Published courses" value={stats.publishedCourses} color="var(--green)" />
            <StatCard label="Total enrollments" value={stats.totalEnrollments} color="var(--orange)" />
          </div>

          <div
            style={{
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: "var(--rl)",
              padding: 22,
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Recent signups</div>
            {stats.recentUsers.length === 0 ? (
              <p style={{ color: "var(--ink2)", fontSize: 13.5 }}>No users yet.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "var(--ink2)", borderBottom: "1px solid var(--line)" }}>
                    <th style={{ padding: "8px 6px" }}>Name</th>
                    <th style={{ padding: "8px 6px" }}>Email</th>
                    <th style={{ padding: "8px 6px" }}>Role</th>
                    <th style={{ padding: "8px 6px" }}>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentUsers.map((u) => (
                    <tr key={u.id} style={{ borderBottom: "1px solid var(--line2)" }}>
                      <td style={{ padding: "10px 6px" }}>{u.fullName}</td>
                      <td style={{ padding: "10px 6px" }}>{u.email}</td>
                      <td style={{ padding: "10px 6px" }}>{u.role}</td>
                      <td style={{ padding: "10px 6px", color: "var(--ink3)" }}>
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
