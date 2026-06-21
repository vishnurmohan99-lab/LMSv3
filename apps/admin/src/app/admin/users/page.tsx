"use client";

import { useEffect, useState } from "react";
import { usersApi, mentorApi, ApiError, type Profile } from "@/lib/api";

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

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  let pwd = "";
  for (let i = 0; i < 12; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  return pwd;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<Profile["role"]>("FACULTY");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string; role: string } | null>(null);
  const [copied, setCopied] = useState(false);

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
    setCreated(null);
    setCreating(true);
    try {
      await usersApi.create({ fullName, email, password, role });
      setCreated({ email, password, role });
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

  async function onToggleMentor(u: Profile) {
    setError(null);
    try {
      await mentorApi.setMentorFlag(u.id, { isMentor: !u.isMentor, specialty: u.mentorSpecialty ?? undefined });
      loadUsers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update mentor status");
    }
  }

  async function onSpecialtyBlur(u: Profile, specialty: string) {
    if (!u.isMentor || specialty === (u.mentorSpecialty ?? "")) return;
    try {
      await mentorApi.setMentorFlag(u.id, { isMentor: true, specialty });
      loadUsers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update specialty");
    }
  }

  async function onCopyCredentials() {
    if (!created) return;
    await navigator.clipboard.writeText(`Email: ${created.email}\nPassword: ${created.password}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ padding: "30px 30px 60px", maxWidth: 1040, margin: "0 auto" }}>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4, marginBottom: 22 }}>User Management</div>

      <section
        style={{
          padding: 20,
          background: "var(--card)",
          borderRadius: "var(--rl)",
          border: "1px solid var(--line)",
          marginBottom: 18,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Create faculty or admin account</div>
        <form onSubmit={onCreate} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input required placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} style={inputStyle} />
          <input required type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
          <div style={{ display: "flex", gap: 6 }}>
            <input
              required
              type={showPassword ? "text" : "password"}
              minLength={8}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              style={{ ...inputStyle, cursor: "pointer", fontSize: 12, color: "var(--ink2)" }}
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
            <button
              type="button"
              onClick={() => {
                setPassword(generatePassword());
                setShowPassword(true);
              }}
              style={{ ...inputStyle, cursor: "pointer", fontSize: 12, color: "var(--orange)" }}
            >
              Generate
            </button>
          </div>
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

        {created && (
          <div
            style={{
              marginTop: 16,
              padding: 16,
              background: "var(--green-soft)",
              borderRadius: "var(--rm)",
              color: "var(--green)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 14,
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontSize: 13 }}>
              <b>{created.role} account created.</b> Share these credentials with them now — the password won&apos;t be shown again.
              <div style={{ marginTop: 4, fontFamily: "monospace" }}>
                {created.email} / {created.password}
              </div>
            </div>
            <button
              onClick={onCopyCredentials}
              style={{
                padding: "8px 16px",
                background: "var(--ink)",
                color: "#fff",
                border: "none",
                borderRadius: 9,
                fontSize: 12.5,
                fontWeight: 700,
                fontFamily: "inherit",
                cursor: "pointer",
                flex: "none",
              }}
            >
              {copied ? "Copied!" : "Copy credentials"}
            </button>
          </div>
        )}
      </section>

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</p>}

      <section
        style={{
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: "var(--rl)",
          padding: 22,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>All users</div>
        {loading ? (
          <p style={{ color: "var(--ink2)" }}>Loading…</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--ink2)", borderBottom: "1px solid var(--line)" }}>
                <th style={{ padding: "8px 6px" }}>Name</th>
                <th style={{ padding: "8px 6px" }}>Email</th>
                <th style={{ padding: "8px 6px" }}>Role</th>
                <th style={{ padding: "8px 6px" }}>Mentor</th>
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
                  <td style={{ padding: "10px 6px" }}>
                    {u.role === "FACULTY" ? (
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12.5 }}>
                          <input type="checkbox" checked={!!u.isMentor} onChange={() => onToggleMentor(u)} style={{ accentColor: "var(--orange)" }} />
                          Mentor
                        </label>
                        {u.isMentor && (
                          <input
                            defaultValue={u.mentorSpecialty ?? ""}
                            placeholder="Specialty e.g. Front-end · 6y"
                            onBlur={(e) => onSpecialtyBlur(u, e.target.value)}
                            style={{ ...inputStyle, padding: "6px 10px", fontSize: 12.5, width: 180 }}
                          />
                        )}
                      </div>
                    ) : (
                      <span style={{ color: "var(--ink3)", fontSize: 12.5 }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
