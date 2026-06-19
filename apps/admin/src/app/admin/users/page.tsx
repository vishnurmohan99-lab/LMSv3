"use client";

import { useEffect, useState } from "react";
import { usersApi, ApiError, type Profile } from "@/lib/api";

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  border: "1px solid var(--line)",
  borderRadius: 10,
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  background: "var(--card)",
};

const ROLES: Profile["role"][] = ["STUDENT", "FACULTY", "ADMIN"];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Profile["role"]>("FACULTY");
  const [creating, setCreating] = useState(false);

  function loadUsers() {
    setLoading(true);
    usersApi
      .list()
      .then(setUsers)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load users"))
      .finally(() => setLoading(false));
  }

  useEffect(loadUsers, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      await usersApi.create({ fullName, email, password, role });
      setFullName("");
      setEmail("");
      setPassword("");
      setRole("FACULTY");
      loadUsers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create account");
    } finally {
      setCreating(false);
    }
  }

  async function onRoleChange(id: string, newRole: Profile["role"]) {
    setError(null);
    try {
      await usersApi.updateRole(id, newRole);
      loadUsers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update role");
    }
  }

  return (
    <main style={{ padding: 40, maxWidth: 900 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>User Management</h1>

      <section style={{ marginTop: 28, padding: 20, background: "var(--card)", borderRadius: 16, border: "1px solid var(--line)" }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Create faculty or admin account</h2>
        <form onSubmit={onCreate} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input required placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} style={inputStyle} />
          <input required type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
          <input required type="password" minLength={8} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
          <select value={role} onChange={(e) => setRole(e.target.value as Profile["role"])} style={inputStyle}>
            <option value="FACULTY">Faculty</option>
            <option value="ADMIN">Admin</option>
          </select>
          <button
            type="submit"
            disabled={creating}
            style={{
              padding: "10px 18px",
              background: "var(--ink)",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              fontFamily: "inherit",
              cursor: creating ? "default" : "pointer",
              opacity: creating ? 0.7 : 1,
            }}
          >
            {creating ? "Creating…" : "Create"}
          </button>
        </form>
      </section>

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginTop: 16 }}>{error}</p>}

      <section style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>All users</h2>
        {loading ? (
          <p style={{ color: "var(--ink2)" }}>Loading…</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--ink2)", borderBottom: "1px solid var(--line)" }}>
                <th style={{ padding: "8px 6px" }}>Name</th>
                <th style={{ padding: "8px 6px" }}>Email</th>
                <th style={{ padding: "8px 6px" }}>Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderBottom: "1px solid var(--line2)" }}>
                  <td style={{ padding: "10px 6px" }}>{u.fullName}</td>
                  <td style={{ padding: "10px 6px" }}>{u.email}</td>
                  <td style={{ padding: "10px 6px" }}>
                    <select value={u.role} onChange={(e) => onRoleChange(u.id, e.target.value as Profile["role"])} style={inputStyle}>
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
